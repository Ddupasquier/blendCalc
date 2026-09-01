alter table blendcalc_api.publication_generations
	add column target_catalog_hash text check (
		target_catalog_hash is null or target_catalog_hash ~ '^[0-9a-f]{64}$'
	);

create table blendcalc_api.api_request_observations (
	id bigint generated always as identity primary key,
	observed_at timestamptz not null default now(),
	operation text not null check (
		operation in ('categories', 'product', 'revisions', 'search', 'unknown')
	),
	read_mode text not null check (read_mode in ('source', 'shadow', 'isolated')),
	response_status integer not null check (response_status between 100 and 599),
	total_duration_ms double precision not null check (total_duration_ms >= 0),
	database_duration_ms double precision check (
		database_duration_ms is null or database_duration_ms >= 0
	),
	result_count integer not null default 0 check (result_count >= 0),
	cache_validation boolean not null default false,
	cache_not_modified boolean not null default false,
	check (not cache_not_modified or cache_validation),
	check (not cache_not_modified or response_status = 304)
);

create index api_request_observations_observed_at_idx
	on blendcalc_api.api_request_observations (observed_at desc);

create table blendcalc_api.api_shadow_parity_observations (
	id bigint generated always as identity primary key,
	observed_at timestamptz not null default now(),
	operation text not null check (
		operation in ('categories', 'product', 'revisions', 'search')
	),
	matches boolean not null,
	source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
	target_hash text check (target_hash is null or target_hash ~ '^[0-9a-f]{64}$'),
	source_duration_ms double precision not null check (source_duration_ms >= 0),
	target_duration_ms double precision check (
		target_duration_ms is null or target_duration_ms >= 0
	),
	failure_code text check (failure_code is null or btrim(failure_code) <> ''),
	check (
		(matches and target_hash is not null and failure_code is null)
		or (not matches and (target_hash is not null or failure_code is not null))
	)
);

create index api_shadow_parity_observations_observed_at_idx
	on blendcalc_api.api_shadow_parity_observations (observed_at desc);

create table blendcalc_api.publication_sync_runs (
	id uuid primary key default gen_random_uuid(),
	operation text not null check (operation in ('synchronize', 'rollback')),
	status text not null default 'running' check (
		status in ('running', 'succeeded', 'failed')
	),
	read_mode text not null check (read_mode in ('source', 'shadow', 'isolated')),
	outcome text check (outcome in ('created', 'unchanged', 'rolled-back')),
	generation_id uuid references blendcalc_api.publication_generations(id),
	source_catalog_hash text check (
		source_catalog_hash is null or source_catalog_hash ~ '^[0-9a-f]{64}$'
	),
	target_catalog_hash text check (
		target_catalog_hash is null or target_catalog_hash ~ '^[0-9a-f]{64}$'
	),
	source_product_count integer check (
		source_product_count is null or source_product_count >= 0
	),
	target_product_count integer check (
		target_product_count is null or target_product_count >= 0
	),
	added_product_count integer check (
		added_product_count is null or added_product_count >= 0
	),
	removed_product_count integer check (
		removed_product_count is null or removed_product_count >= 0
	),
	duration_ms double precision check (duration_ms is null or duration_ms >= 0),
	failure_code text check (failure_code is null or btrim(failure_code) <> ''),
	started_at timestamptz not null default now(),
	completed_at timestamptz,
	check (
		(status = 'running' and completed_at is null)
		or (status = 'succeeded' and completed_at is not null and outcome is not null)
		or (status = 'failed' and completed_at is not null and failure_code is not null)
	)
);

create index publication_sync_runs_started_at_idx
	on blendcalc_api.publication_sync_runs (started_at desc);

alter table blendcalc_api.api_request_observations enable row level security;
alter table blendcalc_api.api_shadow_parity_observations enable row level security;
alter table blendcalc_api.publication_sync_runs enable row level security;
alter table blendcalc_api.api_request_observations force row level security;
alter table blendcalc_api.api_shadow_parity_observations force row level security;
alter table blendcalc_api.publication_sync_runs force row level security;

revoke all on blendcalc_api.api_request_observations from public, anon, authenticated;
revoke all on blendcalc_api.api_shadow_parity_observations from public, anon, authenticated;
revoke all on blendcalc_api.publication_sync_runs from public, anon, authenticated;
grant select, insert, delete on blendcalc_api.api_request_observations to service_role;
grant select, insert, delete on blendcalc_api.api_shadow_parity_observations to service_role;
grant select, insert, update on blendcalc_api.publication_sync_runs to service_role;
grant usage, select on all sequences in schema blendcalc_api to service_role;

create function blendcalc_api.record_api_request_observation(
	p_operation text,
	p_read_mode text,
	p_response_status integer,
	p_total_duration_ms double precision,
	p_database_duration_ms double precision default null,
	p_result_count integer default 0,
	p_cache_validation boolean default false,
	p_cache_not_modified boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into blendcalc_api.api_request_observations (
		operation,
		read_mode,
		response_status,
		total_duration_ms,
		database_duration_ms,
		result_count,
		cache_validation,
		cache_not_modified
	)
	values (
		p_operation,
		p_read_mode,
		p_response_status,
		p_total_duration_ms,
		p_database_duration_ms,
		p_result_count,
		p_cache_validation,
		p_cache_not_modified
	);

	delete from blendcalc_api.api_request_observations
	where observed_at < now() - interval '35 days';
end;
$$;

create function blendcalc_api.record_api_shadow_parity_observation(
	p_operation text,
	p_matches boolean,
	p_source_hash text,
	p_source_duration_ms double precision,
	p_target_hash text default null,
	p_target_duration_ms double precision default null,
	p_failure_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into blendcalc_api.api_shadow_parity_observations (
		operation,
		matches,
		source_hash,
		target_hash,
		source_duration_ms,
		target_duration_ms,
		failure_code
	)
	values (
		p_operation,
		p_matches,
		p_source_hash,
		p_target_hash,
		p_source_duration_ms,
		p_target_duration_ms,
		p_failure_code
	);

	delete from blendcalc_api.api_shadow_parity_observations
	where observed_at < now() - interval '35 days';
end;
$$;

create function blendcalc_api.record_publication_generation_verification(
	p_generation_id uuid,
	p_target_catalog_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if p_target_catalog_hash !~ '^[0-9a-f]{64}$' then
		raise exception using errcode = '22023', message = 'publication_target_hash_invalid';
	end if;

	update blendcalc_api.publication_generations
	set target_catalog_hash = p_target_catalog_hash
	where id = p_generation_id
		and status in ('ready', 'active', 'retired')
		and source_catalog_hash = p_target_catalog_hash;

	if not found then
		raise exception using errcode = 'P0001', message = 'publication_generation_verification_failed';
	end if;
end;
$$;

create view blendcalc_api.api_request_operations_dashboard
with (security_invoker = true)
as
with windows(window_name, window_start) as (
	values
		('24 hours'::text, now() - interval '24 hours'),
		('7 days'::text, now() - interval '7 days'),
		('35 days'::text, now() - interval '35 days')
)
select
	windows.window_name,
	observation.operation,
	observation.read_mode,
	count(*)::bigint as request_count,
	percentile_disc(0.5) within group (order by observation.total_duration_ms) as p50_total_duration_ms,
	percentile_disc(0.95) within group (order by observation.total_duration_ms) as p95_total_duration_ms,
	max(observation.total_duration_ms) as max_total_duration_ms,
	percentile_disc(0.5) within group (order by observation.database_duration_ms)
		filter (where observation.database_duration_ms is not null) as p50_database_duration_ms,
	percentile_disc(0.95) within group (order by observation.database_duration_ms)
		filter (where observation.database_duration_ms is not null) as p95_database_duration_ms,
	max(observation.database_duration_ms) as max_database_duration_ms,
	count(*) filter (where observation.response_status between 400 and 499)::bigint as client_error_count,
	count(*) filter (where observation.response_status >= 500)::bigint as server_error_count,
	count(*) filter (where observation.response_status = 429)::bigint as rate_limited_count,
	count(*) filter (where observation.cache_validation)::bigint as cache_validation_count,
	count(*) filter (where observation.cache_not_modified)::bigint as cache_not_modified_count,
	case
		when count(*) filter (where observation.cache_validation) = 0 then null
		else round(
			count(*) filter (where observation.cache_not_modified)::numeric
			/ count(*) filter (where observation.cache_validation),
			4
		)
	end as cache_effectiveness,
	sum(observation.result_count)::bigint as total_result_count,
	round(avg(observation.result_count)::numeric, 2) as average_result_count,
	max(observation.result_count) as max_result_count,
	max(observation.observed_at) as last_observed_at
from windows
join blendcalc_api.api_request_observations observation
	on observation.observed_at >= windows.window_start
group by windows.window_name, observation.operation, observation.read_mode;

create view blendcalc_api.api_shadow_parity_dashboard
with (security_invoker = true)
as
select
	operation,
	count(*)::bigint as comparison_count,
	count(*) filter (where not matches)::bigint as failure_count,
	max(observed_at) as last_observed_at,
	max(observed_at) filter (where not matches) as last_failure_at,
	percentile_disc(0.95) within group (order by source_duration_ms) as p95_source_duration_ms,
	percentile_disc(0.95) within group (order by target_duration_ms)
		filter (where target_duration_ms is not null) as p95_target_duration_ms
from blendcalc_api.api_shadow_parity_observations
where observed_at >= now() - interval '35 days'
group by operation;

create view blendcalc_api.publication_generation_operations_dashboard
with (security_invoker = true)
as
select
	generation.id as generation_id,
	generation.status,
	generation.source_project_ref,
	generation.source_catalog_hash,
	generation.target_catalog_hash,
	(generation.source_catalog_hash = generation.target_catalog_hash) as hashes_match,
	generation.expected_product_count,
	(select count(*)::integer from blendcalc_api.publication_products product where product.generation_id = generation.id) as target_product_count,
	generation.expected_revision_count,
	(select count(*)::integer from blendcalc_api.publication_product_revisions revision where revision.generation_id = generation.id) as target_revision_count,
	generation.expected_category_count,
	(select count(*)::integer from blendcalc_api.publication_categories category where category.generation_id = generation.id) as target_category_count,
	generation.expected_attribution_count,
	(select count(*)::integer from blendcalc_api.publication_source_attributions attribution where attribution.generation_id = generation.id) as target_attribution_count,
	generation.created_at,
	generation.ready_at,
	generation.activated_at,
	generation.retired_at,
	generation.failed_at,
	generation.failure_code,
	extract(epoch from (now() - coalesce(generation.activated_at, generation.created_at)))::bigint as state_age_seconds,
	extract(epoch from (generation.ready_at - generation.created_at)) * 1000 as build_duration_ms,
	extract(epoch from (generation.activated_at - generation.ready_at)) * 1000 as activation_duration_ms
from blendcalc_api.publication_generations generation;

create view blendcalc_api.publication_operations_dashboard
with (security_invoker = true)
as
select
	generation.generation_id as active_generation_id,
	generation.state_age_seconds as active_generation_age_seconds,
	generation.source_catalog_hash,
	generation.target_catalog_hash,
	generation.hashes_match,
	generation.expected_product_count as source_product_count,
	generation.target_product_count,
	(generation.expected_product_count = generation.target_product_count
		and generation.expected_revision_count = generation.target_revision_count
		and generation.expected_category_count = generation.target_category_count
		and generation.expected_attribution_count = generation.target_attribution_count) as counts_match,
	(select count(*)::integer from blendcalc_api.publication_generations where status = 'failed') as failed_generation_count,
	latest_run.id as latest_sync_run_id,
	latest_run.status as latest_sync_status,
	latest_run.outcome as latest_sync_outcome,
	latest_run.duration_ms as latest_sync_duration_ms,
	latest_run.added_product_count as latest_added_product_count,
	latest_run.removed_product_count as latest_removed_product_count,
	latest_run.failure_code as latest_sync_failure_code,
	latest_run.started_at as latest_sync_started_at,
	latest_request.read_mode as latest_production_read_mode,
	latest_request.observed_at as latest_request_observed_at
from blendcalc_api.publication_generation_operations_dashboard generation
left join lateral (
	select run.*
	from blendcalc_api.publication_sync_runs run
	order by run.started_at desc
	limit 1
) latest_run on true
left join lateral (
	select observation.read_mode, observation.observed_at
	from blendcalc_api.api_request_observations observation
	order by observation.observed_at desc
	limit 1
) latest_request on true
where generation.status = 'active';

revoke all on all functions in schema blendcalc_api from public, anon, authenticated;
revoke all on all tables in schema blendcalc_api from public, anon, authenticated;
grant execute on function blendcalc_api.record_api_request_observation(
	text, text, integer, double precision, double precision, integer, boolean, boolean
) to service_role;
grant execute on function blendcalc_api.record_api_shadow_parity_observation(
	text, boolean, text, double precision, text, double precision, text
) to service_role;
grant execute on function blendcalc_api.record_publication_generation_verification(uuid, text)
	to service_role;
grant select on blendcalc_api.api_request_operations_dashboard to service_role;
grant select on blendcalc_api.api_shadow_parity_dashboard to service_role;
grant select on blendcalc_api.publication_generation_operations_dashboard to service_role;
grant select on blendcalc_api.publication_operations_dashboard to service_role;

comment on table blendcalc_api.api_request_observations is
	'Privacy-safe bounded request telemetry. It stores no URL, query, barcode, user, network address, credential, or response payload.';
comment on table blendcalc_api.api_shadow_parity_observations is
	'Privacy-safe source-to-isolated response parity hashes and timings without request identifiers.';
comment on view blendcalc_api.publication_operations_dashboard is
	'Current operator summary for publication generation integrity, synchronization, and production read location.';
