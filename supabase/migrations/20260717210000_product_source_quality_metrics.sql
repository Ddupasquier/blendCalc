create table public.product_source_daily_metrics (
	metric_date date not null,
	source_key text not null references public.product_data_sources(key) on delete cascade,
	source_data_type text not null default '',
	lookup_kind text not null check (lookup_kind in ('barcode', 'generic-search')),
	lookup_origin text not null default 'runtime' check (lookup_origin in ('runtime', 'benchmark')),
	lookup_count bigint not null default 0 check (lookup_count >= 0),
	api_request_count bigint not null default 0 check (api_request_count >= 0),
	api_error_count bigint not null default 0 check (api_error_count >= 0),
	cache_hit_count bigint not null default 0 check (cache_hit_count >= 0),
	completed_lookup_count bigint not null default 0 check (completed_lookup_count >= 0),
	match_count bigint not null default 0 check (match_count >= 0),
	exact_barcode_match_count bigint not null default 0 check (exact_barcode_match_count >= 0),
	error_count bigint not null default 0 check (error_count >= 0),
	evaluated_product_count bigint not null default 0 check (evaluated_product_count >= 0),
	reported_nutrient_total bigint not null default 0 check (reported_nutrient_total >= 0),
	brand_present_count bigint not null default 0 check (brand_present_count >= 0),
	category_present_count bigint not null default 0 check (category_present_count >= 0),
	serving_present_count bigint not null default 0 check (serving_present_count >= 0),
	ingredients_present_count bigint not null default 0 check (ingredients_present_count >= 0),
	image_present_count bigint not null default 0 check (image_present_count >= 0),
	response_milliseconds_total bigint not null default 0 check (response_milliseconds_total >= 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (metric_date, source_key, source_data_type, lookup_kind, lookup_origin),
	check (completed_lookup_count + error_count <= lookup_count),
	check (match_count <= completed_lookup_count),
	check (exact_barcode_match_count <= match_count),
	check (evaluated_product_count <= match_count),
	check (brand_present_count <= evaluated_product_count),
	check (category_present_count <= evaluated_product_count),
	check (serving_present_count <= evaluated_product_count),
	check (ingredients_present_count <= evaluated_product_count),
	check (image_present_count <= evaluated_product_count)
);

create index product_source_daily_metrics_source_date_idx
	on public.product_source_daily_metrics (source_key, metric_date desc, lookup_kind);

alter table public.product_source_daily_metrics enable row level security;
alter table public.product_source_daily_metrics force row level security;

revoke all on table public.product_source_daily_metrics from public, anon, authenticated;
grant all on table public.product_source_daily_metrics to service_role;

create function public.record_product_source_daily_metric(
	p_source_key text,
	p_source_data_type text,
	p_lookup_kind text,
	p_lookup_origin text,
	p_lookup_count bigint,
	p_api_request_count bigint,
	p_api_error_count bigint,
	p_cache_hit_count bigint,
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

revoke all on function public.record_product_source_daily_metric
	from public, anon, authenticated;
grant execute on function public.record_product_source_daily_metric
	to service_role;
