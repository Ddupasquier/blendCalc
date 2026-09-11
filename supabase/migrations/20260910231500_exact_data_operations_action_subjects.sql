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
	v_catalog_data_operation_subjects jsonb := '[]'::jsonb;
	v_catalog_data_operation_subjects_truncated boolean := false;
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
		with actionable_issue_rows as (
			select
				occurrence.subject_type,
				occurrence.subject_key,
				occurrence.issue_code,
				occurrence.source_reason,
				occurrence.parameters,
				issue.resolution_action,
				issue.operational_severity,
				case issue.operational_severity
					when 'blocking' then 1
					when 'critical' then 2
					when 'attention' then 3
					else 4
				end as severity_rank
			from public.catalog_health_actionable_issue_occurrences occurrence
			join public.app_issue_codes issue
				on issue.code = occurrence.issue_code
			where occurrence.status = 'open'
				and issue.enabled
				and issue.responsible_group = 'data_operations'
		), subject_groups as (
			select
				row.subject_type,
				row.subject_key,
				count(*)::integer as issue_count,
				min(row.severity_rank) as severity_rank,
				(array_agg(
					row.operational_severity
					order by row.severity_rank, row.issue_code
				))[1] as severity,
				(array_agg(
					row.resolution_action
					order by row.severity_rank, row.issue_code
				))[1] as resolution_action,
				jsonb_agg(
					jsonb_build_object(
						'code', row.issue_code,
						'sourceReason', row.source_reason,
						'resolutionAction', row.resolution_action,
						'severity', row.operational_severity,
						'parameters', row.parameters
					)
					order by row.severity_rank, row.issue_code
				) as issues
			from actionable_issue_rows row
			group by row.subject_type, row.subject_key
		), labeled_subjects as (
			select
				subject.subject_type,
				subject.subject_key,
				case subject.subject_type
					when 'shared_product' then coalesce(
						nullif(btrim(product.food ->> 'description'), ''),
						'Unnamed catalog product'
					)
					when 'nutrient_mapping' then coalesce(
						nullif(btrim(mapping.source_nutrient_name), ''),
						nullif(btrim(mapping.source_nutrient_key), ''),
						'Unnamed nutrient identity'
					)
					when 'generic_food_dataset' then coalesce(
						nullif(btrim(dataset.display_name), ''),
						'Unnamed dataset'
					)
					when 'product_data_source' then coalesce(
						nullif(btrim(source.display_name), ''),
						'Unnamed product source'
					)
					when 'food_preference' then initcap(
						replace(replace(subject.subject_key, '-', ' '), '_', ' ')
					)
					else 'Unidentified operational subject'
				end as display_name,
				case subject.subject_type
					when 'shared_product' then nullif(product.food ->> 'brandOwner', '')
					when 'nutrient_mapping' then mapping.source_key
					when 'generic_food_dataset' then dataset.source_key
					when 'product_data_source' then source.key
					else null
				end as context,
				subject.issue_count,
				subject.severity_rank,
				subject.severity,
				subject.resolution_action,
				subject.issues,
				case subject.subject_type
					when 'shared_product' then
						'/profile/privileged-tools/data-operations/products/' || subject.subject_key
					when 'nutrient_mapping' then
						'/profile/privileged-tools/data-operations/nutrient-mappings/' || subject.subject_key
					else null
				end as destination,
				case
					when subject.subject_type in ('shared_product', 'nutrient_mapping') then null
					when subject.resolution_action = 'review_dataset_import' then
						'The ingestion workflow must record the missing import date or checksum; no in-app editor exists yet.'
					when subject.resolution_action = 'review_policy_coverage' then
						'A reviewed policy migration must add the missing coverage; no in-app editor exists.'
					else
						'The required workflow is not available in the app yet.'
				end as missing_prerequisite
			from subject_groups subject
			left join public.shared_products product
				on subject.subject_type = 'shared_product'
				and product.id::text = subject.subject_key
			left join public.nutrient_source_mappings mapping
				on subject.subject_type = 'nutrient_mapping'
				and mapping.id::text = subject.subject_key
			left join public.generic_food_datasets dataset
				on subject.subject_type = 'generic_food_dataset'
				and dataset.key = subject.subject_key
			left join public.product_data_sources source
				on subject.subject_type = 'product_data_source'
				and source.key = subject.subject_key
		), ordered_subjects as (
			select subject.*
			from labeled_subjects subject
			order by
				subject.severity_rank,
				lower(subject.display_name),
				subject.subject_type,
				subject.subject_key
			limit 50
		)
		select
			(select count(*) from labeled_subjects),
			coalesce(
				jsonb_agg(
					jsonb_build_object(
						'subjectType', subject.subject_type,
						'subjectKey', subject.subject_key,
						'displayName', subject.display_name,
						'context', subject.context,
						'issueCount', subject.issue_count,
						'severity', subject.severity,
						'resolutionAction', subject.resolution_action,
						'destination', subject.destination,
						'missingPrerequisite', subject.missing_prerequisite,
						'issues', subject.issues
					)
					order by
						subject.severity_rank,
						lower(subject.display_name),
						subject.subject_type,
						subject.subject_key
				),
				'[]'::jsonb
			)
		into
			v_pending_catalog_data_operations,
			v_catalog_data_operation_subjects
		from ordered_subjects subject;

		v_catalog_data_operation_subjects_truncated :=
			v_pending_catalog_data_operations
			> jsonb_array_length(v_catalog_data_operation_subjects);
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
		'catalogDataOperationSubjects', v_catalog_data_operation_subjects,
		'catalogDataOperationSubjectsTruncated', v_catalog_data_operation_subjects_truncated,
		'totalActionableItems', v_total_actionable_items
	);
end;
$$;

comment on function public.get_privileged_tool_action_summary() is
	'Returns exact role-aware actionable counts and a bounded named data-operations subject list for the AAL2 Profile privileged-tools launcher and workspaces.';
