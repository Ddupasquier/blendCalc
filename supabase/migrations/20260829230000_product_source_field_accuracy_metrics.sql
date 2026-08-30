create table public.product_source_field_daily_metrics (
	metric_date date not null,
	source_key text not null references public.product_data_sources(key) on delete cascade,
	field_path text not null check (btrim(field_path) <> ''),
	evaluation_origin text not null default 'runtime-catalog'
		check (evaluation_origin in ('runtime-catalog', 'benchmark')),
	evaluated_count bigint not null default 0 check (evaluated_count >= 0),
	selected_count bigint not null default 0 check (selected_count >= 0),
	internally_invalid_count bigint not null default 0 check (internally_invalid_count >= 0),
	cross_source_disagreement_count bigint not null default 0
		check (cross_source_disagreement_count >= 0),
	submitted_label_disagreement_count bigint not null default 0
		check (submitted_label_disagreement_count >= 0),
	confirmed_label_correction_count bigint not null default 0
		check (confirmed_label_correction_count >= 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (metric_date, source_key, field_path, evaluation_origin),
	check (selected_count <= evaluated_count),
	check (internally_invalid_count <= evaluated_count),
	check (cross_source_disagreement_count <= evaluated_count),
	check (submitted_label_disagreement_count <= evaluated_count)
);

create index product_source_field_metrics_source_date_idx
	on public.product_source_field_daily_metrics (
		source_key,
		metric_date desc,
		field_path
	);

alter table public.product_source_field_daily_metrics enable row level security;
alter table public.product_source_field_daily_metrics force row level security;
revoke all on table public.product_source_field_daily_metrics
	from public, anon, authenticated;
grant all on table public.product_source_field_daily_metrics to service_role;

create function public.record_product_source_field_daily_metrics(
	p_metric_increments jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if jsonb_typeof(p_metric_increments) <> 'array' then
		raise exception 'Product source field metric increments must be a JSON array.';
	end if;

	insert into public.product_source_field_daily_metrics (
		metric_date,
		source_key,
		field_path,
		evaluation_origin,
		evaluated_count,
		selected_count,
		internally_invalid_count,
		cross_source_disagreement_count,
		submitted_label_disagreement_count,
		confirmed_label_correction_count
	)
	select
		(timezone('utc', now()))::date,
		increment.source_key,
		btrim(increment.field_path),
		'runtime-catalog',
		greatest(coalesce(increment.evaluated_count, 0), 0),
		greatest(coalesce(increment.selected_count, 0), 0),
		greatest(coalesce(increment.internally_invalid_count, 0), 0),
		greatest(coalesce(increment.cross_source_disagreement_count, 0), 0),
		greatest(coalesce(increment.submitted_label_disagreement_count, 0), 0),
		greatest(coalesce(increment.confirmed_label_correction_count, 0), 0)
	from jsonb_to_recordset(p_metric_increments) as increment(
		source_key text,
		field_path text,
		evaluated_count bigint,
		selected_count bigint,
		internally_invalid_count bigint,
		cross_source_disagreement_count bigint,
		submitted_label_disagreement_count bigint,
		confirmed_label_correction_count bigint
	)
	where btrim(coalesce(increment.field_path, '')) <> ''
	on conflict (metric_date, source_key, field_path, evaluation_origin)
	do update set
		evaluated_count = public.product_source_field_daily_metrics.evaluated_count
			+ excluded.evaluated_count,
		selected_count = public.product_source_field_daily_metrics.selected_count
			+ excluded.selected_count,
		internally_invalid_count = public.product_source_field_daily_metrics.internally_invalid_count
			+ excluded.internally_invalid_count,
		cross_source_disagreement_count = public.product_source_field_daily_metrics.cross_source_disagreement_count
			+ excluded.cross_source_disagreement_count,
		submitted_label_disagreement_count = public.product_source_field_daily_metrics.submitted_label_disagreement_count
			+ excluded.submitted_label_disagreement_count,
		confirmed_label_correction_count = public.product_source_field_daily_metrics.confirmed_label_correction_count
			+ excluded.confirmed_label_correction_count,
		updated_at = now();
end;
$$;

revoke all on function public.record_product_source_field_daily_metrics(jsonb)
	from public, anon, authenticated;
grant execute on function public.record_product_source_field_daily_metrics(jsonb)
	to service_role;
