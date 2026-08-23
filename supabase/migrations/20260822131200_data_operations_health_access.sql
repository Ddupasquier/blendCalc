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
begin
	if not public.authorize_app_permission(
		'data_operations.catalog_health.read'
	) then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified data-operations access is required.';
	end if;

	return private.build_moderator_data_health_summary(p_days, p_issue_limit);
end;
$$;

revoke all on function public.get_catalog_data_operations_health(integer, integer)
	from public, anon, authenticated, service_role;
grant execute on function public.get_catalog_data_operations_health(integer, integer)
	to authenticated;

comment on function public.get_catalog_data_operations_health(integer, integer) is
	'Returns bounded catalog diagnostics only to an AAL2 admin or developer with the explicit data-operations read permission. The prior moderator RPC remains temporarily available for rollout compatibility.';

create or replace function private.build_catalog_monitor_summary(
	p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
begin
	return jsonb_build_object(
		'settings', coalesce((
			select jsonb_build_object(
				'enabled', settings.enabled,
				'productBatchSize', settings.product_batch_size,
				'safetyAlertPageSize', settings.safety_alert_page_size,
				'lastInvocationRequestedAt', settings.last_invocation_requested_at,
				'lastInvocationRequestId', settings.last_invocation_request_id,
				'lastInvocationError', settings.last_invocation_error
			)
			from public.catalog_monitor_settings settings
			where settings.id
		), '{}'::jsonb),
		'queue', jsonb_build_object(
			'dueProducts', (
				select count(*)
				from public.catalog_revalidation_queue queue
				where queue.status in ('queued', 'retry')
					and queue.next_check_at <= now()
			),
			'retryingProducts', (
				select count(*)
				from public.catalog_revalidation_queue queue
				where queue.status = 'retry'
			),
			'pendingProviderChanges', (
				select count(*)
				from public.catalog_provider_change_reviews review
				where review.status = 'pending'
			),
			'pendingSafetyMatches', (
				select count(*)
				from public.official_food_safety_alert_matches match
				where match.status = 'needs_review'
			),
			'activeSafetyMatches', (
				select count(*)
				from public.official_food_safety_alert_matches match
				where match.status in ('active', 'confirmed')
			)
		),
		'recentRuns', coalesce((
			select jsonb_agg(to_jsonb(run_row) order by run_row."startedAt" desc)
			from (
				select
					run.id,
					run.status,
					run.invocation_source as "invocationSource",
					run.started_at as "startedAt",
					run.finished_at as "finishedAt",
					run.product_jobs_claimed as "productJobsClaimed",
					run.product_jobs_changed as "productJobsChanged",
					run.product_jobs_failed as "productJobsFailed",
					run.safety_alerts_observed as "safetyAlertsObserved",
					run.safety_alerts_changed as "safetyAlertsChanged",
					run.safety_matches_activated as "safetyMatchesActivated",
					run.error_summary as "errors"
				from public.catalog_monitor_runs run
				order by run.started_at desc
				limit 10
			) run_row
		), '[]'::jsonb),
		'providerChanges', coalesce((
			select jsonb_agg(to_jsonb(change_row) order by change_row.created_at)
			from (
				select
					review.id,
					review.shared_product_id as "sharedProductId",
					product.barcode,
					product.product_name as "productName",
					source.display_name as "sourceName",
					review.change_summary as "changeSummary",
					review.material_field_paths as "materialFieldPaths",
					snapshot.observed_at as "observedAt",
					review.created_at
				from public.catalog_provider_change_reviews review
				join public.shared_products product on product.id = review.shared_product_id
				join public.product_data_sources source on source.key = review.provider_key
				join public.catalog_provider_product_snapshots snapshot on snapshot.id = review.snapshot_id
				where review.status = 'pending'
				order by review.created_at
				limit v_limit
			) change_row
		), '[]'::jsonb),
		'safetyMatches', coalesce((
			select jsonb_agg(to_jsonb(match_row) order by match_row.detected_at)
			from (
				select
					match.id,
					match.shared_product_id as "sharedProductId",
					product.barcode,
					product.product_name as "productName",
					product.brand_owner as "brandOwner",
					alert.product_description as "alertProductDescription",
					alert.classification,
					alert.reason,
					alert.package_description as "packageDescription",
					alert.code_information as "codeInformation",
					alert.source_url as "sourceUrl",
					source.display_name as "sourceName",
					match.match_evidence as "matchEvidence",
					match.requires_package_check as "requiresPackageCheck",
					match.detected_at
				from public.official_food_safety_alert_matches match
				join public.official_food_safety_alerts alert on alert.id = match.alert_id
				join public.shared_products product on product.id = match.shared_product_id
				join public.product_data_sources source on source.key = alert.provider_key
				where match.status = 'needs_review'
				order by match.detected_at
				limit v_limit
			) match_row
		), '[]'::jsonb)
	);
end;
$$;

revoke all on function private.build_catalog_monitor_summary(integer)
	from public, anon, authenticated, service_role;

comment on function private.build_catalog_monitor_summary(integer) is
	'Builds the bounded catalog-monitor summary without deciding caller authorization. Public wrappers must enforce their own exact permission.';

create or replace function public.get_catalog_data_operations_monitor_summary(
	p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
	if not public.authorize_app_permission(
		'data_operations.catalog_health.read'
	) then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified data-operations access is required.';
	end if;

	return private.build_catalog_monitor_summary(p_limit);
end;
$$;

revoke all on function public.get_catalog_data_operations_monitor_summary(integer)
	from public, anon, authenticated, service_role;
grant execute on function public.get_catalog_data_operations_monitor_summary(integer)
	to authenticated;

comment on function public.get_catalog_data_operations_monitor_summary(integer) is
	'Returns bounded catalog-monitor operational state only to an AAL2 admin or developer with explicit data-operations read permission.';
