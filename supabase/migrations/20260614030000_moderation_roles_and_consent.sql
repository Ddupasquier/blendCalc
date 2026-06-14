create extension if not exists pgcrypto with schema extensions;

create table public.app_role_assignments (
	user_id uuid primary key references auth.users(id) on delete cascade,
	role text not null check (role in ('moderator', 'admin')),
	granted_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index app_role_assignments_granted_by_idx
	on public.app_role_assignments (granted_by)
	where granted_by is not null;

create trigger set_app_role_assignments_updated_at
	before update on public.app_role_assignments
	for each row execute function public.set_updated_at();

alter table public.app_role_assignments enable row level security;

create policy "Users can read their own elevated role"
	on public.app_role_assignments
	for select
	to authenticated
	using (user_id = (select auth.uid()));

revoke all on table public.app_role_assignments from anon, authenticated;
grant select on table public.app_role_assignments to authenticated;

create table public.profile_image_policy_acceptances (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	avatar_path text not null,
	file_sha256 text not null check (file_sha256 ~ '^[a-f0-9]{64}$'),
	policy_version text not null,
	policy_items jsonb not null check (jsonb_typeof(policy_items) = 'array'),
	accepted_at timestamptz not null default now()
);

create index profile_image_policy_acceptances_user_id_idx
	on public.profile_image_policy_acceptances (user_id, accepted_at desc);

alter table public.profile_image_policy_acceptances enable row level security;

create policy "Users can read their image policy acceptances"
	on public.profile_image_policy_acceptances
	for select
	to authenticated
	using (user_id = (select auth.uid()));

create policy "Users can record their image policy acceptance"
	on public.profile_image_policy_acceptances
	for insert
	to authenticated
	with check (user_id = (select auth.uid()));

revoke all on table public.profile_image_policy_acceptances from anon, authenticated;
grant select, insert on table public.profile_image_policy_acceptances to authenticated;

create table public.account_moderation (
	user_id uuid primary key references auth.users(id) on delete cascade,
	status text not null default 'active'
		check (status in ('active', 'suspended', 'banned')),
	public_reason text,
	expires_at timestamptz,
	moderated_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (status <> 'suspended' or expires_at is not null)
);

create index account_moderation_moderated_by_idx
	on public.account_moderation (moderated_by)
	where moderated_by is not null;

create index account_moderation_blocked_status_idx
	on public.account_moderation (status, expires_at)
	where status in ('suspended', 'banned');

create trigger set_account_moderation_updated_at
	before update on public.account_moderation
	for each row execute function public.set_updated_at();

alter table public.account_moderation enable row level security;

create policy "Users can read their own moderation status"
	on public.account_moderation
	for select
	to authenticated
	using (user_id = (select auth.uid()));

revoke all on table public.account_moderation from anon, authenticated;
grant select on table public.account_moderation to authenticated;

create table public.moderation_actions (
	id uuid primary key default gen_random_uuid(),
	target_user_id uuid not null references auth.users(id) on delete cascade,
	actor_user_id uuid references auth.users(id) on delete set null,
	action text not null
		check (action in ('suspend', 'ban', 'unban', 'role_granted', 'role_revoked')),
	reason_code text not null,
	internal_note text,
	created_at timestamptz not null default now()
);

create index moderation_actions_target_user_id_idx
	on public.moderation_actions (target_user_id, created_at desc);

create index moderation_actions_actor_user_id_idx
	on public.moderation_actions (actor_user_id, created_at desc)
	where actor_user_id is not null;

alter table public.moderation_actions enable row level security;
revoke all on table public.moderation_actions from anon, authenticated;

create table public.blocked_signup_emails (
	email_hash text primary key check (email_hash ~ '^[a-f0-9]{64}$'),
	source_user_id uuid references auth.users(id) on delete set null,
	blocked_by uuid references auth.users(id) on delete set null,
	reason text not null,
	expires_at timestamptz,
	created_at timestamptz not null default now()
);

create index blocked_signup_emails_source_user_id_idx
	on public.blocked_signup_emails (source_user_id)
	where source_user_id is not null;

create index blocked_signup_emails_blocked_by_idx
	on public.blocked_signup_emails (blocked_by)
	where blocked_by is not null;

alter table public.blocked_signup_emails enable row level security;
revoke all on table public.blocked_signup_emails from anon, authenticated;

create or replace function public.reject_blocked_signup(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	email_address text;
	email_digest text;
begin
	email_address := lower(trim(event -> 'user' ->> 'email'));

	if email_address is null or email_address = '' then
		return '{}'::jsonb;
	end if;

	email_digest := encode(extensions.digest(email_address, 'sha256'), 'hex');

	if exists (
		select 1
		from public.blocked_signup_emails
		where email_hash = email_digest
			and (expires_at is null or expires_at > now())
	) then
		return jsonb_build_object(
			'error', jsonb_build_object(
				'http_code', 403,
				'message', 'Unable to create this account.',
				'code', 'signup_not_allowed'
			)
		);
	end if;

	return '{}'::jsonb;
end;
$$;

revoke execute on function public.reject_blocked_signup(jsonb) from public, anon, authenticated;
grant execute on function public.reject_blocked_signup(jsonb) to supabase_auth_admin;
