create table public.custom_food_category_mappings (
	source_normalized_value text primary key check (btrim(source_normalized_value) <> ''),
	source_value text not null check (btrim(source_value) <> ''),
	source_values text[] not null default '{}'::text[],
	source_fields text[] not null default '{}'::text[],
	sources text[] not null default '{}'::text[],
	category_option_id text not null references public.custom_food_category_options(id) on delete restrict,
	category_option_label text not null check (btrim(category_option_label) <> ''),
	confidence text not null default 'exact' check (
		confidence in ('exact', 'strong', 'related', 'needs_review')
	),
	match_reason text not null check (btrim(match_reason) <> ''),
	source_count integer not null default 0 check (source_count >= 0),
	observation_count integer not null default 0 check (observation_count >= 0),
	first_seen_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index custom_food_category_mappings_option_idx
	on public.custom_food_category_mappings (
		category_option_id,
		confidence
	);

create index custom_food_category_mappings_confidence_idx
	on public.custom_food_category_mappings (
		confidence,
		observation_count desc
	);

create trigger set_custom_food_category_mappings_updated_at
	before update on public.custom_food_category_mappings
	for each row execute function public.set_updated_at();

alter table public.custom_food_category_mappings enable row level security;
alter table public.custom_food_category_mappings force row level security;

create policy "Authenticated users can read custom food category mappings"
	on public.custom_food_category_mappings
	for select
	to authenticated
	using (true);

revoke all on table public.custom_food_category_mappings
	from public, anon, authenticated;
grant select on table public.custom_food_category_mappings to authenticated;
grant all on table public.custom_food_category_mappings to service_role;
