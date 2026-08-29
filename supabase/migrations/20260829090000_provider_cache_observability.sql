alter table public.product_source_daily_metrics
	add column cache_miss_count bigint not null default 0 check (cache_miss_count >= 0),
	add column stale_fallback_count bigint not null default 0 check (stale_fallback_count >= 0),
	add column coalesced_request_count bigint not null default 0 check (coalesced_request_count >= 0);

create table public.product_source_request_budgets (
	provider_key text not null references public.product_data_sources(key) on delete cascade,
	request_kind text not null check (btrim(request_kind) <> ''),
	window_seconds integer not null check (window_seconds between 1 and 86400),
	max_requests integer not null check (max_requests > 0),
	warning_threshold_percent integer not null default 80
		check (warning_threshold_percent between 1 and 100),
	enabled boolean not null default true,
	notes text not null default '',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (provider_key, request_kind)
);

create trigger set_product_source_request_budgets_updated_at
	before update on public.product_source_request_budgets
	for each row execute function public.set_updated_at();

alter table public.product_source_request_budgets enable row level security;
alter table public.product_source_request_budgets force row level security;
revoke all on table public.product_source_request_budgets from public, anon, authenticated;
grant all on table public.product_source_request_budgets to service_role;

insert into public.product_source_request_budgets (
	provider_key,
	request_kind,
	window_seconds,
	max_requests,
	warning_threshold_percent,
	notes
)
select source.key, budget.request_kind, budget.window_seconds,
	budget.max_requests, 80, budget.notes
from (
	values
		('usda'::text, '*'::text, 3600, 900, 'Internal hourly ceiling below the reviewed USDA provider limit.'::text),
		('open-food-facts'::text, '*'::text, 60, 50, 'Conservative internal per-minute ceiling for runtime product lookups.'::text),
		('cola-cloud'::text, '*'::text, 60, 30, 'Conservative trial ceiling; durable COLA response storage remains disabled.'::text)
) as budget(provider_key, request_kind, window_seconds, max_requests, notes)
join public.product_data_sources source on source.key = budget.provider_key
on conflict (provider_key, request_kind) do nothing;

create or replace function public.record_product_source_daily_metric(
	p_source_key text,
	p_source_data_type text,
	p_lookup_kind text,
	p_lookup_origin text,
	p_lookup_count bigint,
	p_api_request_count bigint,
	p_api_error_count bigint,
	p_cache_hit_count bigint,
	p_cache_miss_count bigint,
	p_stale_fallback_count bigint,
	p_coalesced_request_count bigint,
	p_completed_lookup_count bigint,
	p_match_count bigint,
	p_exact_barcode_match_count bigint,
	p_error_count bigint,
	p_evaluated_product_count bigint,
	p_reported_nutrient_total bigint,
	p_brand_present_count bigint,
	p_category_present_count bigint,
	p_serving_present_count bigint,
	p_ingredients_present_count bigint,
	p_image_present_count bigint,
	p_response_milliseconds_total bigint
)
returns void
language sql
security definer
set search_path = ''
as $$
	insert into public.product_source_daily_metrics (
		metric_date,
		source_key,
		source_data_type,
		lookup_kind,
		lookup_origin,
		lookup_count,
		api_request_count,
		api_error_count,
		cache_hit_count,
		cache_miss_count,
		stale_fallback_count,
		coalesced_request_count,
		completed_lookup_count,
		match_count,
		exact_barcode_match_count,
		error_count,
		evaluated_product_count,
		reported_nutrient_total,
		brand_present_count,
		category_present_count,
		serving_present_count,
		ingredients_present_count,
		image_present_count,
		response_milliseconds_total
	)
	values (
		(timezone('utc', now()))::date,
		p_source_key,
		coalesce(btrim(p_source_data_type), ''),
		p_lookup_kind,
		p_lookup_origin,
		p_lookup_count,
		p_api_request_count,
		p_api_error_count,
		p_cache_hit_count,
		p_cache_miss_count,
		p_stale_fallback_count,
		p_coalesced_request_count,
		p_completed_lookup_count,
		p_match_count,
		p_exact_barcode_match_count,
		p_error_count,
		p_evaluated_product_count,
		p_reported_nutrient_total,
		p_brand_present_count,
		p_category_present_count,
		p_serving_present_count,
		p_ingredients_present_count,
		p_image_present_count,
		p_response_milliseconds_total
	)
	on conflict (metric_date, source_key, source_data_type, lookup_kind, lookup_origin)
	do update set
		lookup_count = public.product_source_daily_metrics.lookup_count + excluded.lookup_count,
		api_request_count = public.product_source_daily_metrics.api_request_count + excluded.api_request_count,
		api_error_count = public.product_source_daily_metrics.api_error_count + excluded.api_error_count,
		cache_hit_count = public.product_source_daily_metrics.cache_hit_count + excluded.cache_hit_count,
		cache_miss_count = public.product_source_daily_metrics.cache_miss_count + excluded.cache_miss_count,
		stale_fallback_count = public.product_source_daily_metrics.stale_fallback_count + excluded.stale_fallback_count,
		coalesced_request_count = public.product_source_daily_metrics.coalesced_request_count + excluded.coalesced_request_count,
		completed_lookup_count = public.product_source_daily_metrics.completed_lookup_count + excluded.completed_lookup_count,
		match_count = public.product_source_daily_metrics.match_count + excluded.match_count,
		exact_barcode_match_count = public.product_source_daily_metrics.exact_barcode_match_count + excluded.exact_barcode_match_count,
		error_count = public.product_source_daily_metrics.error_count + excluded.error_count,
		evaluated_product_count = public.product_source_daily_metrics.evaluated_product_count + excluded.evaluated_product_count,
		reported_nutrient_total = public.product_source_daily_metrics.reported_nutrient_total + excluded.reported_nutrient_total,
		brand_present_count = public.product_source_daily_metrics.brand_present_count + excluded.brand_present_count,
		category_present_count = public.product_source_daily_metrics.category_present_count + excluded.category_present_count,
		serving_present_count = public.product_source_daily_metrics.serving_present_count + excluded.serving_present_count,
		ingredients_present_count = public.product_source_daily_metrics.ingredients_present_count + excluded.ingredients_present_count,
		image_present_count = public.product_source_daily_metrics.image_present_count + excluded.image_present_count,
		response_milliseconds_total = public.product_source_daily_metrics.response_milliseconds_total + excluded.response_milliseconds_total,
		updated_at = now();
$$;

revoke all on function public.record_product_source_daily_metric(
	text, text, text, text, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
	bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
	bigint, bigint
) from public, anon, authenticated;
grant execute on function public.record_product_source_daily_metric(
	text, text, text, text, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
	bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint,
	bigint, bigint
) to service_role;

create function public.cleanup_expired_product_api_cache(
	p_before timestamptz default now(),
	p_limit integer default 1000
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_deleted integer;
begin
	if p_limit < 1 or p_limit > 10000 then
		raise exception 'Cache cleanup limit must be between 1 and 10000.';
	end if;

	with expired as (
		select provider, cache_key
		from public.product_api_cache
		where expires_at < p_before
		order by expires_at
		limit p_limit
		for update skip locked
	),
	deleted as (
		delete from public.product_api_cache cache
		using expired
		where cache.provider = expired.provider
			and cache.cache_key = expired.cache_key
		returning 1
	)
	select count(*)::integer into v_deleted from deleted;

	return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_product_api_cache(timestamptz, integer)
	from public, anon, authenticated;
grant execute on function public.cleanup_expired_product_api_cache(timestamptz, integer)
	to service_role;

create function public.get_product_api_cache_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	select jsonb_build_object(
		'totalRows', count(*),
		'expiredRows', count(*) filter (where cache.expires_at < now()),
		'oldestFetchAt', min(cache.fetched_at),
		'newestFetchAt', max(cache.fetched_at),
		'approximateBytes', pg_total_relation_size('public.product_api_cache'::regclass),
		'providers', coalesce((
			select jsonb_agg(provider_summary order by provider_summary->>'provider')
			from (
				select jsonb_build_object(
					'provider', provider,
					'requestKind', request_kind,
					'rows', count(*),
					'expiredRows', count(*) filter (where expires_at < now())
				) as provider_summary
				from public.product_api_cache
				group by provider, request_kind
			) summaries
		), '[]'::jsonb),
		'budgets', coalesce((
			select jsonb_agg(to_jsonb(budget) order by budget.provider_key, budget.request_kind)
			from public.product_source_request_budgets budget
			where budget.enabled
		), '[]'::jsonb)
	)
	from public.product_api_cache cache;
$$;

revoke all on function public.get_product_api_cache_health()
	from public, anon, authenticated;
grant execute on function public.get_product_api_cache_health()
	to service_role;

comment on table public.product_source_request_budgets is
	'Internal provider/request-kind budgets shown with cache and source metrics; these are operational ceilings, not claims about provider contract limits.';
comment on function public.cleanup_expired_product_api_cache(timestamptz, integer) is
	'Deletes one bounded batch of expired provider-cache rows for service-role maintenance.';
comment on function public.get_product_api_cache_health() is
	'Returns service-only cache row, size, expiry, provider, and configured request-budget health.';
