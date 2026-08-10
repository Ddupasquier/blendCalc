alter table public.app_role_assignments
	drop constraint if exists app_role_assignments_elevated_role_check;

alter table public.app_role_assignments
	add constraint app_role_assignments_elevated_role_check
	check (role in ('moderator', 'admin', 'developer'));

insert into public.app_role_permissions (role, permission)
select 'developer'::public.app_role, permission.permission
from public.app_role_permissions permission
where permission.role = 'admin'
on conflict (role, permission) do nothing;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
	assigned_role public.app_role;
	subject_user_id uuid;
begin
	begin
		subject_user_id := nullif(event ->> 'user_id', '')::uuid;
	exception
		when invalid_text_representation then
			subject_user_id := null;
	end;

	if subject_user_id is not null then
		select role_assignment.role
		into assigned_role
		from public.app_role_assignments role_assignment
		where role_assignment.user_id = subject_user_id;
	end if;

	claims := claims - 'app_role';
	claims := jsonb_set(
		claims,
		'{app_role}',
		to_jsonb(coalesce(assigned_role, 'user'::public.app_role)),
		true
	);

	return jsonb_set(event, '{claims}', claims, true);
end;
$$;

revoke execute on function public.custom_access_token_hook(jsonb)
	from public, anon, authenticated, service_role;
grant execute on function public.custom_access_token_hook(jsonb)
	to supabase_auth_admin;

create or replace function public.authorize_app_permission(
	requested_permission public.app_permission
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
	select exists (
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

comment on type public.app_role is
	'Application authorization roles. Developer capabilities are explicit permission rows rather than implicit role inheritance.';
