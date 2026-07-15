create table public.product_data_sources (
	key text primary key check (btrim(key) <> ''),
	display_name text not null check (btrim(display_name) <> ''),
	source_type text not null check (source_type in ('external_api', 'internal_catalog', 'standards_api')),
	homepage_url text,
	api_base_url text,
	terms_url text,
	attribution_text text,
	enabled boolean not null default true,
	observation_count integer not null default 0 check (observation_count >= 0),
	first_observed_at timestamptz,
	last_observed_at timestamptz,
	provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create trigger set_product_data_sources_updated_at
	before update on public.product_data_sources
	for each row execute function public.set_updated_at();

create index product_data_sources_enabled_idx
	on public.product_data_sources (source_type, key)
	where enabled;

create table public.nutrient_source_mappings (
	source_key text not null references public.product_data_sources(key) on delete cascade,
	source_nutrient_key text not null check (btrim(source_nutrient_key) <> ''),
	source_unit_name text not null default '',
	source_nutrient_name text,
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete cascade,
	priority integer not null default 100 check (priority >= 0),
	mapping_method text not null check (
		mapping_method in ('api_id_match', 'api_taxonomy_match', 'api_observation_match', 'moderator_verified')
	),
	confidence numeric(5, 4) not null check (confidence >= 0 and confidence <= 1),
	enabled boolean not null default true,
	observation_count integer not null default 0 check (observation_count >= 0),
	first_observed_at timestamptz,
	last_observed_at timestamptz,
	provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (source_key, source_nutrient_key, source_unit_name)
);

create trigger set_nutrient_source_mappings_updated_at
	before update on public.nutrient_source_mappings
	for each row execute function public.set_updated_at();

create index nutrient_source_mappings_lookup_idx
	on public.nutrient_source_mappings (source_key, source_nutrient_key, priority, nutrient_id)
	where enabled;

create index nutrient_source_mappings_nutrient_idx
	on public.nutrient_source_mappings (nutrient_id, source_key)
	where enabled;

create table public.nutrient_unit_conversions (
	source_key text not null references public.product_data_sources(key) on delete cascade,
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete cascade,
	from_unit_name text not null check (btrim(from_unit_name) <> ''),
	to_unit_name text not null check (btrim(to_unit_name) <> ''),
	multiplier numeric not null check (multiplier > 0),
	conversion_method text not null check (
		conversion_method in ('api_observed_ratio', 'standards_api', 'moderator_verified')
	),
	confidence numeric(5, 4) not null check (confidence >= 0 and confidence <= 1),
	observation_count integer not null default 0 check (observation_count >= 0),
	provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (source_key, nutrient_id, from_unit_name, to_unit_name),
	check (upper(from_unit_name) <> upper(to_unit_name))
);

create trigger set_nutrient_unit_conversions_updated_at
	before update on public.nutrient_unit_conversions
	for each row execute function public.set_updated_at();

create index nutrient_unit_conversions_lookup_idx
	on public.nutrient_unit_conversions (source_key, nutrient_id, from_unit_name, to_unit_name);

create table public.serving_measure_units (
	key text primary key check (btrim(key) <> ''),
	display_label text not null check (btrim(display_label) <> ''),
	short_label text not null check (btrim(short_label) <> ''),
	dimension text not null check (dimension in ('weight', 'volume')),
	base_unit_key text not null check (base_unit_key in ('g', 'ml')),
	conversion_to_base numeric not null check (conversion_to_base > 0),
	standards_code text not null check (btrim(standards_code) <> ''),
	display_order integer not null check (display_order >= 0),
	is_default boolean not null default false,
	enabled boolean not null default true,
	source_key text not null references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	observed_at timestamptz not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (display_order)
);

create trigger set_serving_measure_units_updated_at
	before update on public.serving_measure_units
	for each row execute function public.set_updated_at();

create unique index serving_measure_units_default_dimension_idx
	on public.serving_measure_units (dimension)
	where is_default and enabled;

create index serving_measure_units_enabled_idx
	on public.serving_measure_units (dimension, display_order, key)
	where enabled;

create table public.serving_measure_aliases (
	unit_key text not null references public.serving_measure_units(key) on delete cascade,
	alias text not null check (btrim(alias) <> ''),
	normalized_alias text not null check (btrim(normalized_alias) <> ''),
	source_key text not null references public.product_data_sources(key) on delete restrict,
	observation_count integer not null default 0 check (observation_count >= 0),
	first_observed_at timestamptz,
	last_observed_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (unit_key, normalized_alias),
	unique (normalized_alias)
);

create trigger set_serving_measure_aliases_updated_at
	before update on public.serving_measure_aliases
	for each row execute function public.set_updated_at();

create index serving_measure_aliases_unit_idx
	on public.serving_measure_aliases (unit_key, normalized_alias);

alter table public.product_data_sources enable row level security;
alter table public.product_data_sources force row level security;
alter table public.nutrient_source_mappings enable row level security;
alter table public.nutrient_source_mappings force row level security;
alter table public.nutrient_unit_conversions enable row level security;
alter table public.nutrient_unit_conversions force row level security;
alter table public.serving_measure_units enable row level security;
alter table public.serving_measure_units force row level security;
alter table public.serving_measure_aliases enable row level security;
alter table public.serving_measure_aliases force row level security;

create policy "Authenticated users can read product data sources"
	on public.product_data_sources for select to authenticated using (true);
create policy "Authenticated users can read nutrient source mappings"
	on public.nutrient_source_mappings for select to authenticated using (true);
create policy "Authenticated users can read nutrient unit conversions"
	on public.nutrient_unit_conversions for select to authenticated using (true);
create policy "Authenticated users can read serving measure units"
	on public.serving_measure_units for select to authenticated using (true);
create policy "Authenticated users can read serving measure aliases"
	on public.serving_measure_aliases for select to authenticated using (true);

revoke all on table public.product_data_sources from public, anon, authenticated;
revoke all on table public.nutrient_source_mappings from public, anon, authenticated;
revoke all on table public.nutrient_unit_conversions from public, anon, authenticated;
revoke all on table public.serving_measure_units from public, anon, authenticated;
revoke all on table public.serving_measure_aliases from public, anon, authenticated;

grant select on table public.product_data_sources to authenticated;
grant select on table public.nutrient_source_mappings to authenticated;
grant select on table public.nutrient_unit_conversions to authenticated;
grant select on table public.serving_measure_units to authenticated;
grant select on table public.serving_measure_aliases to authenticated;

grant all on table public.product_data_sources to service_role;
grant all on table public.nutrient_source_mappings to service_role;
grant all on table public.nutrient_unit_conversions to service_role;
grant all on table public.serving_measure_units to service_role;
grant all on table public.serving_measure_aliases to service_role;
