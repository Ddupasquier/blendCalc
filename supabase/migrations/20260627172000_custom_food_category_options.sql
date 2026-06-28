create table public.custom_food_category_options (
	id text primary key check (btrim(id) <> ''),
	label text not null check (btrim(label) <> ''),
	normalized_value text not null unique check (btrim(normalized_value) <> ''),
	sources text[] not null default '{}'::text[],
	source_count integer not null default 0 check (source_count >= 0),
	observation_count integer not null default 0 check (observation_count >= 0),
	verification_status text not null default 'single_source' check (
		verification_status in ('single_source', 'multi_source_verified')
	),
	enabled boolean not null default true,
	first_seen_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.custom_food_category_observations (
	id bigint generated always as identity primary key,
	category_id text not null check (btrim(category_id) <> ''),
	label text not null check (btrim(label) <> ''),
	normalized_value text not null check (btrim(normalized_value) <> ''),
	source text not null check (
		source in ('fdc-search', 'fdc-branded-detail', 'open-food-facts')
	),
	query text not null check (btrim(query) <> ''),
	source_field text not null check (btrim(source_field) <> ''),
	source_value text not null check (btrim(source_value) <> ''),
	source_reference text,
	source_payload jsonb not null default '{}'::jsonb,
	observation_count integer not null default 1 check (observation_count > 0),
	first_seen_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (
		source,
		query,
		source_field,
		normalized_value,
		source_reference
	)
);

create index custom_food_category_options_label_idx
	on public.custom_food_category_options (
		enabled,
		label asc
	);

create index custom_food_category_observations_category_idx
	on public.custom_food_category_observations (
		category_id,
		last_seen_at desc
	);

create index custom_food_category_observations_source_idx
	on public.custom_food_category_observations (
		source,
		last_seen_at desc
	);

create trigger set_custom_food_category_options_updated_at
	before update on public.custom_food_category_options
	for each row execute function public.set_updated_at();

create trigger set_custom_food_category_observations_updated_at
	before update on public.custom_food_category_observations
	for each row execute function public.set_updated_at();

create or replace function public.rebuild_custom_food_category_options()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.custom_food_category_options (
		id,
		label,
		normalized_value,
		sources,
		source_count,
		observation_count,
		verification_status,
		first_seen_at,
		last_seen_at
	)
	select
		observation.category_id,
		min(observation.label),
		observation.normalized_value,
		array_agg(distinct observation.source order by observation.source),
		count(distinct observation.source)::integer,
		sum(observation.observation_count)::integer,
		case
			when count(distinct observation.source) > 1 then 'multi_source_verified'
			else 'single_source'
		end,
		min(observation.first_seen_at),
		max(observation.last_seen_at)
	from public.custom_food_category_observations observation
	group by observation.category_id, observation.normalized_value
	on conflict (id) do update set
		label = excluded.label,
		normalized_value = excluded.normalized_value,
		sources = excluded.sources,
		source_count = excluded.source_count,
		observation_count = excluded.observation_count,
		verification_status = excluded.verification_status,
		first_seen_at = least(
			public.custom_food_category_options.first_seen_at,
			excluded.first_seen_at
		),
		last_seen_at = greatest(
			public.custom_food_category_options.last_seen_at,
			excluded.last_seen_at
		),
		enabled = true,
		updated_at = now();

	update public.custom_food_category_options option
	set
		enabled = false,
		updated_at = now()
	where not exists (
		select 1
		from public.custom_food_category_observations observation
		where observation.category_id = option.id
	);
end;
$$;

create or replace function public.sync_custom_food_category_options()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	perform public.rebuild_custom_food_category_options();
	return null;
end;
$$;

drop trigger if exists sync_custom_food_category_options_from_observations
	on public.custom_food_category_observations;
create trigger sync_custom_food_category_options_from_observations
	after insert or update or delete on public.custom_food_category_observations
	for each statement execute function public.sync_custom_food_category_options();

alter table public.custom_food_category_options enable row level security;
alter table public.custom_food_category_options force row level security;

alter table public.custom_food_category_observations enable row level security;
alter table public.custom_food_category_observations force row level security;

create policy "Authenticated users can read custom food category options"
	on public.custom_food_category_options
	for select
	to authenticated
	using (true);

create policy "Authenticated users can read custom food category observations"
	on public.custom_food_category_observations
	for select
	to authenticated
	using (true);

revoke all on table public.custom_food_category_options
	from public, anon, authenticated;
revoke all on table public.custom_food_category_observations
	from public, anon, authenticated;
grant select on table public.custom_food_category_options to authenticated;
grant select on table public.custom_food_category_observations to authenticated;

revoke all on function public.rebuild_custom_food_category_options()
	from public, anon, authenticated;
revoke all on function public.sync_custom_food_category_options()
	from public, anon, authenticated;
grant execute on function public.rebuild_custom_food_category_options()
	to service_role;
grant execute on function public.sync_custom_food_category_options()
	to service_role;
