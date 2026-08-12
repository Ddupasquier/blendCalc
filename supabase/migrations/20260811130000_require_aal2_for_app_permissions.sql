create or replace function public.authorize_app_permission(
	requested_permission public.app_permission
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
		and exists (
			select 1
			from public.app_role_permissions permission
			where permission.role = case auth.jwt() ->> 'app_role'
				when 'moderator' then 'moderator'::public.app_role
				when 'admin' then 'admin'::public.app_role
				when 'developer' then 'developer'::public.app_role
				else 'user'::public.app_role
			end
				and permission.permission = requested_permission
		);
$$;

revoke execute on function public.authorize_app_permission(public.app_permission)
	from public, anon;
grant execute on function public.authorize_app_permission(public.app_permission)
	to authenticated;

comment on function public.authorize_app_permission(public.app_permission) is
	'Authorizes a database-owned application permission only for a signed elevated role in an AAL2 session.';

alter function public.get_moderator_data_health(integer, integer)
	rename to build_moderator_data_health_summary;

alter function public.build_moderator_data_health_summary(integer, integer)
	set schema private;

revoke all on function private.build_moderator_data_health_summary(integer, integer)
	from public, anon, authenticated, service_role;

create or replace function public.get_moderator_data_health(
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
	if not public.authorize_app_permission('moderation.data_health.read') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified moderator access is required.';
	end if;

	return private.build_moderator_data_health_summary(p_days, p_issue_limit);
end;
$$;

revoke all on function public.get_moderator_data_health(integer, integer)
	from public, anon, authenticated, service_role;
grant execute on function public.get_moderator_data_health(integer, integer)
	to authenticated;

comment on function private.build_moderator_data_health_summary(integer, integer) is
	'Private bounded data-health summary builder. The public wrapper enforces an MFA-verified permission and this function retains its independent role-assignment check.';

comment on function public.get_moderator_data_health(integer, integer) is
	'Returns bounded moderator data-health aggregates only after an AAL2 permission check and an independent current role-assignment check.';
