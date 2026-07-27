insert into public.serving_measure_aliases (
	unit_key,
	alias,
	normalized_alias,
	source_key,
	observation_count,
	first_observed_at,
	last_observed_at
)
select
	'g',
	'GRM',
	'grm',
	'usda',
	1,
	now(),
	now()
where exists (
	select 1
	from public.serving_measure_units unit
	where unit.key = 'g'
)
on conflict (unit_key, normalized_alias) do update
set alias = excluded.alias,
	source_key = excluded.source_key,
	observation_count = greatest(
		public.serving_measure_aliases.observation_count,
		excluded.observation_count
	),
	last_observed_at = excluded.last_observed_at;
