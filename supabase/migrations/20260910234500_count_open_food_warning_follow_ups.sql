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
	v_pending_food_warning_follow_ups bigint := 0;
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

		select count(*) into v_pending_food_warning_follow_ups
		from (
			select correction.id
			from public.catalog_correction_origins correction
			where correction.origin_type = 'food_warning_report'
				and correction.status in ('waiting_for_correction', 'linked')
			union all
			select review_case.id
			from public.food_warning_policy_review_cases review_case
			where review_case.status in ('open', 'deferred')
		) warning_follow_up;
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
		+ v_pending_food_warning_follow_ups
		+ v_pending_profile_image_reviews
		+ v_pending_catalog_data_operations;

	return jsonb_build_object(
		'pendingProductSubmissions', v_pending_product_submissions,
		'pendingCatalogReviewItems', v_pending_catalog_review_items,
		'pendingFoodWarningReports', v_pending_food_warning_reports,
		'pendingFoodWarningFollowUps', v_pending_food_warning_follow_ups,
		'pendingProfileImageReviews', v_pending_profile_image_reviews,
		'pendingCatalogDataOperations', v_pending_catalog_data_operations,
		'totalActionableItems', v_total_actionable_items
	);
end;
$$;

comment on function public.get_privileged_tool_action_summary() is
	'Returns exact role-filtered privileged action counts after AAL2, including pending food-warning reports and every open warning follow-up that remains in the focused queue.';
