create table public.nutrient_source_mapping_observations (
	source_key text not null references public.product_data_sources(key) on delete cascade,
	source_nutrient_key text not null check (
		btrim(source_nutrient_key) <> ''
		and char_length(source_nutrient_key) <= 160
	),
	source_unit_name text not null check (
		btrim(source_unit_name) <> ''
		and char_length(source_unit_name) <= 32
	),
	source_nutrient_name text not null check (
		btrim(source_nutrient_name) <> ''
		and char_length(source_nutrient_name) <= 160
	),
	observation_count bigint not null default 1 check (observation_count > 0),
	first_observed_at timestamptz not null default now(),
	last_observed_at timestamptz not null default now(),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (source_key, source_nutrient_key, source_unit_name)
);

create index nutrient_source_mapping_observations_recent_idx
	on public.nutrient_source_mapping_observations (
		source_key,
		last_observed_at desc
	);

create trigger set_nutrient_source_mapping_observations_updated_at
	before update on public.nutrient_source_mapping_observations
	for each row execute function public.set_updated_at();

alter table public.nutrient_source_mapping_observations enable row level security;
alter table public.nutrient_source_mapping_observations force row level security;

revoke all on table public.nutrient_source_mapping_observations
	from public, anon, authenticated;
grant all on table public.nutrient_source_mapping_observations to service_role;

create or replace function public.observe_open_food_facts_cached_nutrients()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_observed_at timestamptz := coalesce(new.fetched_at, now());
	v_nutriments jsonb := new.response #> '{product,nutriments}';
	v_observation record;
begin
	if new.provider <> 'open-food-facts'
		or new.request_kind <> 'barcode-product'
		or new.status_code <> 200
		or jsonb_typeof(v_nutriments) <> 'object'
	then
		return new;
	end if;

	for v_observation in
		with reported_values as (
			select
				regexp_replace(entry.key, '_(100g|serving)$', '') as source_nutrient_key,
				entry.value as reported_value
			from jsonb_each(v_nutriments) entry
			where entry.key ~ '_(100g|serving)$'
				and jsonb_typeof(entry.value) in ('number', 'string')
		), normalized as (
			select distinct on (reported.source_nutrient_key, source_unit_name)
				reported.source_nutrient_key,
				upper(
					replace(
						replace(btrim(v_nutriments ->> (reported.source_nutrient_key || '_unit')), 'µ', 'U'),
						'Μ',
						'U'
					)
				) as source_unit_name,
				initcap(replace(reported.source_nutrient_key, '-', ' ')) as source_nutrient_name
			from reported_values reported
			where btrim(reported.reported_value #>> '{}') ~ '^[+]?[0-9]+([.][0-9]+)?$'
		)
		select normalized.*
		from normalized
		where btrim(normalized.source_nutrient_key) <> ''
			and char_length(normalized.source_nutrient_key) <= 160
			and btrim(normalized.source_unit_name) <> ''
			and char_length(normalized.source_unit_name) <= 32
			and normalized.source_nutrient_key !~* '^(alcohol|carbon-footprint|ecoscore|environmental-score|fruits-vegetables-|nova-group|nutrition-score)'
	loop
		insert into public.nutrient_source_mapping_observations (
			source_key,
			source_nutrient_key,
			source_unit_name,
			source_nutrient_name,
			observation_count,
			first_observed_at,
			last_observed_at
		)
		values (
			'open-food-facts',
			v_observation.source_nutrient_key,
			v_observation.source_unit_name,
			left(v_observation.source_nutrient_name, 160),
			1,
			v_observed_at,
			v_observed_at
		)
		on conflict (source_key, source_nutrient_key, source_unit_name) do update
		set observation_count = public.nutrient_source_mapping_observations.observation_count + 1,
			first_observed_at = least(
				public.nutrient_source_mapping_observations.first_observed_at,
				excluded.first_observed_at
			),
			last_observed_at = greatest(
				public.nutrient_source_mapping_observations.last_observed_at,
				excluded.last_observed_at
			);
	end loop;

	return new;
end;
$$;

revoke all on function public.observe_open_food_facts_cached_nutrients()
	from public, anon, authenticated;

create trigger observe_open_food_facts_cached_nutrients
	after insert or update of response, status_code, fetched_at
	on public.product_api_cache
	for each row execute function public.observe_open_food_facts_cached_nutrients();

comment on table public.nutrient_source_mapping_observations is
	'Anonymous exact nutrient key/unit counts derived from trusted provider cache refreshes; contains no user, barcode, product, amount, or raw payload data.';
comment on function public.observe_open_food_facts_cached_nutrients() is
	'Records bounded Open Food Facts nutrient identities from successful existing cache writes without adding provider requests or client-controlled evidence.';
