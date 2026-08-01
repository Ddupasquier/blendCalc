create type public.app_role as enum (
	'user',
	'moderator',
	'admin'
);

create type public.app_permission as enum (
	'moderation.access',
	'moderation.accounts.manage',
	'moderation.catalog.review',
	'moderation.warnings.review',
	'moderation.data_health.read',
	'moderation.roles.manage'
);

alter table public.app_role_assignments
	drop constraint if exists app_role_assignments_role_check;

alter table public.app_role_assignments
	alter column role type public.app_role
	using role::public.app_role;

alter table public.app_role_assignments
	add constraint app_role_assignments_elevated_role_check
	check (role in ('moderator', 'admin'));

create table public.app_role_permissions (
	role public.app_role not null,
	permission public.app_permission not null,
	primary key (role, permission)
);

alter table public.app_role_permissions enable row level security;

revoke all on table public.app_role_permissions from public, anon, authenticated;
grant select on table public.app_role_permissions to service_role;

insert into public.app_role_permissions (role, permission)
values
	('moderator', 'moderation.access'),
	('moderator', 'moderation.accounts.manage'),
	('moderator', 'moderation.catalog.review'),
	('moderator', 'moderation.warnings.review'),
	('moderator', 'moderation.data_health.read'),
	('admin', 'moderation.access'),
	('admin', 'moderation.accounts.manage'),
	('admin', 'moderation.catalog.review'),
	('admin', 'moderation.warnings.review'),
	('admin', 'moderation.data_health.read'),
	('admin', 'moderation.roles.manage');

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
			else 'user'::public.app_role
		end
			and permission.permission = requested_permission
	);
$$;

revoke execute on function public.authorize_app_permission(public.app_permission)
	from public, anon;
grant execute on function public.authorize_app_permission(public.app_permission)
	to authenticated;

create or replace function public.set_app_user_role(
	p_target_user_id uuid,
	p_role public.app_role,
	p_actor_user_id uuid default null,
	p_reason_code text default 'role_change',
	p_internal_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	previous_role public.app_role;
	normalized_reason text;
begin
	if not exists (
		select 1
		from auth.users app_user
		where app_user.id = p_target_user_id
	) then
		raise exception using
			errcode = '22023',
			message = 'Target Auth user does not exist.';
	end if;

	normalized_reason := nullif(btrim(p_reason_code), '');
	if normalized_reason is null or length(normalized_reason) > 100 then
		raise exception using
			errcode = '22023',
			message = 'A role-change reason code between 1 and 100 characters is required.';
	end if;

	if p_internal_note is not null and length(p_internal_note) > 2000 then
		raise exception using
			errcode = '22023',
			message = 'The role-change note cannot exceed 2000 characters.';
	end if;

	select assignment.role
	into previous_role
	from public.app_role_assignments assignment
	where assignment.user_id = p_target_user_id
	for update;

	if p_role = 'user' then
		if previous_role is null then
			return false;
		end if;

		delete from public.app_role_assignments
		where user_id = p_target_user_id;
	else
		if previous_role is not distinct from p_role then
			return false;
		end if;

		insert into public.app_role_assignments (
			user_id,
			role,
			granted_by
		)
		values (
			p_target_user_id,
			p_role,
			p_actor_user_id
		)
		on conflict (user_id) do update
		set
			role = excluded.role,
			granted_by = excluded.granted_by,
			updated_at = now();
	end if;

	insert into public.moderation_actions (
		target_user_id,
		actor_user_id,
		action,
		reason_code,
		internal_note
	)
	values (
		p_target_user_id,
		p_actor_user_id,
		case when p_role = 'user' then 'role_revoked' else 'role_granted' end,
		normalized_reason,
		p_internal_note
	);

	return true;
end;
$$;

revoke execute on function public.set_app_user_role(
	uuid,
	public.app_role,
	uuid,
	text,
	text
) from public, anon, authenticated;
grant execute on function public.set_app_user_role(
	uuid,
	public.app_role,
	uuid,
	text,
	text
) to service_role;

revoke all on table public.app_role_assignments from service_role;
grant select on table public.app_role_assignments to service_role;
