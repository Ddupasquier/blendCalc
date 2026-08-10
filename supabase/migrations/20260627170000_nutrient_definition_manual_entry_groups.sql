do $$
begin
	if to_regclass('public.nutrient_manual_entry_observations') is not null then
		drop trigger if exists sync_nutrient_manual_entry_observations_after_change
			on public.nutrient_manual_entry_observations;
	end if;
end;
$$;
drop function if exists public.sync_nutrient_manual_entry_fields();
drop table if exists public.nutrient_manual_entry_observations;
drop table if exists public.nutrient_manual_entry_fields;
drop table if exists public.nutrient_manual_entry_groups;

create table public.nutrient_manual_entry_groups (
	id text primary key check (btrim(id) <> ''),
	entry_step text not null check (entry_step in ('macros', 'extended')),
	title text not null check (btrim(title) <> ''),
	sort_order integer not null check (sort_order > 0),
	enabled boolean not null default true,
	source_count integer not null default 0 check (source_count >= 0),
	observation_count integer not null default 0 check (observation_count >= 0),
	verification_status text not null default 'single_source' check (
		verification_status in ('single_source', 'multi_source_verified')
	),
	sources text[] not null default '{}'::text[],
	last_observed_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (entry_step, title),
	unique (entry_step, sort_order)
);

create trigger set_nutrient_manual_entry_groups_updated_at
	before update on public.nutrient_manual_entry_groups
	for each row execute function public.set_updated_at();

create index nutrient_manual_entry_groups_enabled_idx
	on public.nutrient_manual_entry_groups (entry_step, sort_order, id)
	where enabled;

create table public.nutrient_manual_entry_fields (
	dedupe_key text primary key check (btrim(dedupe_key) <> ''),
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete cascade,
	group_id text not null references public.nutrient_manual_entry_groups(id) on delete restrict,
	nutrient_type text not null check (
		nutrient_type in ('energy', 'macro', 'fat', 'carbohydrate', 'mineral', 'vitamin', 'amino_acid', 'other')
	),
	display_label text check (display_label is null or btrim(display_label) <> ''),
	sort_order integer not null check (sort_order > 0),
	enabled boolean not null default true,
	source_count integer not null default 0 check (source_count >= 0),
	observation_count integer not null default 0 check (observation_count >= 0),
	verification_status text not null default 'single_source' check (
		verification_status in ('single_source', 'multi_source_verified')
	),
	sources text[] not null default '{}'::text[],
	last_observed_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create trigger set_nutrient_manual_entry_fields_updated_at
	before update on public.nutrient_manual_entry_fields
	for each row execute function public.set_updated_at();

create index nutrient_manual_entry_fields_enabled_idx
	on public.nutrient_manual_entry_fields (group_id, sort_order, dedupe_key)
	where enabled;

create table public.nutrient_manual_entry_observations (
	id uuid primary key default gen_random_uuid(),
	source text not null check (btrim(source) <> ''),
	query text not null check (btrim(query) <> ''),
	source_reference text not null check (btrim(source_reference) <> ''),
	source_food_name text check (source_food_name is null or btrim(source_food_name) <> ''),
	source_data_type text check (source_data_type is null or btrim(source_data_type) <> ''),
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete cascade,
	nutrient_name text not null check (btrim(nutrient_name) <> ''),
	nutrient_number text check (nutrient_number is null or btrim(nutrient_number) <> ''),
	unit_name text not null check (btrim(unit_name) <> ''),
	entry_step text not null check (entry_step in ('macros', 'extended')),
	group_id text not null check (btrim(group_id) <> ''),
	group_title text not null check (btrim(group_title) <> ''),
	group_sort_order integer not null check (group_sort_order > 0),
	nutrient_type text not null check (
		nutrient_type in ('energy', 'macro', 'fat', 'carbohydrate', 'mineral', 'vitamin', 'amino_acid', 'other')
	),
	dedupe_key text not null check (btrim(dedupe_key) <> ''),
	display_label text not null check (btrim(display_label) <> ''),
	field_sort_order integer not null check (field_sort_order > 0),
	classification_method text not null check (btrim(classification_method) <> ''),
	source_payload jsonb not null default '{}'::jsonb,
	observed_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (source, query, source_reference, nutrient_id)
);

create trigger set_nutrient_manual_entry_observations_updated_at
	before update on public.nutrient_manual_entry_observations
	for each row execute function public.set_updated_at();

create index nutrient_manual_entry_observations_nutrient_idx
	on public.nutrient_manual_entry_observations (nutrient_id, observed_at desc);

create index nutrient_manual_entry_observations_group_idx
	on public.nutrient_manual_entry_observations (entry_step, group_sort_order, group_id, field_sort_order);

create index nutrient_manual_entry_observations_dedupe_idx
	on public.nutrient_manual_entry_observations (dedupe_key, field_sort_order, observed_at desc);

create or replace function public.sync_nutrient_manual_entry_fields()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.nutrient_manual_entry_groups (
		id,
		entry_step,
		title,
		sort_order,
		enabled,
		source_count,
		observation_count,
		verification_status,
		sources,
		last_observed_at
	)
	select
		observation_groups.group_id,
		observation_groups.entry_step,
		observation_groups.group_title,
		observation_groups.group_sort_order,
		true,
		observation_groups.source_count,
		observation_groups.observation_count,
		case
			when observation_groups.source_count > 1 then 'multi_source_verified'
			else 'single_source'
		end,
		observation_groups.sources,
		observation_groups.last_observed_at
	from (
		select
			group_id,
			entry_step,
			min(group_title) as group_title,
			min(group_sort_order) as group_sort_order,
			count(distinct source)::integer as source_count,
			count(*)::integer as observation_count,
			array_agg(distinct source order by source) as sources,
			max(observed_at) as last_observed_at
		from public.nutrient_manual_entry_observations
		group by group_id, entry_step
	) as observation_groups
	on conflict (id) do update set
		entry_step = excluded.entry_step,
		title = excluded.title,
		sort_order = excluded.sort_order,
		enabled = true,
		source_count = excluded.source_count,
		observation_count = excluded.observation_count,
		verification_status = excluded.verification_status,
		sources = excluded.sources,
		last_observed_at = excluded.last_observed_at;

	insert into public.nutrient_manual_entry_fields (
		dedupe_key,
		nutrient_id,
		group_id,
		nutrient_type,
		display_label,
		sort_order,
		enabled,
		source_count,
		observation_count,
		verification_status,
		sources,
		last_observed_at
	)
	select
		selected_fields.dedupe_key,
		selected_fields.nutrient_id,
		selected_fields.group_id,
		selected_fields.nutrient_type,
		selected_fields.display_label,
		selected_fields.field_sort_order,
		true,
		observation_counts.source_count,
		observation_counts.observation_count,
		case
			when observation_counts.source_count > 1 then 'multi_source_verified'
			else 'single_source'
		end,
		observation_counts.sources,
		observation_counts.last_observed_at
	from (
		select distinct on (dedupe_key)
			dedupe_key,
			nutrient_id,
			group_id,
			nutrient_type,
			display_label,
			field_sort_order
		from public.nutrient_manual_entry_observations
		order by
			dedupe_key,
			case
				when nutrient_number in ('203', '204', '205', '208', '269', '291') then 0
				else 1
			end,
			field_sort_order,
			observed_at desc
	) as selected_fields
	join (
		select
			dedupe_key,
			count(distinct source)::integer as source_count,
			count(*)::integer as observation_count,
			array_agg(distinct source order by source) as sources,
			max(observed_at) as last_observed_at
		from public.nutrient_manual_entry_observations
		group by dedupe_key
	) as observation_counts on observation_counts.dedupe_key = selected_fields.dedupe_key
	on conflict (dedupe_key) do update set
		nutrient_id = excluded.nutrient_id,
		group_id = excluded.group_id,
		nutrient_type = excluded.nutrient_type,
		display_label = excluded.display_label,
		sort_order = excluded.sort_order,
		enabled = true,
		source_count = excluded.source_count,
		observation_count = excluded.observation_count,
		verification_status = excluded.verification_status,
		sources = excluded.sources,
		last_observed_at = excluded.last_observed_at;

	update public.nutrient_manual_entry_fields
	set enabled = false
	where not exists (
		select 1
		from public.nutrient_manual_entry_observations observations
		where observations.dedupe_key = nutrient_manual_entry_fields.dedupe_key
	);
end;
$$;

create or replace function public.sync_nutrient_manual_entry_fields_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	perform public.sync_nutrient_manual_entry_fields();
	return null;
end;
$$;

create trigger sync_nutrient_manual_entry_observations_after_change
	after insert or update or delete on public.nutrient_manual_entry_observations
	for each statement execute function public.sync_nutrient_manual_entry_fields_trigger();

alter table public.nutrient_manual_entry_groups enable row level security;
alter table public.nutrient_manual_entry_groups force row level security;
alter table public.nutrient_manual_entry_fields enable row level security;
alter table public.nutrient_manual_entry_fields force row level security;
alter table public.nutrient_manual_entry_observations enable row level security;
alter table public.nutrient_manual_entry_observations force row level security;

create policy "Authenticated users can read manual entry nutrient groups"
	on public.nutrient_manual_entry_groups
	for select
	to authenticated
	using (true);

create policy "Authenticated users can read manual entry nutrient fields"
	on public.nutrient_manual_entry_fields
	for select
	to authenticated
	using (true);

revoke all on table public.nutrient_manual_entry_groups from public, anon, authenticated;
grant select on table public.nutrient_manual_entry_groups to authenticated;

revoke all on table public.nutrient_manual_entry_fields from public, anon, authenticated;
grant select on table public.nutrient_manual_entry_fields to authenticated;

revoke all on table public.nutrient_manual_entry_observations from public, anon, authenticated;

grant all on table public.nutrient_manual_entry_groups to service_role;
grant all on table public.nutrient_manual_entry_fields to service_role;
grant all on table public.nutrient_manual_entry_observations to service_role;

grant execute on function public.sync_nutrient_manual_entry_fields() to service_role;
grant execute on function public.sync_nutrient_manual_entry_fields_trigger() to service_role;
