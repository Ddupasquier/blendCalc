begin;

revoke all
	on table public.app_role_permissions
	from public, anon, authenticated, service_role;

grant select
	on table public.app_role_permissions
	to service_role;

commit;
