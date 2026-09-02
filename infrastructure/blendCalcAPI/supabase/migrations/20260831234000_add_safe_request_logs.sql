create table blendcalc_api.safe_request_logs (
	request_id uuid primary key,
	observed_at timestamptz not null default now(),
	expires_at timestamptz not null default (now() + interval '35 days'),
	endpoint text not null check (
		endpoint in (
			'/api/v1/categories',
			'/api/v1/foods/search',
			'/api/v1/products/{barcode}',
			'/api/v1/products/{barcode}/revisions',
			'/api/v1/{unknown}'
		)
	),
	method text not null check (
		method in ('GET', 'HEAD', 'OPTIONS', 'POST', 'PATCH', 'DELETE', 'OTHER')
	),
	response_status integer not null check (response_status between 100 and 599),
	duration_ms double precision not null check (duration_ms >= 0),
	actor_type text not null check (
		actor_type in ('authenticated-user', 'api-key', 'anonymous')
	),
	actor_hash text check (actor_hash is null or actor_hash ~ '^[0-9a-f]{64}$'),
	rate_limit_result text not null check (
		rate_limit_result in ('allowed', 'denied', 'unavailable', 'not-evaluated')
	),
	check (expires_at > observed_at),
	check (
		(actor_type = 'anonymous' and actor_hash is null)
		or (actor_type <> 'anonymous' and actor_hash is not null)
	)
);

create index safe_request_logs_expires_at_idx
	on blendcalc_api.safe_request_logs (expires_at);

create index safe_request_logs_endpoint_observed_at_idx
	on blendcalc_api.safe_request_logs (endpoint, observed_at desc);

alter table blendcalc_api.safe_request_logs enable row level security;
alter table blendcalc_api.safe_request_logs force row level security;

revoke all on blendcalc_api.safe_request_logs from public, anon, authenticated;
grant select, insert, delete on blendcalc_api.safe_request_logs to service_role;

create function blendcalc_api.record_safe_request_log(
	p_request_id uuid,
	p_endpoint text,
	p_method text,
	p_response_status integer,
	p_duration_ms double precision,
	p_actor_type text,
	p_actor_hash text default null,
	p_rate_limit_result text default 'not-evaluated'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into blendcalc_api.safe_request_logs (
		request_id,
		endpoint,
		method,
		response_status,
		duration_ms,
		actor_type,
		actor_hash,
		rate_limit_result
	)
	values (
		p_request_id,
		p_endpoint,
		p_method,
		p_response_status,
		p_duration_ms,
		p_actor_type,
		p_actor_hash,
		p_rate_limit_result
	)
	on conflict (request_id) do nothing;

	delete from blendcalc_api.safe_request_logs
	where request_id in (
		select expired.request_id
		from blendcalc_api.safe_request_logs expired
		where expired.expires_at <= now()
		order by expired.expires_at
		limit 500
	);
end;
$$;

revoke all on function blendcalc_api.record_safe_request_log(
	uuid,
	text,
	text,
	integer,
	double precision,
	text,
	text,
	text
) from public, anon, authenticated;
grant execute on function blendcalc_api.record_safe_request_log(
	uuid,
	text,
	text,
	integer,
	double precision,
	text,
	text,
	text
) to service_role;

comment on table blendcalc_api.safe_request_logs is
	'Service-only, 35-day blendCalcAPI request audit records. Stores normalized endpoints and pseudonymous actors; never stores raw URLs, query values, bodies, headers, IP addresses, credentials, user IDs, or evidence.';

comment on function blendcalc_api.record_safe_request_log(
	uuid,
	text,
	text,
	integer,
	double precision,
	text,
	text,
	text
) is
	'Idempotently records one privacy-safe blendCalcAPI request and prunes a bounded batch of expired records.';
