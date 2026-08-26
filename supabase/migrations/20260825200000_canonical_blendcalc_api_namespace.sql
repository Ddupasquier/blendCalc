alter table public.api_publication_concerns
	rename to blendcalc_api_publication_concerns;

alter table public.api_publication_holds
	rename to blendcalc_api_publication_holds;

do $$
declare
	constraint_record record;
begin
	for constraint_record in
		select constraint_name.conname
		from pg_catalog.pg_constraint constraint_name
		where constraint_name.conrelid in (
			'public.blendcalc_api_publication_concerns'::regclass,
			'public.blendcalc_api_publication_holds'::regclass
		)
			and constraint_name.conname like 'api_publication_%'
	loop
		execute format(
			'alter table %s rename constraint %I to %I',
			case when constraint_record.conname like 'api_publication_concerns%'
				then 'public.blendcalc_api_publication_concerns'
				else 'public.blendcalc_api_publication_holds'
			end,
			constraint_record.conname,
			'blendcalc_' || constraint_record.conname
		);
	end loop;
end;
$$;

do $$
declare
	index_record record;
begin
	for index_record in
		select index_name.relname
		from pg_catalog.pg_class index_name
		join pg_catalog.pg_index index_definition
			on index_definition.indexrelid = index_name.oid
		where index_definition.indrelid in (
			'public.blendcalc_api_publication_concerns'::regclass,
			'public.blendcalc_api_publication_holds'::regclass
		)
			and index_name.relname like 'api_publication_%'
	loop
		execute format(
			'alter index public.%I rename to %I',
			index_record.relname,
			'blendcalc_' || index_record.relname
		);
	end loop;
end;
$$;

alter trigger set_api_publication_concerns_updated_at
	on public.blendcalc_api_publication_concerns
	rename to set_blendcalc_api_publication_concerns_updated_at;

alter trigger validate_api_publication_concern_resolution
	on public.blendcalc_api_publication_concerns
	rename to validate_blendcalc_api_publication_concern_resolution;

alter trigger set_api_publication_holds_updated_at
	on public.blendcalc_api_publication_holds
	rename to set_blendcalc_api_publication_holds_updated_at;

alter trigger validate_api_publication_hold_concern_target
	on public.blendcalc_api_publication_holds
	rename to validate_blendcalc_api_publication_hold_concern_target;

alter trigger sync_api_product_publication_hold_conflict
	on public.blendcalc_api_publication_holds
	rename to sync_blendcalc_api_product_publication_hold_conflict;

alter function public.are_api_concern_evidence_urls_valid(text[])
	rename to blendcalc_api_publication_concern_evidence_urls_are_valid;

alter function public.validate_api_publication_hold_concern_target()
	rename to validate_blendcalc_api_publication_hold_concern_target;

alter function public.validate_api_publication_concern_resolution()
	rename to validate_blendcalc_api_publication_concern_resolution;

alter function public.sync_product_publication_hold_conflict()
	rename to sync_blendcalc_api_product_publication_hold_conflict;

create view public.api_publication_concerns
with (security_invoker = true)
as
select *
from public.blendcalc_api_publication_concerns;

create view public.api_publication_holds
with (security_invoker = true)
as
select *
from public.blendcalc_api_publication_holds;

revoke all on table public.api_publication_concerns
	from public, anon, authenticated;
revoke all on table public.api_publication_holds
	from public, anon, authenticated;
grant select, insert, update, delete on table public.api_publication_concerns
	to service_role;
grant select, insert, update, delete on table public.api_publication_holds
	to service_role;

alter function public.get_blendcalc_product_v1(text)
	rename to get_blendcalc_api_product_v1;

alter function public.search_blendcalc_products_v1(text, text[], integer, integer)
	rename to search_blendcalc_api_products_v1;

alter function public.get_blendcalc_product_revision_history_v1(text, integer, integer)
	rename to get_blendcalc_api_product_revision_history_v1;

alter function public.get_catalog_product_readiness_passport(uuid)
	set schema private;

alter function private.get_catalog_product_readiness_passport(uuid)
	rename to build_catalog_product_readiness_passport;

revoke all on function private.build_catalog_product_readiness_passport(uuid)
	from public, anon, authenticated, service_role;

create function public.get_blendcalc_product_v1(
	p_barcode text
)
returns table (
	id uuid,
	barcode text,
	product_name text,
	brand_owner text,
	category_option_id text,
	compatibility_summary jsonb,
	canonical_provenance jsonb,
	food jsonb,
	source text,
	source_reference text,
	confidence text,
	created_at timestamptz,
	updated_at timestamptz,
	last_verified_at timestamptz,
	current_revision_id uuid,
	current_revision_number integer,
	revision_created_at timestamptz,
	label_observed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
	select *
	from public.get_blendcalc_api_product_v1(p_barcode);
$$;

create function public.search_blendcalc_products_v1(
	p_query text,
	p_terms text[],
	p_limit integer default 15,
	p_offset integer default 0
)
returns table (
	id uuid,
	barcode text,
	product_name text,
	brand_owner text,
	category_option_id text,
	compatibility_summary jsonb,
	canonical_provenance jsonb,
	food jsonb,
	source text,
	source_reference text,
	confidence text,
	created_at timestamptz,
	updated_at timestamptz,
	last_verified_at timestamptz,
	current_revision_id uuid,
	current_revision_number integer,
	revision_created_at timestamptz,
	label_observed_at timestamptz,
	total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
	select *
	from public.search_blendcalc_api_products_v1(
		p_query,
		p_terms,
		p_limit,
		p_offset
	);
$$;

create function public.get_blendcalc_product_revision_history_v1(
	p_barcode text,
	p_limit integer default 25,
	p_offset integer default 0
)
returns table (
	id uuid,
	revision_number integer,
	published_at timestamptz,
	label_observed_at timestamptz,
	changes jsonb,
	total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
	select *
	from public.get_blendcalc_api_product_revision_history_v1(
		p_barcode,
		p_limit,
		p_offset
	);
$$;

revoke all on function public.get_blendcalc_api_product_v1(text)
	from public, anon, authenticated;
revoke all on function public.search_blendcalc_api_products_v1(
	text,
	text[],
	integer,
	integer
) from public, anon, authenticated;
revoke all on function public.get_blendcalc_api_product_revision_history_v1(
	text,
	integer,
	integer
) from public, anon, authenticated;
grant execute on function public.get_blendcalc_api_product_v1(text)
	to service_role;
grant execute on function public.search_blendcalc_api_products_v1(
	text,
	text[],
	integer,
	integer
) to service_role;
grant execute on function public.get_blendcalc_api_product_revision_history_v1(
	text,
	integer,
	integer
) to service_role;

revoke all on function public.get_blendcalc_product_v1(text)
	from public, anon, authenticated;
revoke all on function public.search_blendcalc_products_v1(
	text,
	text[],
	integer,
	integer
) from public, anon, authenticated;
revoke all on function public.get_blendcalc_product_revision_history_v1(
	text,
	integer,
	integer
) from public, anon, authenticated;
grant execute on function public.get_blendcalc_product_v1(text)
	to service_role;
grant execute on function public.search_blendcalc_products_v1(
	text,
	text[],
	integer,
	integer
) to service_role;
grant execute on function public.get_blendcalc_product_revision_history_v1(
	text,
	integer,
	integer
) to service_role;

insert into public.nutrition_completeness_profiles (
	key,
	display_name,
	food_scope,
	region_code,
	complete_label,
	resolved_label,
	partial_label,
	limited_label,
	description,
	source_key,
	source_reference,
	is_default,
	enabled,
	assessment_policy_key,
	required_nutrient_weight,
	recommended_nutrient_weight,
	exact_source_score,
	mapped_source_score,
	derived_source_score,
	missing_source_score,
	partial_minimum_ratio
)
select
	'blendcalc-api-v1-packaged-core-v1',
	'blendCalcAPI v1 packaged-food core',
	food_scope,
	region_code,
	complete_label,
	resolved_label,
	partial_label,
	limited_label,
	replace(description, 'blendCalc API', 'blendCalcAPI'),
	source_key,
	replace(source_reference, 'blendCalc API', 'blendCalcAPI'),
	false,
	true,
	assessment_policy_key,
	required_nutrient_weight,
	recommended_nutrient_weight,
	exact_source_score,
	mapped_source_score,
	derived_source_score,
	missing_source_score,
	partial_minimum_ratio
from public.nutrition_completeness_profiles
where key = 'api-v1-packaged-core-v1'
on conflict (key) do update
set
	display_name = excluded.display_name,
	description = excluded.description,
	source_reference = excluded.source_reference,
	enabled = true;

insert into public.nutrition_completeness_profile_nutrients (
	profile_key,
	nutrient_id,
	requirement_level,
	display_order,
	reason
)
select
	'blendcalc-api-v1-packaged-core-v1',
	nutrient_id,
	requirement_level,
	display_order,
	reason
from public.nutrition_completeness_profile_nutrients
where profile_key = 'api-v1-packaged-core-v1'
on conflict (profile_key, nutrient_id) do update
set
	requirement_level = excluded.requirement_level,
	display_order = excluded.display_order,
	reason = excluded.reason;

update public.blendcalc_api_publication_profiles
set
	is_default = false,
	enabled = false
where key = 'api-v1-packaged-product-v1';

insert into public.blendcalc_api_publication_profiles (
	key,
	api_major,
	policy_version,
	resource_scope,
	display_name,
	description,
	nutrition_profile_key,
	required_field_paths,
	recommended_field_paths,
	require_valid_gtin,
	require_primary_serving,
	require_canonical_nutrient_mapping,
	minimum_allergen_evidence,
	accepted_nutrient_value_statuses,
	blocked_conflict_severities,
	max_verification_age_days,
	source_key,
	source_reference,
	reviewed_at,
	is_default,
	enabled
)
select
	'blendcalc-api-v1-packaged-product-v1',
	api_major,
	policy_version,
	resource_scope,
	'blendCalcAPI v1 packaged product',
	replace(description, 'public API', 'blendCalcAPI'),
	'blendcalc-api-v1-packaged-core-v1',
	required_field_paths,
	recommended_field_paths,
	require_valid_gtin,
	require_primary_serving,
	require_canonical_nutrient_mapping,
	minimum_allergen_evidence,
	accepted_nutrient_value_statuses,
	blocked_conflict_severities,
	max_verification_age_days,
	source_key,
	replace(source_reference, 'blendCalc API', 'blendCalcAPI'),
	reviewed_at,
	true,
	true
from public.blendcalc_api_publication_profiles
where key = 'api-v1-packaged-product-v1'
on conflict (key) do update
set
	display_name = excluded.display_name,
	description = excluded.description,
	nutrition_profile_key = excluded.nutrition_profile_key,
	source_reference = excluded.source_reference,
	is_default = true,
	enabled = true;

update public.nutrition_completeness_profiles
set enabled = false
where key = 'api-v1-packaged-core-v1';

do $$
declare
	occurrence_view_definition text;
begin
	select pg_get_viewdef(
		'public.catalog_health_issue_occurrences'::regclass,
		true
	)
	into occurrence_view_definition;

	if position('''api_publication''::text' in occurrence_view_definition) = 0 then
		raise exception
			'catalog_health_issue_occurrences no longer contains the expected API publication scope';
	end if;

	execute
		'create or replace view public.catalog_health_issue_occurrences as ' ||
		replace(
			occurrence_view_definition,
			'''api_publication''::text',
			'''blendcalc_api_publication''::text'
		);
end;
$$;

create view public.blendcalc_api_catalog_product_readiness
with (security_invoker = true)
as
select
	readiness.shared_product_id,
	readiness.barcode,
	readiness.product_name,
	readiness.brand_owner,
	readiness.shared_catalog_status,
	readiness.api_v1_status as blendcalc_api_v1_status,
	readiness.searchable_in_blendcalc,
	readiness.usable_in_blendcalc,
	readiness.api_v1_withholding_reasons as blendcalc_api_v1_withholding_reasons,
	readiness.open_material_conflict_count,
	readiness.pending_correction_count,
	readiness.current_revision_id,
	readiness.current_revision_number,
	readiness.current_label_observed_at,
	readiness.last_verified_at,
	readiness.updated_at
from public.catalog_product_readiness readiness;

revoke all on table public.blendcalc_api_catalog_product_readiness
	from public, anon, authenticated;
grant select on table public.blendcalc_api_catalog_product_readiness
	to service_role;

create function public.get_blendcalc_api_catalog_product_readiness_passport(
	p_shared_product_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	with passport as (
		select private.build_catalog_product_readiness_passport(
			p_shared_product_id
		) as value
	)
	select jsonb_set(
		passport.value,
		'{product}',
		((passport.value -> 'product') - 'apiV1Status'::text) || jsonb_build_object(
			'blendCalcAPIV1Status',
			passport.value #> '{product,apiV1Status}'::text[]
		)
	)
	from passport;
$$;

create function public.get_catalog_product_readiness_passport(
	p_shared_product_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select private.build_catalog_product_readiness_passport(
		p_shared_product_id
	);
$$;

revoke all on function public.get_blendcalc_api_catalog_product_readiness_passport(uuid)
	from public, anon, authenticated, service_role;
grant execute on function public.get_blendcalc_api_catalog_product_readiness_passport(uuid)
	to authenticated;

revoke all on function public.get_catalog_product_readiness_passport(uuid)
	from public, anon, authenticated, service_role;
grant execute on function public.get_catalog_product_readiness_passport(uuid)
	to authenticated;

comment on table public.blendcalc_api_publication_concerns is
	'Private evidence-backed concerns about blendCalcAPI publication, attribution, privacy, source policy, or rights.';
comment on table public.blendcalc_api_publication_holds is
	'Reversible blendCalcAPI publication holds for one product, image, dataset release, or source.';
comment on view public.api_publication_concerns is
	'Temporary rollout compatibility alias for blendcalc_api_publication_concerns. Remove after all deployed callers use the canonical relation.';
comment on view public.api_publication_holds is
	'Temporary rollout compatibility alias for blendcalc_api_publication_holds. Remove after all deployed callers use the canonical relation.';
comment on function public.get_blendcalc_api_product_v1(text) is
	'Returns one publication-ready blendCalcAPI v1 product by exact GTIN.';
comment on function public.search_blendcalc_api_products_v1(text, text[], integer, integer) is
	'Searches publication-ready blendCalcAPI v1 products using normalized partial terms and field-aware relevance.';
comment on function public.get_blendcalc_api_product_revision_history_v1(text, integer, integer) is
	'Returns public revision history for one publication-ready blendCalcAPI v1 product.';
comment on function public.get_blendcalc_product_v1(text) is
	'Temporary rollout compatibility wrapper for get_blendcalc_api_product_v1.';
comment on function public.search_blendcalc_products_v1(text, text[], integer, integer) is
	'Temporary rollout compatibility wrapper for search_blendcalc_api_products_v1.';
comment on function public.get_blendcalc_product_revision_history_v1(text, integer, integer) is
	'Temporary rollout compatibility wrapper for get_blendcalc_api_product_revision_history_v1.';
comment on view public.blendcalc_api_catalog_product_readiness is
	'Canonical blendCalcAPI publication status projection over shared catalog readiness.';
comment on function public.get_blendcalc_api_catalog_product_readiness_passport(uuid) is
	'Returns the catalog readiness passport with canonical blendCalcAPI status naming.';
comment on function public.get_catalog_product_readiness_passport(uuid) is
	'Temporary rollout compatibility wrapper for get_blendcalc_api_catalog_product_readiness_passport.';
comment on function private.build_catalog_product_readiness_passport(uuid) is
	'Builds one bounded shared-catalog and blendCalcAPI readiness passport after exact AAL2 authorization. Direct execution is revoked.';
