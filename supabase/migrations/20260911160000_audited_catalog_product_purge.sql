create table public.catalog_product_purge_audit (
	id uuid primary key default gen_random_uuid(),
	requested_by uuid references auth.users(id) on delete set null,
	request_source text not null check (
		request_source in ('privileged_toolbar', 'operations_cli')
	),
	reason text not null check (
		char_length(btrim(reason)) between 10 and 1000
		and reason = btrim(reason)
	),
	deletion_summary jsonb not null check (
		jsonb_typeof(deletion_summary) = 'object'
	),
	completed_at timestamptz not null default now()
);

comment on table public.catalog_product_purge_audit is
	'Audits destructive catalog purges without retaining the deleted barcode, product id, product name, or source payload.';

alter table public.catalog_product_purge_audit enable row level security;
alter table public.catalog_product_purge_audit force row level security;

revoke all on table public.catalog_product_purge_audit
	from public, anon, authenticated;
grant select on table public.catalog_product_purge_audit to service_role;

create or replace function private.normalize_catalog_product_purge_barcode(
	p_barcode text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_digits text := btrim(coalesce(p_barcode, ''));
	v_sum integer;
	v_expected_check_digit integer;
begin
	if v_digits !~ '^[0-9]+$'
		or char_length(v_digits) not in (8, 12, 13, 14) then
		raise exception using
			errcode = '22023',
			message = 'Enter a valid 8, 12, 13, or 14 digit UPC / GTIN.';
	end if;

	select sum(
		substring(v_digits from position for 1)::integer
		* case
			when (char_length(v_digits) - position) % 2 = 1 then 3
			else 1
		end
	)
	into v_sum
	from generate_series(1, char_length(v_digits) - 1) position;

	v_expected_check_digit := (10 - (v_sum % 10)) % 10;
	if right(v_digits, 1)::integer <> v_expected_check_digit then
		raise exception using
			errcode = '22023',
			message = 'The UPC / GTIN check digit is invalid.';
	end if;

	return lpad(v_digits, 14, '0');
end;
$$;

revoke all on function private.normalize_catalog_product_purge_barcode(text)
	from public, anon, authenticated;
grant execute on function private.normalize_catalog_product_purge_barcode(text)
	to service_role;

create or replace function private.catalog_product_purge_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select public.authorize_app_permission(
		'data_operations.catalog_health.repair'
	)
	and exists (
		select 1
		from public.app_role_assignments assignment
		join public.app_role_permissions permission
			on permission.role = assignment.role
		where assignment.user_id = auth.uid()
			and permission.permission =
				'data_operations.catalog_health.repair'
	);
$$;

revoke all on function private.catalog_product_purge_access_allowed()
	from public, anon, authenticated;

create or replace function private.collect_catalog_product_purge_targets(
	p_barcode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_product_name text;
	v_brand_owner text;
	v_counts jsonb;
	v_barcodes text[] := array[p_barcode, ltrim(p_barcode, '0')];
	v_product_ids uuid[] := '{}'::uuid[];
	v_submission_ids uuid[] := '{}'::uuid[];
	v_revision_ids uuid[] := '{}'::uuid[];
	v_observation_ids uuid[] := '{}'::uuid[];
	v_conflict_ids uuid[] := '{}'::uuid[];
	v_image_ids uuid[] := '{}'::uuid[];
	v_feedback_ids uuid[] := '{}'::uuid[];
	v_snapshot_ids uuid[] := '{}'::uuid[];
	v_component_ids uuid[] := '{}'::uuid[];
	v_precaution_ids uuid[] := '{}'::uuid[];
	v_cache_keys jsonb := '[]'::jsonb;
begin
	select coalesce(array_agg(distinct id), '{}'::uuid[])
	into v_product_ids
	from (
		select product.id
		from public.shared_products product
		where product.barcode = p_barcode
			or public.food_normalized_barcode(product.food) = p_barcode
		union
		select submission.target_shared_product_id
		from public.shared_product_submissions submission
		where submission.target_shared_product_id is not null
			and (
				submission.barcode = p_barcode
				or public.food_normalized_barcode(submission.food) = p_barcode
			)
		union
		select revision.shared_product_id
		from public.shared_product_revisions revision
		where public.food_normalized_barcode(revision.food) = p_barcode
	) target;

	select coalesce(array_agg(distinct submission.id), '{}'::uuid[])
	into v_submission_ids
	from public.shared_product_submissions submission
	where submission.barcode = p_barcode
		or submission.target_shared_product_id = any(v_product_ids)
		or public.food_normalized_barcode(submission.food) = p_barcode;

	select coalesce(array_agg(distinct revision.id), '{}'::uuid[])
	into v_revision_ids
	from public.shared_product_revisions revision
	where revision.shared_product_id = any(v_product_ids)
		or revision.submission_id = any(v_submission_ids)
		or public.food_normalized_barcode(revision.food) = p_barcode;

	select coalesce(array_agg(distinct id), '{}'::uuid[])
	into v_submission_ids
	from (
		select unnest(v_submission_ids) as id
		union
		select revision.submission_id
		from public.shared_product_revisions revision
		where revision.id = any(v_revision_ids)
			and revision.submission_id is not null
	) target;

	select coalesce(array_agg(distinct id), '{}'::uuid[])
	into v_revision_ids
	from (
		select unnest(v_revision_ids) as id
		union
		select revision.id
		from public.shared_product_revisions revision
		where revision.submission_id = any(v_submission_ids)
	) target;

	select coalesce(array_agg(distinct observation.id), '{}'::uuid[])
	into v_observation_ids
	from public.shared_product_observations observation
	where observation.barcode = p_barcode
		or observation.submission_id = any(v_submission_ids)
		or public.food_normalized_barcode(observation.normalized_food) = p_barcode;

	select coalesce(array_agg(distinct conflict.id), '{}'::uuid[])
	into v_conflict_ids
	from public.shared_product_conflicts conflict
	where conflict.barcode = p_barcode
		or conflict.shared_product_id = any(v_product_ids);

	select coalesce(array_agg(distinct image.id), '{}'::uuid[])
	into v_image_ids
	from public.food_image_assets image
	where image.barcode = p_barcode
		or image.shared_product_id = any(v_product_ids);

	select coalesce(array_agg(distinct feedback.id), '{}'::uuid[])
	into v_feedback_ids
	from public.food_compatibility_feedback feedback
	where feedback.barcode = p_barcode
		or feedback.shared_product_id = any(v_product_ids)
		or feedback.shared_product_revision_id = any(v_revision_ids);

	select coalesce(array_agg(distinct snapshot.id), '{}'::uuid[])
	into v_snapshot_ids
	from public.catalog_provider_product_snapshots snapshot
	where snapshot.shared_product_id = any(v_product_ids)
		or snapshot.observation_id = any(v_observation_ids);

	select coalesce(
		jsonb_agg(
			jsonb_build_object('provider', target.provider, 'cacheKey', target.cache_key)
			order by target.provider, target.cache_key
		),
		'[]'::jsonb
	)
	into v_cache_keys
	from (
		select distinct cache.provider, cache.cache_key
		from public.product_api_cache cache
		where exists (
			select 1
			from unnest(v_barcodes) barcode
			where barcode <> ''
				and (
					cache.cache_key = barcode
					or cache.cache_key like '%' || barcode || '%'
					or cache.response::text like '%' || barcode || '%'
				)
		)
	) target;

	select coalesce(array_agg(distinct component.id), '{}'::uuid[])
	into v_component_ids
	from public.product_ingredient_components component
	join public.product_ingredient_statements statement
		on statement.id = component.statement_id
	where statement.shared_product_id = any(v_product_ids)
		or statement.shared_product_observation_id = any(v_observation_ids)
		or statement.shared_product_submission_id = any(v_submission_ids)
		or statement.source_observation_id = any(v_observation_ids);

	select coalesce(array_agg(distinct statement.id), '{}'::uuid[])
	into v_precaution_ids
	from public.product_precautionary_statements statement
	where statement.shared_product_id = any(v_product_ids)
		or statement.shared_product_observation_id = any(v_observation_ids)
		or statement.shared_product_submission_id = any(v_submission_ids)
		or statement.shared_product_revision_id = any(v_revision_ids)
		or statement.source_observation_id = any(v_observation_ids);

	select product.product_name, product.brand_owner
	into v_product_name, v_brand_owner
	from public.shared_products product
	where product.id = any(v_product_ids)
	order by product.updated_at desc
	limit 1;

	select jsonb_build_object(
		'products', cardinality(v_product_ids),
		'submissions', cardinality(v_submission_ids),
		'revisions', cardinality(v_revision_ids),
		'observations', cardinality(v_observation_ids),
		'conflicts', cardinality(v_conflict_ids),
		'providerSnapshots', cardinality(v_snapshot_ids),
		'images', cardinality(v_image_ids),
		'warningReports', cardinality(v_feedback_ids),
		'apiCacheEntries', jsonb_array_length(v_cache_keys),
		'userListItems', (
			select count(*) from public.user_food_list_items item
			where item.shared_product_id = any(v_product_ids)
				or item.shared_product_submission_id = any(v_submission_ids)
				or item.food_identity_key = 'barcode:' || p_barcode
				or public.food_normalized_barcode(item.food) = p_barcode
		),
		'customFoods', (
			select count(*) from public.custom_foods food
			where food.barcode = p_barcode
				or public.food_normalized_barcode(food.food) = p_barcode
		),
		'savedMixes', (
			(select count(*) from public.saved_drinks saved
			where saved.drink::text like '%' || p_barcode || '%')
			+ (select count(*) from public.mix_preferences preference
			where preference.mix_state::text like '%' || p_barcode || '%')
		)
	)
	into v_counts;

	return jsonb_build_object(
		'normalizedBarcode', p_barcode,
		'found', (
			coalesce((v_counts ->> 'products')::integer, 0)
			+ coalesce((v_counts ->> 'submissions')::integer, 0)
			+ coalesce((v_counts ->> 'observations')::integer, 0)
			+ coalesce((v_counts ->> 'apiCacheEntries')::integer, 0)
			+ coalesce((v_counts ->> 'userListItems')::integer, 0)
			+ coalesce((v_counts ->> 'customFoods')::integer, 0)
			+ coalesce((v_counts ->> 'savedMixes')::integer, 0)
		) > 0,
		'productName', v_product_name,
		'brandOwner', v_brand_owner,
		'counts', v_counts,
		'targets', jsonb_build_object(
			'products', to_jsonb(v_product_ids),
			'submissions', to_jsonb(v_submission_ids),
			'revisions', to_jsonb(v_revision_ids),
			'observations', to_jsonb(v_observation_ids),
			'conflicts', to_jsonb(v_conflict_ids),
			'images', to_jsonb(v_image_ids),
			'warningReports', to_jsonb(v_feedback_ids),
			'providerSnapshots', to_jsonb(v_snapshot_ids),
			'ingredientComponents', to_jsonb(v_component_ids),
			'precautionaryStatements', to_jsonb(v_precaution_ids),
			'apiCacheEntries', v_cache_keys
		)
	);
end;
$$;

revoke all on function private.collect_catalog_product_purge_targets(text)
	from public, anon, authenticated;

create or replace function private.collect_catalog_product_purge_storage_paths(
	p_barcode text
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_preview jsonb;
	v_submission_ids uuid[] := '{}'::uuid[];
	v_image_ids uuid[] := '{}'::uuid[];
	v_paths text[] := '{}'::text[];
begin
	v_preview := private.collect_catalog_product_purge_targets(p_barcode);
	select coalesce(array_agg(value::uuid), '{}'::uuid[])
	into v_submission_ids
	from jsonb_array_elements_text(v_preview -> 'targets' -> 'submissions');
	select coalesce(array_agg(value::uuid), '{}'::uuid[])
	into v_image_ids
	from jsonb_array_elements_text(v_preview -> 'targets' -> 'images');

	select coalesce(array_agg(distinct path), '{}'::text[])
	into v_paths
	from (
		select evidence.value as path
		from public.shared_product_submissions submission
		cross join lateral jsonb_each_text(
			coalesce(submission.evidence_paths, '{}'::jsonb)
		) evidence
		where submission.id = any(v_submission_ids)
		union
		select image.storage_path as path
		from public.food_image_assets image
		where image.id = any(v_image_ids)
			and image.storage_path is not null
	) selected
	where path <> '';

	return v_paths;
end;
$$;

revoke all on function private.collect_catalog_product_purge_storage_paths(text)
	from public, anon, authenticated;

create or replace function private.run_catalog_product_purge(
	p_barcode text,
	p_requested_by uuid,
	p_request_source text,
	p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_preview jsonb;
	v_audit_id uuid;
	v_remaining_count bigint;
	v_product_ids uuid[] := '{}'::uuid[];
	v_submission_ids uuid[] := '{}'::uuid[];
	v_revision_ids uuid[] := '{}'::uuid[];
	v_observation_ids uuid[] := '{}'::uuid[];
	v_conflict_ids uuid[] := '{}'::uuid[];
	v_image_ids uuid[] := '{}'::uuid[];
	v_feedback_ids uuid[] := '{}'::uuid[];
	v_snapshot_ids uuid[] := '{}'::uuid[];
	v_component_ids uuid[] := '{}'::uuid[];
	v_precaution_ids uuid[] := '{}'::uuid[];
	v_cache_keys jsonb := '[]'::jsonb;
	v_previous_purge_setting text := current_setting(
		'blendcalc.catalog_product_purge',
		true
	);
begin
	p_reason := btrim(coalesce(p_reason, ''));
	if char_length(p_reason) < 10 or char_length(p_reason) > 1000 then
		raise exception using
			errcode = '22023',
			message = 'A deletion reason between 10 and 1000 characters is required.';
	end if;
	if position(p_barcode in p_reason) > 0 then
		raise exception using
			errcode = '22023',
			message = 'Do not include the UPC / GTIN in the audit reason.';
	end if;
	if p_request_source not in ('privileged_toolbar', 'operations_cli') then
		raise exception using
			errcode = '22023',
			message = 'The product purge request source is invalid.';
	end if;

	perform pg_advisory_xact_lock(hashtextextended('catalog-product-purge:' || p_barcode, 0));
	perform set_config('lock_timeout', '5s', true);
	perform set_config('statement_timeout', '60s', true);
	v_preview := private.collect_catalog_product_purge_targets(p_barcode);

	if not coalesce((v_preview ->> 'found')::boolean, false) then
		raise exception using
			errcode = 'P0002',
			message = 'No Supabase product records were found for this UPC / GTIN.';
	end if;

	select coalesce(array_agg(value::uuid), '{}'::uuid[])
	into v_product_ids
	from jsonb_array_elements_text(v_preview -> 'targets' -> 'products');
	select coalesce(array_agg(value::uuid), '{}'::uuid[])
	into v_submission_ids
	from jsonb_array_elements_text(v_preview -> 'targets' -> 'submissions');
	select coalesce(array_agg(value::uuid), '{}'::uuid[])
	into v_revision_ids
	from jsonb_array_elements_text(v_preview -> 'targets' -> 'revisions');
	select coalesce(array_agg(value::uuid), '{}'::uuid[])
	into v_observation_ids
	from jsonb_array_elements_text(v_preview -> 'targets' -> 'observations');
	select coalesce(array_agg(value::uuid), '{}'::uuid[])
	into v_conflict_ids
	from jsonb_array_elements_text(v_preview -> 'targets' -> 'conflicts');
	select coalesce(array_agg(value::uuid), '{}'::uuid[])
	into v_image_ids
	from jsonb_array_elements_text(v_preview -> 'targets' -> 'images');
	select coalesce(array_agg(value::uuid), '{}'::uuid[])
	into v_feedback_ids
	from jsonb_array_elements_text(v_preview -> 'targets' -> 'warningReports');
	select coalesce(array_agg(value::uuid), '{}'::uuid[])
	into v_snapshot_ids
	from jsonb_array_elements_text(v_preview -> 'targets' -> 'providerSnapshots');
	select coalesce(array_agg(value::uuid), '{}'::uuid[])
	into v_component_ids
	from jsonb_array_elements_text(v_preview -> 'targets' -> 'ingredientComponents');
	select coalesce(array_agg(value::uuid), '{}'::uuid[])
	into v_precaution_ids
	from jsonb_array_elements_text(v_preview -> 'targets' -> 'precautionaryStatements');
	v_cache_keys := v_preview -> 'targets' -> 'apiCacheEntries';

	perform set_config('blendcalc.catalog_product_purge', 'active', true);

	delete from public.product_compatibility_facts fact
	where fact.shared_product_id = any(v_product_ids)
		or fact.shared_product_observation_id = any(v_observation_ids)
		or fact.shared_product_submission_id = any(v_submission_ids)
		or fact.ingredient_component_id = any(v_component_ids)
		or fact.precautionary_statement_id = any(v_precaution_ids);

	delete from public.catalog_health_repair_runs run
	where run.mode = 'apply'
		and exists (select 1 from unnest(v_product_ids) product_id
			where run.occurrence_key like '%' || product_id::text || '%');
	delete from public.catalog_health_repair_runs run
	where exists (select 1 from unnest(v_product_ids) product_id
		where run.occurrence_key like '%' || product_id::text || '%');

	delete from public.catalog_correction_origins origin
	where origin.shared_product_id = any(v_product_ids)
		or origin.submission_id = any(v_submission_ids)
		or origin.base_revision_id = any(v_revision_ids)
		or origin.resolved_revision_id = any(v_revision_ids)
		or origin.shared_product_conflict_id = any(v_conflict_ids)
		or origin.food_compatibility_feedback_id = any(v_feedback_ids)
		or origin.provider_change_review_id in (
			select review.id from public.catalog_provider_change_reviews review
			where review.shared_product_id = any(v_product_ids)
				or review.snapshot_id = any(v_snapshot_ids)
				or review.accepted_revision_id = any(v_revision_ids)
		);

	delete from public.food_warning_policy_review_cases review_case
	where review_case.shared_product_id = any(v_product_ids)
		or review_case.feedback_id = any(v_feedback_ids);

	delete from public.blendcalc_api_publication_holds hold
	where hold.shared_product_id = any(v_product_ids)
		or hold.food_image_asset_id = any(v_image_ids)
		or hold.concern_id in (
			select concern.id from public.blendcalc_api_publication_concerns concern
			where concern.shared_product_id = any(v_product_ids)
				or concern.food_image_asset_id = any(v_image_ids)
		);

	delete from public.blendcalc_api_publication_concerns concern
	where concern.shared_product_id = any(v_product_ids)
		or concern.food_image_asset_id = any(v_image_ids)
		or concern.subject_reference like '%' || p_barcode || '%'
		or concern.details like '%' || p_barcode || '%';

	delete from public.catalog_health_review_dispositions disposition
	where disposition.shared_product_id = any(v_product_ids);

	delete from public.catalog_provider_change_reviews review
	where review.shared_product_id = any(v_product_ids)
		or review.snapshot_id = any(v_snapshot_ids)
		or review.accepted_revision_id = any(v_revision_ids);

	delete from public.food_compatibility_feedback feedback
	where feedback.id = any(v_feedback_ids);

	delete from public.official_food_safety_alert_matches alert_match
	where alert_match.shared_product_id = any(v_product_ids);

	delete from public.shared_product_field_provenance provenance
	where provenance.shared_product_id = any(v_product_ids)
		or provenance.observation_id = any(v_observation_ids);

	delete from public.shared_product_mass_volume_conversion_policies policy
	where policy.shared_product_id = any(v_product_ids)
		or policy.source_observation_id = any(v_observation_ids);

	delete from public.product_ingredient_statements statement
	where statement.shared_product_id = any(v_product_ids)
		or statement.shared_product_observation_id = any(v_observation_ids)
		or statement.shared_product_submission_id = any(v_submission_ids)
		or statement.source_observation_id = any(v_observation_ids);

	delete from public.product_precautionary_statements statement
	where statement.id = any(v_precaution_ids);

	delete from public.product_submission_blocks block
	where block.source_submission_id = any(v_submission_ids);

	update public.user_catalog_submission_enforcement enforcement
	set latest_rejected_submission_id = null
	where enforcement.latest_rejected_submission_id = any(v_submission_ids);

	delete from public.catalog_provider_product_snapshots snapshot
	where snapshot.id = any(v_snapshot_ids);

	delete from public.user_food_list_items item
	where item.shared_product_id = any(v_product_ids)
		or item.shared_product_submission_id = any(v_submission_ids)
		or item.food_identity_key = 'barcode:' || p_barcode
		or public.food_normalized_barcode(item.food) = p_barcode;

	delete from public.custom_foods food
	where food.barcode = p_barcode
		or public.food_normalized_barcode(food.food) = p_barcode;

	delete from public.mix_preferences preference
	where preference.mix_state::text like '%' || p_barcode || '%';
	delete from public.saved_drinks saved
	where saved.drink::text like '%' || p_barcode || '%';

	update public.shared_product_revisions revision
	set submission_id = null,
		supersedes_revision_id = null
	where revision.id = any(v_revision_ids);

	delete from public.shared_product_submissions submission
	where submission.id = any(v_submission_ids);

	delete from public.shared_products product
	where product.id = any(v_product_ids);

	delete from public.shared_product_revisions revision
	where revision.id = any(v_revision_ids);
	delete from public.shared_product_conflicts conflict
	where conflict.id = any(v_conflict_ids);
	delete from public.food_image_assets image
	where image.id = any(v_image_ids);
	delete from public.shared_product_observations observation
	where observation.id = any(v_observation_ids);

	delete from public.product_api_request_leases lease
	where exists (
		select 1
		from jsonb_array_elements(v_cache_keys) target
		where lease.provider = target ->> 'provider'
			and lease.cache_key = target ->> 'cacheKey'
	);
	delete from public.product_api_cache cache
	where exists (
		select 1
		from jsonb_array_elements(v_cache_keys) target
		where cache.provider = target ->> 'provider'
			and cache.cache_key = target ->> 'cacheKey'
	);

	delete from public.product_source_field_coverage coverage
	where coverage.barcode = p_barcode;
	delete from public.catalog_intake_requests request
	where coalesce(request.response_body::text, '') like '%' || p_barcode || '%';
	delete from public.custom_food_category_observations observation
	where observation.query = p_barcode
		or coalesce(observation.source_reference, '') = p_barcode
		or observation.source_payload::text like '%' || p_barcode || '%';
	delete from public.food_preference_api_observations observation
	where observation.query = p_barcode
		or coalesce(observation.source_reference, '') = p_barcode
		or observation.source_payload::text like '%' || p_barcode || '%';
	delete from public.nutrient_manual_entry_observations observation
	where observation.query = p_barcode
		or observation.source_reference = p_barcode
		or observation.source_payload::text like '%' || p_barcode || '%';

	select
		(select count(*) from public.shared_products where barcode = p_barcode)
		+ (select count(*) from public.shared_product_submissions where barcode = p_barcode)
		+ (select count(*) from public.shared_product_observations where barcode = p_barcode)
		+ (select count(*) from public.shared_product_conflicts where barcode = p_barcode)
		+ (select count(*) from public.food_image_assets where barcode = p_barcode)
		+ (select count(*) from public.custom_foods where barcode = p_barcode)
		+ (select count(*) from public.product_source_field_coverage where barcode = p_barcode)
	into v_remaining_count;

	if v_remaining_count <> 0 then
		raise exception
			'Product purge rolled back because % primary barcode records remain',
			v_remaining_count;
	end if;

	perform set_config(
		'blendcalc.catalog_product_purge',
		coalesce(v_previous_purge_setting, ''),
		true
	);

	insert into public.catalog_product_purge_audit (
		requested_by,
		request_source,
		reason,
		deletion_summary
	)
	values (
		p_requested_by,
		p_request_source,
		p_reason,
		v_preview -> 'counts'
	)
	returning id into v_audit_id;

	return jsonb_build_object(
		'purgeId', v_audit_id,
		'normalizedBarcode', p_barcode,
		'deleted', true,
		'counts', v_preview -> 'counts'
	);
end;
$$;

revoke all on function private.run_catalog_product_purge(
	text, uuid, text, text
) from public, anon, authenticated;

create or replace function public.set_shared_product_category_from_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if current_user = 'postgres'
		and current_setting('blendcalc.catalog_product_purge', true) = 'active'
		and new.approved_submission_id is null then
		return new;
	end if;

	select submission.category_option_id
	into new.category_option_id
	from public.shared_product_submissions submission
	where submission.id = new.approved_submission_id;

	if new.category_option_id is null then
		raise exception 'A canonical food category is required before publishing a shared product';
	end if;

	return new;
end;
$$;

create or replace function public.preserve_shared_product_update_proposal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if current_user = 'postgres'
		and current_setting('blendcalc.catalog_product_purge', true) = 'active' then
		return case when tg_op = 'DELETE' then old else new end;
	end if;

	if tg_op = 'DELETE' then
		if old.submission_kind = 'product_update' then
			raise exception 'Catalog update proposals are immutable';
		end if;
		return old;
	end if;

	if old.submission_kind = 'product_update'
		or new.submission_kind = 'product_update' then
		if old.id is distinct from new.id
		or old.submitted_by is distinct from new.submitted_by
		or old.barcode is distinct from new.barcode
		or old.product_name is distinct from new.product_name
		or old.brand_owner is distinct from new.brand_owner
		or old.category_option_id is distinct from new.category_option_id
		or old.food is distinct from new.food
		or old.consent_to_share is distinct from new.consent_to_share
		or old.submission_kind is distinct from new.submission_kind
		or old.submission_intent is distinct from new.submission_intent
		or old.target_shared_product_id is distinct from new.target_shared_product_id
		or old.base_revision_id is distinct from new.base_revision_id
		or old.change_summary is distinct from new.change_summary
		or old.label_observed_at is distinct from new.label_observed_at
		or old.matched_source is distinct from new.matched_source
		or old.matched_reference is distinct from new.matched_reference
		or old.validation_report is distinct from new.validation_report
		or old.evidence_paths is distinct from new.evidence_paths
		or old.evidence_complete is distinct from new.evidence_complete
		or old.created_at is distinct from new.created_at then
			raise exception 'Catalog update proposal fields are immutable';
		end if;
	end if;

	return new;
end;
$$;

create or replace function public.prevent_immutable_catalog_monitor_evidence_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if tg_table_name = 'catalog_provider_product_snapshots'
		and current_user = 'postgres'
		and current_setting('blendcalc.catalog_product_purge', true) = 'active' then
		return case when tg_op = 'DELETE' then old else new end;
	end if;

	raise exception 'Catalog monitor evidence is immutable';
end;
$$;

create or replace function public.preview_catalog_product_purge(
	p_barcode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_barcode text;
begin
	if not private.catalog_product_purge_access_allowed() then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog repair access is required.';
	end if;
	v_barcode := private.normalize_catalog_product_purge_barcode(p_barcode);
	return private.collect_catalog_product_purge_targets(v_barcode) - 'targets';
end;
$$;

create or replace function public.purge_catalog_product_by_barcode(
	p_barcode text,
	p_confirmation_barcode text,
	p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_barcode text;
	v_confirmation_barcode text;
begin
	if not private.catalog_product_purge_access_allowed() then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog repair access is required.';
	end if;
	v_barcode := private.normalize_catalog_product_purge_barcode(p_barcode);
	v_confirmation_barcode :=
		private.normalize_catalog_product_purge_barcode(p_confirmation_barcode);
	if v_confirmation_barcode <> v_barcode then
		raise exception using
			errcode = '22023',
			message = 'The confirmation UPC / GTIN does not match.';
	end if;
	return private.run_catalog_product_purge(
		v_barcode,
		auth.uid(),
		'privileged_toolbar',
		p_reason
	);
end;
$$;

create or replace function public.service_preview_catalog_product_purge(
	p_barcode text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
	select private.collect_catalog_product_purge_targets(
		private.normalize_catalog_product_purge_barcode(p_barcode)
	) - 'targets';
$$;

create or replace function public.service_catalog_product_purge_storage_paths(
	p_barcode text
)
returns text[]
language sql
security definer
set search_path = ''
as $$
	select private.collect_catalog_product_purge_storage_paths(
		private.normalize_catalog_product_purge_barcode(p_barcode)
	);
$$;

create or replace function public.service_purge_catalog_product_by_barcode(
	p_barcode text,
	p_confirmation_barcode text,
	p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_barcode text;
begin
	v_barcode := private.normalize_catalog_product_purge_barcode(p_barcode);
	if private.normalize_catalog_product_purge_barcode(p_confirmation_barcode)
		<> v_barcode then
		raise exception using
			errcode = '22023',
			message = 'The confirmation UPC / GTIN does not match.';
	end if;
	return private.run_catalog_product_purge(
		v_barcode,
		null,
		'operations_cli',
		p_reason
	);
end;
$$;

revoke all on function public.preview_catalog_product_purge(text)
	from public, anon, authenticated, service_role;
grant execute on function public.preview_catalog_product_purge(text)
	to authenticated;

revoke all on function public.purge_catalog_product_by_barcode(text, text, text)
	from public, anon, authenticated, service_role;
grant execute on function public.purge_catalog_product_by_barcode(text, text, text)
	to authenticated;

revoke all on function public.service_preview_catalog_product_purge(text)
	from public, anon, authenticated, service_role;
grant execute on function public.service_preview_catalog_product_purge(text)
	to service_role;

revoke all on function public.service_catalog_product_purge_storage_paths(text)
	from public, anon, authenticated, service_role;
grant execute on function public.service_catalog_product_purge_storage_paths(text)
	to service_role;

revoke all on function public.service_purge_catalog_product_by_barcode(
	text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.service_purge_catalog_product_by_barcode(
	text, text, text
) to service_role;

comment on function public.preview_catalog_product_purge(text) is
	'Previews the exact catalog, moderation, cache, and user-owned records selected by an MFA-verified UPC purge without changing data.';
comment on function public.purge_catalog_product_by_barcode(text, text, text) is
	'Atomically deletes the previewed Supabase database graph for one confirmed UPC and writes a non-identifying audit summary.';
comment on function public.service_preview_catalog_product_purge(text) is
	'Service-role preview used by the maintained catalog product purge CLI.';
comment on function public.service_catalog_product_purge_storage_paths(text) is
	'Service-role lookup for private evidence files selected by an exact UPC purge.';
comment on function public.service_purge_catalog_product_by_barcode(text, text, text) is
	'Service-role apply operation used by the maintained catalog product purge CLI.';
