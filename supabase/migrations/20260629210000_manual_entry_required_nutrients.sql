alter table public.nutrient_manual_entry_fields
	add column if not exists required_for_manual_entry boolean not null default false;

create table if not exists public.nutrient_manual_entry_required_nutrients (
	nutrient_id bigint primary key references public.nutrient_definitions(nutrient_id) on delete cascade,
	requirement_key text not null unique check (btrim(requirement_key) <> ''),
	group_id text not null references public.nutrient_manual_entry_groups(id) on delete restrict,
	field_sort_order integer not null check (field_sort_order > 0),
	reason text not null check (btrim(reason) <> ''),
	source text not null check (btrim(source) <> ''),
	source_count integer not null default 1 check (source_count >= 0),
	observation_count integer not null default 1 check (observation_count >= 0),
	sources text[] not null default '{}'::text[],
	provenance jsonb not null default '{}'::jsonb,
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

drop trigger if exists set_nutrient_manual_entry_required_nutrients_updated_at
	on public.nutrient_manual_entry_required_nutrients;

create trigger set_nutrient_manual_entry_required_nutrients_updated_at
	before update on public.nutrient_manual_entry_required_nutrients
	for each row execute function public.set_updated_at();

create index if not exists nutrient_manual_entry_required_nutrients_group_idx
	on public.nutrient_manual_entry_required_nutrients (group_id);

create index if not exists nutrient_manual_entry_required_nutrients_enabled_idx
	on public.nutrient_manual_entry_required_nutrients (field_sort_order, nutrient_id)
	where enabled;

do $$
declare
	required_group_sort_order integer := 10;
begin
	if exists (
		select 1
		from public.nutrient_manual_entry_groups
		where id = 'required-basics'
	) then
		if exists (
			select 1
			from public.nutrient_manual_entry_groups
			where id <> 'required-basics'
				and entry_step = 'macros'
				and sort_order = required_group_sort_order
		) then
			select sort_order
			into required_group_sort_order
			from public.nutrient_manual_entry_groups
			where id = 'required-basics';
		end if;

		update public.nutrient_manual_entry_groups
		set
			entry_step = 'macros',
			title = 'Required basics',
			sort_order = required_group_sort_order,
			enabled = true
		where id = 'required-basics';
	else
		if exists (
			select 1
			from public.nutrient_manual_entry_groups
			where entry_step = 'macros'
				and sort_order = required_group_sort_order
		) then
			select coalesce(max(sort_order), 0) + 10
			into required_group_sort_order
			from public.nutrient_manual_entry_groups
			where entry_step = 'macros';
		end if;

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
		values (
			'required-basics',
			'macros',
			'Required basics',
			required_group_sort_order,
			true,
			1,
			1,
			'single_source',
			array['nutrient_definitions'],
			now()
		);
	end if;
end $$;

with desired_required_nutrients as (
	select *
	from (values
		('calories', '208', 10, 'Calories are needed to make a useful nutrition label.'),
		('total-fat', '204', 20, 'Total fat is a required macro for manual nutrition entry.'),
		('total-carbohydrates', '205', 30, 'Total carbohydrates are a required macro for manual nutrition entry.'),
		('protein', '203', 40, 'Protein is a required macro for manual nutrition entry.'),
		('sodium', '307', 50, 'Sodium is important for health warnings and manual nutrition completeness.')
	) as required_nutrients(requirement_key, nutrient_number, field_sort_order, reason)
), matched_required_nutrients as (
	select distinct on (definition.nutrient_id)
		definition.nutrient_id,
		desired_required_nutrients.requirement_key,
		desired_required_nutrients.nutrient_number,
		desired_required_nutrients.field_sort_order,
		desired_required_nutrients.reason
	from desired_required_nutrients
	join public.nutrient_definitions definition
		on definition.nutrient_number = desired_required_nutrients.nutrient_number
	order by definition.nutrient_id, desired_required_nutrients.field_sort_order
)
insert into public.nutrient_manual_entry_required_nutrients (
	nutrient_id,
	requirement_key,
	group_id,
	field_sort_order,
	reason,
	source,
	source_count,
	observation_count,
	sources,
	provenance,
	enabled
)
select
	matched_required_nutrients.nutrient_id,
	matched_required_nutrients.requirement_key,
	'required-basics',
	matched_required_nutrients.field_sort_order,
	matched_required_nutrients.reason,
	'nutrient_definitions',
	1,
	1,
	array['nutrient_definitions'],
	jsonb_build_object(
		'classificationMethod',
		'required manual-entry nutrient resolved from canonical nutrient_definitions nutrient number',
		'nutrientNumber',
		matched_required_nutrients.nutrient_number
	),
	true
from matched_required_nutrients
on conflict (nutrient_id) do update set
	requirement_key = excluded.requirement_key,
	group_id = excluded.group_id,
	field_sort_order = excluded.field_sort_order,
	reason = excluded.reason,
	source = excluded.source,
	source_count = excluded.source_count,
	observation_count = excluded.observation_count,
	sources = excluded.sources,
	provenance = excluded.provenance,
	enabled = excluded.enabled;

create or replace function public.set_nutrient_manual_entry_field_required_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	required_rule record;
begin
	select
		required_nutrients.group_id,
		required_nutrients.field_sort_order
	into required_rule
	from public.nutrient_manual_entry_required_nutrients required_nutrients
	where required_nutrients.nutrient_id = new.nutrient_id
		and required_nutrients.enabled
	limit 1;

	if found then
		new.group_id = required_rule.group_id;
		new.sort_order = required_rule.field_sort_order;
		new.required_for_manual_entry = true;
	else
		new.required_for_manual_entry = false;
	end if;

	return new;
end;
$$;

drop trigger if exists set_nutrient_manual_entry_field_required_flag
	on public.nutrient_manual_entry_fields;

create trigger set_nutrient_manual_entry_field_required_flag
	before insert or update on public.nutrient_manual_entry_fields
	for each row execute function public.set_nutrient_manual_entry_field_required_flag();

create or replace function public.refresh_nutrient_manual_entry_required_flags()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	update public.nutrient_manual_entry_fields fields
	set required_for_manual_entry = false
	where not exists (
		select 1
		from public.nutrient_manual_entry_required_nutrients required_nutrients
		where required_nutrients.nutrient_id = fields.nutrient_id
			and required_nutrients.enabled
	);

	update public.nutrient_manual_entry_fields fields
	set
		group_id = required_nutrients.group_id,
		sort_order = required_nutrients.field_sort_order,
		required_for_manual_entry = true
	from public.nutrient_manual_entry_required_nutrients required_nutrients
	where required_nutrients.nutrient_id = fields.nutrient_id
		and required_nutrients.enabled;
end;
$$;

create or replace function public.refresh_nutrient_manual_entry_required_flags_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	perform public.refresh_nutrient_manual_entry_required_flags();
	return null;
end;
$$;

drop trigger if exists refresh_nutrient_manual_entry_required_flags_after_change
	on public.nutrient_manual_entry_required_nutrients;

create trigger refresh_nutrient_manual_entry_required_flags_after_change
	after insert or update or delete on public.nutrient_manual_entry_required_nutrients
	for each statement execute function public.refresh_nutrient_manual_entry_required_flags_trigger();

select public.refresh_nutrient_manual_entry_required_flags();

alter table public.nutrient_manual_entry_required_nutrients enable row level security;
alter table public.nutrient_manual_entry_required_nutrients force row level security;

drop policy if exists "Authenticated users can read manual entry required nutrients"
	on public.nutrient_manual_entry_required_nutrients;

create policy "Authenticated users can read manual entry required nutrients"
	on public.nutrient_manual_entry_required_nutrients
	for select
	to authenticated
	using (true);

revoke all on table public.nutrient_manual_entry_required_nutrients from public, anon, authenticated;
grant select on table public.nutrient_manual_entry_required_nutrients to authenticated;
grant all on table public.nutrient_manual_entry_required_nutrients to service_role;

revoke execute on function public.set_nutrient_manual_entry_field_required_flag()
	from public, anon, authenticated;
revoke execute on function public.refresh_nutrient_manual_entry_required_flags()
	from public, anon, authenticated;
revoke execute on function public.refresh_nutrient_manual_entry_required_flags_trigger()
	from public, anon, authenticated;
grant execute on function public.set_nutrient_manual_entry_field_required_flag()
	to service_role;
grant execute on function public.refresh_nutrient_manual_entry_required_flags()
	to service_role;
grant execute on function public.refresh_nutrient_manual_entry_required_flags_trigger()
	to service_role;
