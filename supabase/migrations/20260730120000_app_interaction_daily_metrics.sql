begin;

create table public.app_interaction_daily_metrics (
	metric_date date not null,
	metric_key text not null
		check (metric_key ~ '^[a-z][a-z0-9_]{0,63}$'),
	dimension_key text not null default 'all'
		check (dimension_key in ('all', 'route')),
	dimension_value text not null default 'all'
		check (char_length(dimension_value) between 1 and 240),
	metric_source text not null default 'vercel_web_analytics'
		check (metric_source = 'vercel_web_analytics'),
	environment text not null default 'production'
		check (environment = 'production'),
	event_count bigint not null
		check (event_count >= 0),
	visitor_count bigint
		check (visitor_count is null or visitor_count >= 0),
	source_query_version smallint not null default 1
		check (source_query_version > 0),
	created_at timestamptz not null default now(),
	synced_at timestamptz not null default now(),
	primary key (
		metric_date,
		metric_key,
		dimension_key,
		dimension_value,
		metric_source,
		environment
	),
	check (
		(dimension_key = 'all' and dimension_value = 'all')
		or (
			dimension_key = 'route'
			and dimension_value like '/%'
		)
	)
);

create index app_interaction_daily_metrics_metric_date_idx
	on public.app_interaction_daily_metrics (
		metric_key,
		metric_date desc
	);

alter table public.app_interaction_daily_metrics enable row level security;

revoke all
	on table public.app_interaction_daily_metrics
	from public, anon, authenticated, service_role;

grant select
	on table public.app_interaction_daily_metrics
	to service_role;

create or replace function public.replace_app_interaction_daily_metrics(
	p_since date,
	p_until date,
	p_metrics jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_metric jsonb;
	v_metric_date date;
	v_metric_key text;
	v_dimension_key text;
	v_dimension_value text;
	v_event_count bigint;
	v_visitor_count bigint;
	v_synced_at timestamptz := clock_timestamp();
	v_inserted integer := 0;
begin
	if p_since is null
		or p_until is null
		or p_since > p_until
		or (p_until - p_since) > 31
	then
		raise exception 'Interaction metric replacement range is invalid.'
			using errcode = '22023';
	end if;

	if p_metrics is null
		or jsonb_typeof(p_metrics) <> 'array'
		or jsonb_array_length(p_metrics) > 500
	then
		raise exception 'Interaction metric payload must be a bounded array.'
			using errcode = '22023';
	end if;

	delete from public.app_interaction_daily_metrics
	where metric_date between p_since and p_until
		and metric_source = 'vercel_web_analytics'
		and environment = 'production';

	for v_metric in
		select value
		from jsonb_array_elements(p_metrics)
	loop
		if jsonb_typeof(v_metric) <> 'object'
			or (
				v_metric - array[
					'metric_date',
					'metric_key',
					'dimension_key',
					'dimension_value',
					'event_count',
					'visitor_count'
				]
			) <> '{}'::jsonb
		then
			raise exception 'Interaction metric row contains unsupported fields.'
				using errcode = '22023';
		end if;

		v_metric_date := (v_metric ->> 'metric_date')::date;
		v_metric_key := v_metric ->> 'metric_key';
		v_dimension_key := coalesce(v_metric ->> 'dimension_key', 'all');
		v_dimension_value := coalesce(v_metric ->> 'dimension_value', 'all');
		v_event_count := (v_metric ->> 'event_count')::bigint;
		v_visitor_count := case
			when not (v_metric ? 'visitor_count')
				or jsonb_typeof(v_metric -> 'visitor_count') = 'null'
				then null
			else (v_metric ->> 'visitor_count')::bigint
		end;

		if v_metric_date not between p_since and p_until
			or v_metric_key is null
			or v_metric_key !~ '^[a-z][a-z0-9_]{0,63}$'
			or v_dimension_key not in ('all', 'route')
			or char_length(v_dimension_value) not between 1 and 240
			or (
				v_dimension_key = 'all'
				and v_dimension_value <> 'all'
			)
			or (
				v_dimension_key = 'route'
				and v_dimension_value not like '/%'
			)
			or v_event_count < 0
			or (v_visitor_count is not null and v_visitor_count < 0)
		then
			raise exception 'Interaction metric row is invalid.'
				using errcode = '22023';
		end if;

		insert into public.app_interaction_daily_metrics (
			metric_date,
			metric_key,
			dimension_key,
			dimension_value,
			event_count,
			visitor_count,
			synced_at
		)
		values (
			v_metric_date,
			v_metric_key,
			v_dimension_key,
			v_dimension_value,
			v_event_count,
			v_visitor_count,
			v_synced_at
		)
		on conflict (
			metric_date,
			metric_key,
			dimension_key,
			dimension_value,
			metric_source,
			environment
		)
		do update set
			event_count = excluded.event_count,
			visitor_count = excluded.visitor_count,
			source_query_version = excluded.source_query_version,
			synced_at = excluded.synced_at;

		v_inserted := v_inserted + 1;
	end loop;

	return v_inserted;
end;
$$;

revoke all
	on function public.replace_app_interaction_daily_metrics(date, date, jsonb)
	from public, anon, authenticated;

grant execute
	on function public.replace_app_interaction_daily_metrics(date, date, jsonb)
	to service_role;

comment on table public.app_interaction_daily_metrics is
	'Private daily interaction totals synchronized from Vercel Web Analytics. Stores aggregate counts only; never user identifiers, IP addresses, emails, raw URLs, or event payloads.';

comment on function public.replace_app_interaction_daily_metrics(date, date, jsonb) is
	'Atomically replaces a bounded production date range of privacy-safe Vercel interaction aggregates. Service role only.';

commit;
