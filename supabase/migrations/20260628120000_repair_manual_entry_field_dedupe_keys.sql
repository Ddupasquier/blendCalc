alter table public.nutrient_manual_entry_fields
	add column if not exists dedupe_key text;

alter table public.nutrient_manual_entry_observations
	add column if not exists dedupe_key text;

update public.nutrient_manual_entry_observations observations
set dedupe_key = concat_ws(
	':',
	observations.entry_step,
	observations.group_id,
	btrim(
		regexp_replace(
			regexp_replace(
				lower(observations.display_label),
				'\([^)]*\)',
				' ',
				'g'
			),
			'[^a-z0-9]+',
			' ',
			'g'
		)
	),
	lower(observations.unit_name)
)
where observations.dedupe_key is null;

alter table public.nutrient_manual_entry_observations
	alter column dedupe_key set not null;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'nutrient_manual_entry_observations_dedupe_key_not_blank'
			and conrelid = 'public.nutrient_manual_entry_observations'::regclass
	) then
		alter table public.nutrient_manual_entry_observations
			add constraint nutrient_manual_entry_observations_dedupe_key_not_blank
			check (btrim(dedupe_key) <> '');
	end if;
end;
$$;

with selected_observations as (
	select distinct on (nutrient_id, group_id)
		nutrient_id,
		group_id,
		dedupe_key
	from public.nutrient_manual_entry_observations
	order by
		nutrient_id,
		group_id,
		case
			when nutrient_number in ('203', '204', '205', '208', '269', '291') then 0
			else 1
		end,
		field_sort_order,
		observed_at desc
)
update public.nutrient_manual_entry_fields fields
set dedupe_key = selected_observations.dedupe_key
from selected_observations
where fields.nutrient_id = selected_observations.nutrient_id
	and fields.group_id = selected_observations.group_id
	and fields.dedupe_key is null;

update public.nutrient_manual_entry_fields fields
set dedupe_key = concat_ws(
	':',
	groups.entry_step,
	fields.group_id,
	btrim(
		regexp_replace(
			regexp_replace(
				lower(coalesce(fields.display_label, definitions.nutrient_name)),
				'\([^)]*\)',
				' ',
				'g'
			),
			'[^a-z0-9]+',
			' ',
			'g'
		)
	),
	lower(definitions.default_unit_name)
)
from public.nutrient_definitions definitions
cross join public.nutrient_manual_entry_groups groups
where definitions.nutrient_id = fields.nutrient_id
	and groups.id = fields.group_id
	and fields.dedupe_key is null;

with ranked_fields as (
	select
		fields.ctid as row_id,
		row_number() over (
			partition by fields.dedupe_key
			order by
				case
					when definitions.nutrient_number in ('203', '204', '205', '208', '269', '291') then 0
					else 1
				end,
				fields.sort_order,
				fields.nutrient_id
		) as row_rank
	from public.nutrient_manual_entry_fields fields
	join public.nutrient_definitions definitions
		on definitions.nutrient_id = fields.nutrient_id
	where fields.dedupe_key is not null
)
delete from public.nutrient_manual_entry_fields fields
using ranked_fields
where fields.ctid = ranked_fields.row_id
	and ranked_fields.row_rank > 1;

alter table public.nutrient_manual_entry_fields
	alter column dedupe_key set not null;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'nutrient_manual_entry_fields_dedupe_key_not_blank'
			and conrelid = 'public.nutrient_manual_entry_fields'::regclass
	) then
		alter table public.nutrient_manual_entry_fields
			add constraint nutrient_manual_entry_fields_dedupe_key_not_blank
			check (btrim(dedupe_key) <> '');
	end if;
end;
$$;

create unique index if not exists nutrient_manual_entry_fields_dedupe_key_idx
	on public.nutrient_manual_entry_fields (dedupe_key);

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

select public.sync_nutrient_manual_entry_fields();
