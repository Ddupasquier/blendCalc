create function public.blendcalc_api_key_scopes_are_well_formed(p_scopes text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
	select p_scopes is not null
		and not exists (
			select 1 from unnest(p_scopes) scope where btrim(scope) = ''
		);
$$;

revoke all on function public.blendcalc_api_key_scopes_are_well_formed(text[])
	from public, anon, authenticated;
grant execute on function public.blendcalc_api_key_scopes_are_well_formed(text[])
	to service_role;

create table public.blendcalc_api_clients (
	id uuid primary key default gen_random_uuid(),
	name text not null check (char_length(btrim(name)) between 1 and 120),
	owner_user_id uuid references auth.users(id) on delete set null,
	status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
	created_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.blendcalc_api_keys (
	id uuid primary key default gen_random_uuid(),
	client_id uuid not null references public.blendcalc_api_clients(id) on delete cascade,
	name text not null check (char_length(btrim(name)) between 1 and 120),
	key_prefix text not null check (key_prefix ~ '^bc_(test|live)_[A-Za-z0-9_-]{8,16}$'),
	key_hash text not null unique check (key_hash ~ '^[a-f0-9]{64}$'),
	scopes text[] not null default '{}'::text[] check (
		public.blendcalc_api_key_scopes_are_well_formed(scopes)
	),
	issued_at timestamptz not null default now(),
	last_used_at timestamptz,
	expires_at timestamptz check (expires_at is null or expires_at > issued_at),
	revoked_at timestamptz,
	revocation_reason text,
	rotated_from_key_id uuid references public.blendcalc_api_keys(id) on delete set null,
	created_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check ((revoked_at is null) = (revocation_reason is null))
);

create index blendcalc_api_keys_active_client_idx
	on public.blendcalc_api_keys (client_id, issued_at desc)
	where revoked_at is null;
create index blendcalc_api_keys_prefix_idx
	on public.blendcalc_api_keys (key_prefix);

create trigger set_blendcalc_api_clients_updated_at
	before update on public.blendcalc_api_clients
	for each row execute function public.set_updated_at();
create trigger set_blendcalc_api_keys_updated_at
	before update on public.blendcalc_api_keys
	for each row execute function public.set_updated_at();

alter table public.blendcalc_api_clients enable row level security;
alter table public.blendcalc_api_clients force row level security;
alter table public.blendcalc_api_keys enable row level security;
alter table public.blendcalc_api_keys force row level security;
revoke all on table public.blendcalc_api_clients from public, anon, authenticated;
revoke all on table public.blendcalc_api_keys from public, anon, authenticated;
grant all on table public.blendcalc_api_clients to service_role;
grant all on table public.blendcalc_api_keys to service_role;

create function public.rotate_blendcalc_api_key(
	p_current_key_id uuid,
	p_new_key_id uuid,
	p_name text,
	p_key_prefix text,
	p_key_hash text,
	p_scopes text[],
	p_expires_at timestamptz,
	p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_current public.blendcalc_api_keys%rowtype;
begin
	select * into v_current
	from public.blendcalc_api_keys
	where id = p_current_key_id
		and revoked_at is null
	for update;
	if not found then raise exception 'Active API key not found.'; end if;

	insert into public.blendcalc_api_keys (
		id, client_id, name, key_prefix, key_hash, scopes, expires_at,
		rotated_from_key_id, created_by
	) values (
		p_new_key_id, v_current.client_id, p_name, p_key_prefix, p_key_hash,
		p_scopes, p_expires_at, v_current.id, p_created_by
	);

	update public.blendcalc_api_keys
	set revoked_at = now(), revocation_reason = 'rotated'
	where id = v_current.id;
	return p_new_key_id;
end;
$$;

revoke all on function public.rotate_blendcalc_api_key(
	uuid, uuid, text, text, text, text[], timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.rotate_blendcalc_api_key(
	uuid, uuid, text, text, text, text[], timestamptz, uuid
) to service_role;

comment on table public.blendcalc_api_clients is
	'Server-managed blendCalcAPI consumers. Browser roles have no direct access.';
comment on table public.blendcalc_api_keys is
	'Hashed blendCalcAPI credentials and lifecycle metadata. Plaintext secrets are never stored.';
