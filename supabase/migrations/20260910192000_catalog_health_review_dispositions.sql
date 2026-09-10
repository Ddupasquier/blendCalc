create table public.catalog_health_review_dispositions (
	id uuid primary key default gen_random_uuid(),
	shared_product_id uuid not null
		references public.shared_products(id) on delete restrict,
	issue_fingerprint text not null check (issue_fingerprint ~ '^[0-9a-f]{32}$'),
	outcome text not null check (outcome = 'accepted_withheld'),
	review_note text not null check (
		char_length(btrim(review_note)) between 10 and 2000
		and review_note = btrim(review_note)
	),
	issue_count integer not null check (issue_count > 0),
	issue_snapshot jsonb not null check (jsonb_typeof(issue_snapshot) = 'array'),
	reviewed_by uuid not null references auth.users(id) on delete restrict,
	reviewed_at timestamptz not null default now(),
	unique (shared_product_id, issue_fingerprint, outcome)
);

create index catalog_health_review_dispositions_product_idx
	on public.catalog_health_review_dispositions (
		shared_product_id,
		reviewed_at desc
	);

alter table public.catalog_health_review_dispositions enable row level security;
alter table public.catalog_health_review_dispositions force row level security;

revoke all on table public.catalog_health_review_dispositions
	from public, anon, authenticated;
grant select, insert on table public.catalog_health_review_dispositions
	to service_role;

create function private.catalog_health_product_issue_fingerprint(
	p_shared_product_id uuid
)
returns text
language sql
stable
set search_path = ''
as $$
	select md5(string_agg(
		occurrence.occurrence_key || ':' || occurrence.detected_at::text,
		chr(10)
		order by occurrence.occurrence_key))
	from public.catalog_health_issue_occurrences occurrence
	where occurrence.shared_product_id = p_shared_product_id
		and occurrence.source_scope = 'blendcalc_api_publication'
		and occurrence.status = 'open';
$$;

revoke all on function private.catalog_health_product_issue_fingerprint(uuid)
	from public, anon, authenticated;
grant execute on function private.catalog_health_product_issue_fingerprint(uuid)
	to service_role;

create view public.catalog_health_actionable_issue_occurrences
with (security_invoker = true)
as
select occurrence.*
from public.catalog_health_issue_occurrences occurrence
where occurrence.source_scope <> 'blendcalc_api_publication'
	or occurrence.shared_product_id is null
	or not exists (
		select 1
		from public.catalog_health_review_dispositions disposition
		where disposition.shared_product_id = occurrence.shared_product_id
			and disposition.outcome = 'accepted_withheld'
			and disposition.issue_fingerprint =
				private.catalog_health_product_issue_fingerprint(
					occurrence.shared_product_id
				)
	);

revoke all on table public.catalog_health_actionable_issue_occurrences
	from public, anon, authenticated;
grant select on table public.catalog_health_actionable_issue_occurrences
	to service_role;

create function public.finish_catalog_health_product_review(
	p_shared_product_id uuid,
	p_review_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_issue_fingerprint text;
	v_issue_snapshot jsonb;
	v_issue_count integer;
	v_unchecked_repair_count integer;
	v_reviewed_at timestamptz;
begin
	if not public.authorize_app_permission(
		'data_operations.catalog_health.repair'
	) then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog repair access is required.';
	end if;

	p_review_note := btrim(coalesce(p_review_note, ''));
	if char_length(p_review_note) < 10 or char_length(p_review_note) > 2000 then
		raise exception using
			errcode = '22023',
			message = 'A review note between 10 and 2000 characters is required.';
	end if;

	if not exists (
		select 1
		from public.shared_products product
		where product.id = p_shared_product_id
	) then
		raise exception using
			errcode = 'P0002',
			message = 'Catalog product was not found.';
	end if;

	v_issue_fingerprint :=
		private.catalog_health_product_issue_fingerprint(p_shared_product_id);

	if v_issue_fingerprint is null then
		raise exception using
			errcode = 'P0002',
			message = 'This product has no current blendCalcAPI review work.';
	end if;

	if exists (
		select 1
		from public.catalog_health_review_dispositions disposition
		where disposition.shared_product_id = p_shared_product_id
			and disposition.issue_fingerprint = v_issue_fingerprint
			and disposition.outcome = 'accepted_withheld'
	) then
		raise exception using
			errcode = 'P0002',
			message = 'This product review is already finished.';
	end if;

	select count(*)::integer
	into v_unchecked_repair_count
	from public.catalog_health_actionable_issue_occurrences occurrence
	join public.app_issue_codes issue on issue.code = occurrence.issue_code
	where occurrence.shared_product_id = p_shared_product_id
		and occurrence.source_scope = 'blendcalc_api_publication'
		and occurrence.status = 'open'
		and issue.enabled
		and issue.automated_repair_allowed
		and nullif(btrim(issue.automated_repair_key), '') is not null
		and not exists (
			select 1
			from public.catalog_health_repair_runs repair_run
			where repair_run.requested_by = (select auth.uid())
				and repair_run.occurrence_key = occurrence.occurrence_key
				and repair_run.repair_key = issue.automated_repair_key
				and repair_run.mode = 'dry_run'
				and repair_run.status in (
					'completed',
					'completed_with_unresolved'
				)
				and repair_run.candidate_count = 0
				and repair_run.started_at >= occurrence.detected_at
		);

	if v_unchecked_repair_count > 0 then
		raise exception using
			errcode = 'P0001',
			message = 'Run every available safe repair check before finishing this review.';
	end if;

	select
		count(*)::integer,
		coalesce(jsonb_agg(jsonb_build_object(
			'occurrenceKey', occurrence.occurrence_key,
			'issueCode', occurrence.issue_code,
			'sourceReason', occurrence.source_reason,
			'parameters', occurrence.parameters,
			'detectedAt', occurrence.detected_at
		) order by occurrence.occurrence_key), '[]'::jsonb)
	into v_issue_count, v_issue_snapshot
	from public.catalog_health_actionable_issue_occurrences occurrence
	where occurrence.shared_product_id = p_shared_product_id
		and occurrence.source_scope = 'blendcalc_api_publication'
		and occurrence.status = 'open';

	if v_issue_count = 0 then
		raise exception using
			errcode = 'P0002',
			message = 'This product has no current blendCalcAPI review work.';
	end if;

	insert into public.catalog_health_review_dispositions (
		shared_product_id,
		issue_fingerprint,
		outcome,
		review_note,
		issue_count,
		issue_snapshot,
		reviewed_by
	)
	values (
		p_shared_product_id,
		v_issue_fingerprint,
		'accepted_withheld',
		p_review_note,
		v_issue_count,
		v_issue_snapshot,
		(select auth.uid())
	)
	returning reviewed_at into v_reviewed_at;

	return jsonb_build_object(
		'outcome', 'accepted_withheld',
		'issueCount', v_issue_count,
		'reviewedAt', v_reviewed_at
	);
end;
$$;

revoke all on function public.finish_catalog_health_product_review(uuid, text)
	from public, anon, authenticated, service_role;
grant execute on function public.finish_catalog_health_product_review(uuid, text)
	to authenticated;

create or replace function public.get_blendcalc_api_catalog_product_readiness_passport(
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
	),
	current_fingerprint as (
		select private.catalog_health_product_issue_fingerprint(
			p_shared_product_id
		) as value
	),
	current_disposition as (
		select disposition.*
		from public.catalog_health_review_dispositions disposition
		join current_fingerprint fingerprint
			on fingerprint.value = disposition.issue_fingerprint
		where disposition.shared_product_id = p_shared_product_id
			and disposition.outcome = 'accepted_withheld'
		order by disposition.reviewed_at desc
		limit 1
	),
	actionable_issues as (
		select coalesce(jsonb_agg(
			case
				when issue.value ->> 'sourceReason'
					like 'missing_required_nutrient:%'
					and nutrient.nutrient_name is not null
				then jsonb_set(
					issue.value,
					'{parameters}',
					coalesce(issue.value -> 'parameters', '{}'::jsonb)
						|| jsonb_build_object(
							'displayName', nutrient.nutrient_name
						),
					true
				)
				else issue.value
			end
			order by issue.ordinality
		), '[]'::jsonb) as value
		from passport
		cross join lateral jsonb_array_elements(
			passport.value -> 'issues'
		) with ordinality as issue(value, ordinality)
		left join public.nutrient_definitions nutrient
			on nutrient.nutrient_id = case
				when issue.value ->> 'sourceReason'
					~ '^missing_required_nutrient:[0-9]+$'
				then split_part(
					issue.value ->> 'sourceReason', ':', 2
				)::bigint
				else null
			end
		where exists (
			select 1
			from public.catalog_health_actionable_issue_occurrences occurrence
			where occurrence.occurrence_key = issue.value ->> 'occurrenceKey'
			)
	),
	review_completion as (
		select
			count(*) filter (
				where issue.automated_repair_allowed
					and nullif(btrim(issue.automated_repair_key), '') is not null
			)::integer as required_check_count,
			count(*) filter (
				where issue.automated_repair_allowed
					and nullif(btrim(issue.automated_repair_key), '') is not null
					and exists (
						select 1
						from public.catalog_health_repair_runs repair_run
						where repair_run.requested_by = (select auth.uid())
							and repair_run.occurrence_key = occurrence.occurrence_key
							and repair_run.repair_key = issue.automated_repair_key
							and repair_run.mode = 'dry_run'
							and repair_run.status in (
								'completed',
								'completed_with_unresolved'
							)
							and repair_run.candidate_count = 0
							and repair_run.started_at >= occurrence.detected_at
					)
			)::integer as completed_check_count,
			count(*)::integer as issue_count
		from public.catalog_health_actionable_issue_occurrences occurrence
		join public.app_issue_codes issue on issue.code = occurrence.issue_code
		where occurrence.shared_product_id = p_shared_product_id
			and occurrence.source_scope = 'blendcalc_api_publication'
			and occurrence.status = 'open'
			and issue.enabled
	)
	select jsonb_set(
		jsonb_set(
			passport.value,
			'{product}',
			((passport.value -> 'product') - 'apiV1Status'::text)
				|| jsonb_build_object(
					'blendCalcAPIV1Status',
					passport.value #> '{product,apiV1Status}'::text[]
				)
		),
		'{issues}',
		actionable_issues.value
	) || jsonb_build_object(
		'reviewCompletion', jsonb_build_object(
			'requiredSafeRepairCheckCount', completion.required_check_count,
			'completedSafeRepairCheckCount', completion.completed_check_count,
			'canFinish', completion.issue_count > 0
				and completion.completed_check_count = completion.required_check_count
		),
		'reviewDisposition', case
			when disposition.id is null then null
			else jsonb_build_object(
				'outcome', disposition.outcome,
				'reviewNote', disposition.review_note,
				'issueCount', disposition.issue_count,
				'reviewedAt', disposition.reviewed_at
			)
		end
	)
	from passport
	cross join actionable_issues
	cross join review_completion completion
	left join current_disposition disposition on true;
$$;

create or replace function public.get_privileged_tool_action_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_role public.app_role;
	v_can_manage_accounts boolean;
	v_can_review_catalog boolean;
	v_can_review_warnings boolean;
	v_can_read_data_operations boolean;
	v_pending_product_submissions bigint := 0;
	v_pending_catalog_conflicts bigint := 0;
	v_pending_provider_changes bigint := 0;
	v_pending_safety_matches bigint := 0;
	v_pending_catalog_review_items bigint := 0;
	v_pending_food_warning_reports bigint := 0;
	v_pending_profile_image_reviews bigint := 0;
	v_pending_catalog_data_operations bigint := 0;
	v_total_actionable_items bigint := 0;
begin
	if auth.uid() is null or coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified privileged-tool access is required.';
	end if;

	select assignment.role
	into v_role
	from public.app_role_assignments assignment
	where assignment.user_id = auth.uid();

	if v_role is null then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified privileged-tool access is required.';
	end if;

	select
		coalesce(bool_or(permission.permission = 'moderation.accounts.manage'), false),
		coalesce(bool_or(permission.permission = 'moderation.catalog.review'), false),
		coalesce(bool_or(permission.permission = 'moderation.warnings.review'), false),
		coalesce(bool_or(permission.permission = 'data_operations.catalog_health.read'), false)
	into
		v_can_manage_accounts,
		v_can_review_catalog,
		v_can_review_warnings,
		v_can_read_data_operations
	from public.app_role_permissions permission
	where permission.role = v_role;

	if v_can_review_catalog then
		select count(*) into v_pending_product_submissions
		from public.shared_product_submissions submission
		where submission.status = 'pending';

		select count(*) into v_pending_catalog_conflicts
		from public.shared_product_conflicts conflict
		where conflict.status = 'open';

		select count(*) into v_pending_provider_changes
		from public.catalog_provider_change_reviews review
		where review.status = 'pending';

		select count(*) into v_pending_safety_matches
		from public.official_food_safety_alert_matches alert_match
		where alert_match.status = 'needs_review';

		v_pending_catalog_review_items :=
			v_pending_catalog_conflicts
			+ v_pending_provider_changes
			+ v_pending_safety_matches;
	end if;

	if v_can_review_warnings then
		select count(*) into v_pending_food_warning_reports
		from public.food_compatibility_feedback feedback
		where feedback.status = 'pending';
	end if;

	if v_can_manage_accounts then
		select count(*) into v_pending_profile_image_reviews
		from (
			select report.reported_profile_user_id, report.avatar_path
			from public.profile_image_reports report
			where report.status = 'pending'
			group by report.reported_profile_user_id, report.avatar_path
		) pending_images;
	end if;

	if v_can_read_data_operations then
		select count(*) into v_pending_catalog_data_operations
		from (
			select occurrence.subject_type, occurrence.subject_key
			from public.catalog_health_actionable_issue_occurrences occurrence
			join public.app_issue_codes issue
				on issue.code = occurrence.issue_code
			where occurrence.status = 'open'
				and issue.enabled
				and issue.responsible_group = 'data_operations'
			group by occurrence.subject_type, occurrence.subject_key
		) actionable_subjects;
	end if;

	v_total_actionable_items :=
		v_pending_product_submissions
		+ v_pending_catalog_review_items
		+ v_pending_food_warning_reports
		+ v_pending_profile_image_reviews
		+ v_pending_catalog_data_operations;

	return jsonb_build_object(
		'pendingProductSubmissions', v_pending_product_submissions,
		'pendingCatalogReviewItems', v_pending_catalog_review_items,
		'pendingFoodWarningReports', v_pending_food_warning_reports,
		'pendingProfileImageReviews', v_pending_profile_image_reviews,
		'pendingCatalogDataOperations', v_pending_catalog_data_operations,
		'totalActionableItems', v_total_actionable_items
	);
end;
$$;

create or replace function public.get_catalog_data_operations_health(
	p_days integer default 30,
	p_issue_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_dashboard jsonb;
	v_issue_limit integer := least(greatest(coalesce(p_issue_limit, 20), 1), 50);
	v_mapping_gap_count integer;
	v_mapping_issues jsonb;
	v_revision_gap_count integer;
	v_revision_issues jsonb;
	v_publication_issues jsonb;
begin
	if not public.authorize_app_permission('data_operations.catalog_health.read') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified data-operations access is required.';
	end if;

	v_dashboard := private.build_moderator_data_health_summary(
		p_days,
		v_issue_limit
	);

	select count(*) into v_mapping_gap_count
	from public.nutrient_source_mappings mapping
	where mapping.review_status = 'pending_review';

	select coalesce(jsonb_agg(jsonb_build_object(
		'mappingId', issue.id,
		'sourceKey', issue.source_key,
		'sourceNutrientKey', issue.source_nutrient_key,
		'sourceNutrientName', issue.source_nutrient_name,
		'sourceUnitName', issue.source_unit_name,
		'reviewStatus', issue.review_status,
		'reviewReference', issue.review_reference
	) order by issue.source_key, issue.source_nutrient_key,
		issue.source_unit_name), '[]'::jsonb)
	into v_mapping_issues
	from (
		select mapping.*
		from public.nutrient_source_mappings mapping
		where mapping.review_status = 'pending_review'
		order by mapping.source_key, mapping.source_nutrient_key,
			mapping.source_unit_name
		limit v_issue_limit
	) issue;

	select count(distinct occurrence.shared_product_id)
	into v_revision_gap_count
	from public.catalog_health_actionable_issue_occurrences occurrence
	where occurrence.issue_code in (
		'CATALOG_REVISION_MISSING',
		'CATALOG_REVISION_EXPLANATION_MISSING'
	);

	select coalesce(jsonb_agg(jsonb_build_object(
		'productId', issue.product_id,
		'barcode', issue.barcode,
		'productName', issue.product_name,
		'issue', issue.issue
	) order by issue.product_name, issue.product_id), '[]'::jsonb)
	into v_revision_issues
	from (
		select distinct on (product.id)
			product.id as product_id,
			product.barcode,
			product.product_name,
			case occurrence.issue_code
				when 'CATALOG_REVISION_MISSING' then 'missing_revision'
				else 'unexplained_revision'
			end as issue,
			case occurrence.issue_code
				when 'CATALOG_REVISION_MISSING' then 0
				else 1
			end as issue_order
		from public.catalog_health_actionable_issue_occurrences occurrence
		join public.shared_products product
			on product.id = occurrence.shared_product_id
		where occurrence.issue_code in (
			'CATALOG_REVISION_MISSING',
			'CATALOG_REVISION_EXPLANATION_MISSING'
		)
		order by product.id, issue_order, occurrence.detected_at
		limit v_issue_limit
	) issue;

	select coalesce(jsonb_agg(jsonb_build_object(
		'productId', issue.shared_product_id,
		'barcode', issue.barcode,
		'productName', issue.product_name,
		'reasons', issue.reasons,
		'reasonDetails', issue.reason_details
	) order by issue.product_name, issue.shared_product_id), '[]'::jsonb)
	into v_publication_issues
	from (
		select
			readiness.shared_product_id,
			readiness.barcode,
			readiness.product_name,
			array_agg(
				occurrence.source_reason
				order by occurrence.source_reason
			) as reasons,
			jsonb_agg(
				jsonb_build_object(
					'reason', occurrence.source_reason,
					'parameters', case
						when nutrient.nutrient_name is null then '{}'::jsonb
						else jsonb_build_object(
							'displayName', nutrient.nutrient_name
						)
					end
				)
				order by occurrence.source_reason
			) as reason_details
		from public.blendcalc_api_v1_product_readiness readiness
		join public.catalog_health_actionable_issue_occurrences occurrence
			on occurrence.shared_product_id = readiness.shared_product_id
			and occurrence.source_scope = 'blendcalc_api_publication'
			and occurrence.status = 'open'
		left join public.nutrient_definitions nutrient
			on nutrient.nutrient_id = case
				when occurrence.source_reason
					~ '^missing_required_nutrient:[0-9]+$'
				then split_part(occurrence.source_reason, ':', 2)::bigint
				else null
			end
		where not readiness.publishable
		group by readiness.shared_product_id, readiness.barcode,
			readiness.product_name
		order by readiness.product_name, readiness.shared_product_id
		limit v_issue_limit
	) issue;

	return jsonb_set(
		jsonb_set(
			jsonb_set(
				jsonb_set(
					jsonb_set(
						v_dashboard,
						'{overview,nutrientMappingReviewGaps}',
						to_jsonb(v_mapping_gap_count),
						true
					),
					'{issues,nutrientMappings}',
					v_mapping_issues,
					true
				),
				'{overview,revisionHistoryGaps}',
				to_jsonb(v_revision_gap_count),
				true
			),
			'{issues,revisions}',
			v_revision_issues,
			true
		),
		'{issues,publication}',
		v_publication_issues,
		true
	);
end;
$$;

comment on table public.catalog_health_review_dispositions is
	'Append-only AAL2 review outcomes for a specific fingerprint of current blendCalcAPI publication issues. The canonical product and raw readiness diagnostics remain unchanged.';
comment on view public.catalog_health_actionable_issue_occurrences is
	'Open catalog-health work after removing only the exact API-publication issue snapshots an operator deliberately finished as accepted and withheld.';
comment on function public.finish_catalog_health_product_review(uuid, text) is
	'Finishes one exact product issue snapshot after every available safe repair has returned no candidate. The product remains usable in blendCalc and withheld from blendCalcAPI v1; any changed issue set reopens automatically.';
comment on function public.get_blendcalc_api_catalog_product_readiness_passport(uuid) is
	'Returns one bounded AAL2 product-readiness passport with actionable issues, human-readable nutrient identities, and any current accepted-withheld review disposition.';
comment on function public.get_privileged_tool_action_summary() is
	'Returns exact role-aware actionable counts. Finished accepted-withheld API issue snapshots are excluded until their underlying issue set changes.';
comment on function public.get_catalog_data_operations_health(integer, integer) is
	'Returns the AAL2 data-operations dashboard with finished API issue snapshots removed from actionable product and revision work.';
