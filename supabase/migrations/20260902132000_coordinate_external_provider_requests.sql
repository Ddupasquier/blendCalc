create table public.product_api_request_leases (
	provider text not null,
	cache_key text not null,
	owner_token uuid not null,
	lease_expires_at timestamptz not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (provider, cache_key),
	check (btrim(provider) <> '' and char_length(provider) <= 80),
	check (btrim(cache_key) <> '' and char_length(cache_key) <= 128)
);

create index product_api_request_leases_expiry_idx
	on public.product_api_request_leases (lease_expires_at);

create trigger set_product_api_request_leases_updated_at
	before update on public.product_api_request_leases
	for each row execute function public.set_updated_at();

create table public.external_provider_request_budgets (
	provider text primary key,
	window_started_at timestamptz not null,
	request_count integer not null check (request_count >= 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (btrim(provider) <> '' and char_length(provider) <= 80)
);

create trigger set_external_provider_request_budgets_updated_at
	before update on public.external_provider_request_budgets
	for each row execute function public.set_updated_at();

alter table public.product_api_request_leases enable row level security;
alter table public.product_api_request_leases force row level security;
alter table public.external_provider_request_budgets enable row level security;
alter table public.external_provider_request_budgets force row level security;

revoke all on table public.product_api_request_leases
	from public, anon, authenticated;
revoke all on table public.external_provider_request_budgets
	from public, anon, authenticated;
grant all on table public.product_api_request_leases to service_role;
grant all on table public.external_provider_request_budgets to service_role;

create or replace function public.claim_product_api_request_lease(
	p_provider text,
	p_cache_key text,
	p_owner_token uuid,
	p_lease_milliseconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_claimed boolean := false;
begin
	if btrim(coalesce(p_provider, '')) = ''
		or char_length(p_provider) > 80
		or btrim(coalesce(p_cache_key, '')) = ''
		or char_length(p_cache_key) > 128
		or p_owner_token is null
		or p_lease_milliseconds < 1000
		or p_lease_milliseconds > 30000
	then
		raise exception using
			errcode = '22023',
			message = 'Invalid provider request lease parameters.';
	end if;

	insert into public.product_api_request_leases (
		provider,
		cache_key,
		owner_token,
		lease_expires_at
	)
	values (
		p_provider,
		p_cache_key,
		p_owner_token,
		now() + make_interval(secs => p_lease_milliseconds::double precision / 1000)
	)
	on conflict (provider, cache_key) do update
	set owner_token = excluded.owner_token,
		lease_expires_at = excluded.lease_expires_at
	where public.product_api_request_leases.lease_expires_at <= now()
		or public.product_api_request_leases.owner_token = excluded.owner_token
	returning true into v_claimed;

	return coalesce(v_claimed, false);
end;
$$;

create or replace function public.release_product_api_request_lease(
	p_provider text,
	p_cache_key text,
	p_owner_token uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
	delete from public.product_api_request_leases
	where provider = p_provider
		and cache_key = p_cache_key
		and owner_token = p_owner_token;
$$;

create or replace function public.claim_external_provider_request_budget(
	p_provider text,
	p_max_requests integer,
	p_window_milliseconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_now timestamptz := clock_timestamp();
	v_budget public.external_provider_request_budgets%rowtype;
	v_window interval;
	v_retry_after_milliseconds integer;
begin
	if btrim(coalesce(p_provider, '')) = ''
		or char_length(p_provider) > 80
		or p_max_requests < 1
		or p_max_requests > 1000
		or p_window_milliseconds < 1000
		or p_window_milliseconds > 3600000
	then
		raise exception using
			errcode = '22023',
			message = 'Invalid provider request budget parameters.';
	end if;

	v_window := make_interval(secs => p_window_milliseconds::double precision / 1000);

	insert into public.external_provider_request_budgets (
		provider,
		window_started_at,
		request_count
	)
	values (p_provider, v_now, 0)
	on conflict (provider) do nothing;

	select budget.*
	into v_budget
	from public.external_provider_request_budgets budget
	where budget.provider = p_provider
	for update;

	if v_budget.window_started_at + v_window <= v_now then
		update public.external_provider_request_budgets
		set window_started_at = v_now,
			request_count = 1
		where provider = p_provider;

		return jsonb_build_object(
			'allowed', true,
			'retryAfterMilliseconds', 0,
			'remaining', p_max_requests - 1
		);
	end if;

	if v_budget.request_count < p_max_requests then
		update public.external_provider_request_budgets
		set request_count = request_count + 1
		where provider = p_provider;

		return jsonb_build_object(
			'allowed', true,
			'retryAfterMilliseconds', 0,
			'remaining', p_max_requests - v_budget.request_count - 1
		);
	end if;

	v_retry_after_milliseconds := greatest(
		1,
		ceil(extract(epoch from ((v_budget.window_started_at + v_window) - v_now)) * 1000)::integer
	);

	return jsonb_build_object(
		'allowed', false,
		'retryAfterMilliseconds', v_retry_after_milliseconds,
		'remaining', 0
	);
end;
$$;

revoke all on function public.claim_product_api_request_lease(text, text, uuid, integer)
	from public, anon, authenticated;
revoke all on function public.release_product_api_request_lease(text, text, uuid)
	from public, anon, authenticated;
revoke all on function public.claim_external_provider_request_budget(text, integer, integer)
	from public, anon, authenticated;

grant execute on function public.claim_product_api_request_lease(text, text, uuid, integer)
	to service_role;
grant execute on function public.release_product_api_request_lease(text, text, uuid)
	to service_role;
grant execute on function public.claim_external_provider_request_budget(text, integer, integer)
	to service_role;

comment on table public.product_api_request_leases is
	'Short service-role leases that prevent identical provider cache misses from creating duplicate outbound work across app instances.';
comment on table public.external_provider_request_budgets is
	'Shared service-role request windows that keep provider traffic below documented ceilings across app instances.';
