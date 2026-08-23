create or replace function public.get_catalog_review_work_summary(
	p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
	v_health jsonb;
	v_monitor jsonb;
begin
	if not public.authorize_app_permission('moderation.catalog.review') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog-review access is required.';
	end if;

	v_health := private.build_moderator_data_health_summary(30, v_limit);
	v_monitor := private.build_catalog_monitor_summary(v_limit);

	return jsonb_build_object(
		'conflicts', coalesce(v_health #> '{issues,conflicts}', '[]'::jsonb),
		'providerChanges', coalesce(v_monitor -> 'providerChanges', '[]'::jsonb),
		'safetyMatches', coalesce(v_monitor -> 'safetyMatches', '[]'::jsonb),
		'counts', jsonb_build_object(
			'conflicts', coalesce(jsonb_array_length(v_health #> '{issues,conflicts}'), 0),
			'providerChanges', coalesce(v_monitor #>> '{queue,pendingProviderChanges}', '0')::integer,
			'safetyMatches', coalesce(v_monitor #>> '{queue,pendingSafetyMatches}', '0')::integer
		),
		'issueLimit', v_limit
	);
end;
$$;

revoke all on function public.get_catalog_review_work_summary(integer)
	from public, anon, authenticated, service_role;
grant execute on function public.get_catalog_review_work_summary(integer)
	to authenticated;

comment on function public.get_catalog_review_work_summary(integer) is
	'Returns only actionable catalog review queues to an AAL2 catalog reviewer.';
