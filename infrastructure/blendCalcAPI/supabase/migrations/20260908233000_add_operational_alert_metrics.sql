alter table blendcalc_api.api_request_observations
	add column database_failed boolean not null default false;

create function blendcalc_api.record_api_request_observation_v2(
	p_operation text,
	p_read_mode text,
	p_response_status integer,
	p_total_duration_ms double precision,
	p_database_duration_ms double precision default null,
	p_result_count integer default 0,
	p_cache_validation boolean default false,
	p_cache_not_modified boolean default false,
	p_database_failed boolean default false
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
		cache_not_modified,
		database_failed
	)
	values (
		p_operation,
		p_read_mode,
		p_response_status,
		p_total_duration_ms,
		p_database_duration_ms,
		p_result_count,
		p_cache_validation,
		p_cache_not_modified,
		p_database_failed
	);

	delete from blendcalc_api.api_request_observations
	where observed_at < now() - interval '35 days';
end;
$$;

create or replace view blendcalc_api.api_request_operations_dashboard
with (security_invoker = true)
as
with windows(window_name, window_start) as (
	values
		('15 minutes'::text, now() - interval '15 minutes'),
		('1 hour'::text, now() - interval '1 hour'),
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
	max(observation.observed_at) as last_observed_at,
	count(*) filter (where observation.database_failed)::bigint as database_failure_count
from windows
join blendcalc_api.api_request_observations observation
	on observation.observed_at >= windows.window_start
group by windows.window_name, observation.operation, observation.read_mode;

create view blendcalc_api.api_shadow_parity_alert_dashboard
with (security_invoker = true)
as
with windows(window_name, window_start) as (
	values
		('15 minutes'::text, now() - interval '15 minutes'),
		('1 hour'::text, now() - interval '1 hour'),
		('24 hours'::text, now() - interval '24 hours')
)
select
	windows.window_name,
	observation.operation,
	count(*)::bigint as comparison_count,
	count(*) filter (where not observation.matches)::bigint as failure_count,
	max(observation.observed_at) as last_observed_at,
	max(observation.observed_at) filter (where not observation.matches) as last_failure_at
from windows
join blendcalc_api.api_shadow_parity_observations observation
	on observation.observed_at >= windows.window_start
group by windows.window_name, observation.operation;

create view blendcalc_api.api_key_usage_operations_dashboard
with (security_invoker = true)
as
with windows(window_name, window_start) as (
	values
		('15 minutes'::text, now() - interval '15 minutes'),
		('1 hour'::text, now() - interval '1 hour'),
		('24 hours'::text, now() - interval '24 hours')
), per_key as (
	select
		windows.window_name,
		log.actor_hash,
		count(*)::bigint as request_count,
		count(*) filter (where log.rate_limit_result = 'denied')::bigint as denied_count,
		count(*) filter (where log.response_status = 429)::bigint as rate_limited_count
	from windows
	join blendcalc_api.safe_request_logs log
		on log.observed_at >= windows.window_start
	where log.actor_type = 'api-key'
	group by windows.window_name, log.actor_hash
)
select
	window_name,
	count(*)::bigint as active_key_count,
	sum(request_count)::bigint as request_count,
	max(request_count)::bigint as max_requests_per_key,
	sum(denied_count)::bigint as denied_count,
	max(denied_count)::bigint as max_denied_per_key,
	sum(rate_limited_count)::bigint as rate_limited_count
from per_key
group by window_name;

revoke all on function blendcalc_api.record_api_request_observation_v2(
	text, text, integer, double precision, double precision, integer, boolean, boolean, boolean
) from public, anon, authenticated;
grant execute on function blendcalc_api.record_api_request_observation_v2(
	text, text, integer, double precision, double precision, integer, boolean, boolean, boolean
) to service_role;

revoke all on blendcalc_api.api_shadow_parity_alert_dashboard
	from public, anon, authenticated;
revoke all on blendcalc_api.api_key_usage_operations_dashboard
	from public, anon, authenticated;
grant select on blendcalc_api.api_shadow_parity_alert_dashboard to service_role;
grant select on blendcalc_api.api_key_usage_operations_dashboard to service_role;

comment on column blendcalc_api.api_request_observations.database_failed is
	'True only when a versioned API request reached and failed its database read boundary.';
comment on view blendcalc_api.api_shadow_parity_alert_dashboard is
	'Privacy-safe recent shadow-read mismatch counts for automated operational alerting.';
comment on view blendcalc_api.api_key_usage_operations_dashboard is
	'Aggregate API-key request and denial counts for anomaly alerts; never exposes a key or actor hash.';
