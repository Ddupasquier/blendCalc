create table public.catalog_intake_requests (
	id uuid primary key default gen_random_uuid(),
	actor_user_id uuid not null references auth.users(id) on delete cascade,
	idempotency_key text not null,
	request_fingerprint text not null,
	status text not null default 'processing',
	response_status integer,
	response_body jsonb,
	created_at timestamptz not null default now(),
	completed_at timestamptz,
	updated_at timestamptz not null default now(),
	constraint catalog_intake_requests_actor_key_unique
		unique (actor_user_id, idempotency_key),
	constraint catalog_intake_requests_key_check check (
		char_length(idempotency_key) between 1 and 200
		and idempotency_key = btrim(idempotency_key)
		and idempotency_key !~ '[[:cntrl:][:space:]]'
	),
	constraint catalog_intake_requests_fingerprint_check check (
		request_fingerprint ~ '^[a-f0-9]{64}$'
	),
	constraint catalog_intake_requests_status_check check (
		status in ('processing', 'succeeded', 'failed')
	),
	constraint catalog_intake_requests_completion_check check (
		(
			status = 'processing'
			and response_status is null
			and response_body is null
			and completed_at is null
		)
		or (
			status in ('succeeded', 'failed')
			and response_status between 100 and 599
			and jsonb_typeof(response_body) = 'object'
			and completed_at is not null
		)
	)
);

create index catalog_intake_requests_created_at_idx
	on public.catalog_intake_requests (created_at desc);

create trigger set_catalog_intake_requests_updated_at
	before update on public.catalog_intake_requests
	for each row execute function public.set_updated_at();

alter table public.catalog_intake_requests enable row level security;
alter table public.catalog_intake_requests force row level security;

revoke all on table public.catalog_intake_requests from public, anon, authenticated;
grant select, insert, update on table public.catalog_intake_requests to service_role;

create function public.begin_catalog_intake_request(
	p_actor_user_id uuid,
	p_idempotency_key text,
	p_request_fingerprint text
)
returns table (
	request_id uuid,
	outcome text,
	response_status integer,
	response_body jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_request public.catalog_intake_requests%rowtype;
	v_inserted_id uuid;
begin
	insert into public.catalog_intake_requests (
		actor_user_id,
		idempotency_key,
		request_fingerprint
	) values (
		p_actor_user_id,
		p_idempotency_key,
		p_request_fingerprint
	)
	on conflict (actor_user_id, idempotency_key) do nothing
	returning id into v_inserted_id;

	if v_inserted_id is not null then
		return query select v_inserted_id, 'acquired'::text, null::integer, null::jsonb;
		return;
	end if;

	select * into strict v_request
	from public.catalog_intake_requests request
	where request.actor_user_id = p_actor_user_id
		and request.idempotency_key = p_idempotency_key;

	if v_request.request_fingerprint <> p_request_fingerprint then
		return query select v_request.id, 'conflict'::text, null::integer, null::jsonb;
	elsif v_request.status = 'processing' then
		return query select v_request.id, 'in_progress'::text, null::integer, null::jsonb;
	else
		return query select
			v_request.id,
			'replay'::text,
			v_request.response_status,
			v_request.response_body;
	end if;
end;
$$;

create function public.complete_catalog_intake_request(
	p_request_id uuid,
	p_actor_user_id uuid,
	p_request_fingerprint text,
	p_outcome text,
	p_response_status integer,
	p_response_body jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_updated_id uuid;
begin
	if p_outcome not in ('succeeded', 'failed') then
		raise exception 'Catalog intake completion outcome is invalid.';
	end if;

	update public.catalog_intake_requests
	set
		status = p_outcome,
		response_status = p_response_status,
		response_body = p_response_body,
		completed_at = now()
	where id = p_request_id
		and actor_user_id = p_actor_user_id
		and request_fingerprint = p_request_fingerprint
		and status = 'processing'
	returning id into v_updated_id;

	return v_updated_id is not null;
end;
$$;

revoke all on function public.begin_catalog_intake_request(uuid, text, text)
	from public, anon, authenticated;
grant execute on function public.begin_catalog_intake_request(uuid, text, text)
	to service_role;

revoke all on function public.complete_catalog_intake_request(
	uuid, uuid, text, text, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.complete_catalog_intake_request(
	uuid, uuid, text, text, integer, jsonb
) to service_role;

comment on table public.catalog_intake_requests is
	'Service-only idempotency ledger for catalog intake. Stores request fingerprints and safe terminal responses, never submitted food or evidence payloads.';
comment on function public.begin_catalog_intake_request(uuid, text, text) is
	'Atomically acquires one actor-scoped intake key or returns conflict, in-progress, or terminal replay state.';
comment on function public.complete_catalog_intake_request(
	uuid, uuid, text, text, integer, jsonb
) is
	'Finalizes an acquired intake key exactly once without changing catalog data.';
