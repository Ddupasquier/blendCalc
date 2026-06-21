create table public.food_preference_api_observations (
	id uuid primary key default gen_random_uuid(),
	source text not null
		check (source in ('open-food-facts', 'fdc-search', 'usda-branded-detail')),
	query text not null check (btrim(query) <> ''),
	matched_name text,
	brand_owner text,
	source_reference text,
	category text not null
		check (category in ('allergen', 'dietary', 'ingredient')),
	fact_type text not null
		check (fact_type in ('contains', 'may_contain', 'dietary_claim', 'ingredient_present')),
	source_field text not null check (btrim(source_field) <> ''),
	source_value text not null check (btrim(source_value) <> ''),
	label text not null check (btrim(label) <> ''),
	normalized_value text not null check (btrim(normalized_value) <> ''),
	source_payload jsonb not null default '{}'::jsonb
		check (jsonb_typeof(source_payload) = 'object'),
	observation_count integer not null default 1 check (observation_count >= 1),
	first_seen_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now(),
	unique (
		source,
		query,
		category,
		fact_type,
		normalized_value,
		source_field,
		source_value
	)
);

create index food_preference_api_observations_category_value_idx
	on public.food_preference_api_observations (category, normalized_value);

create index food_preference_api_observations_source_query_idx
	on public.food_preference_api_observations (source, query);

alter table public.food_preference_option_catalog
	drop constraint if exists food_preference_option_catalog_source_type_check;

alter table public.food_preference_option_catalog
	add constraint food_preference_option_catalog_source_type_check
	check (source_type in ('compatibility_fact', 'ingredient_list', 'api_observation'));

create or replace function public.rebuild_food_preference_option_catalog()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	delete from public.food_preference_option_catalog
	where true;

	insert into public.food_preference_option_catalog (
		category,
		label,
		normalized_value,
		source_type,
		tag_id,
		source_values,
		usage_count
	)
	with raw_options as (
		select
			'allergen'::text as category,
			tag.label,
			public.compatibility_normalize_text(tag.label) as normalized_value,
			'compatibility_fact'::text as source_type,
			tag.id as tag_id,
			coalesce(fact.source_text, tag.label) as source_value,
			2 as usage_weight,
			1 as source_rank
		from public.product_compatibility_facts fact
		join public.shared_products product
			on product.id = fact.shared_product_id
			and product.status = 'active'
		join public.compatibility_tags tag
			on tag.id = fact.tag_id
		where tag.category = 'allergen'
			and fact.fact_type in ('contains', 'may_contain')

		union all

		select
			'dietary',
			tag.label,
			public.compatibility_normalize_text(tag.label),
			'compatibility_fact',
			tag.id,
			coalesce(fact.source_text, tag.label),
			2,
			1
		from public.product_compatibility_facts fact
		join public.shared_products product
			on product.id = fact.shared_product_id
			and product.status = 'active'
		join public.compatibility_tags tag
			on tag.id = fact.tag_id
		where tag.category = 'dietary'
			and fact.fact_type = 'dietary_claim'

		union all

		select
			observation.category,
			observation.label,
			observation.normalized_value,
			'api_observation',
			tag.id,
			observation.source_value,
			observation.observation_count,
			2
		from public.food_preference_api_observations observation
		left join public.compatibility_tags tag
			on tag.category = observation.category
			and (
				public.compatibility_normalize_text(tag.slug) = observation.normalized_value
				or public.compatibility_normalize_text(tag.label) = observation.normalized_value
			)
		where observation.category in ('allergen', 'dietary')

		union all

		select
			'ingredient',
			raw_values.value,
			normalized.normalized_value,
			'ingredient_list',
			null::uuid,
			raw_values.value,
			1,
			3
		from public.shared_products product
		cross join lateral jsonb_array_elements_text(
			case
				when jsonb_typeof(product.food -> 'ingredientList') = 'array' then product.food -> 'ingredientList'
				else '[]'::jsonb
			end
		) as raw_values(value)
		cross join lateral (
			select public.compatibility_normalize_text(raw_values.value) as normalized_value
		) normalized
		where product.status = 'active'
			and normalized.normalized_value <> ''
			and char_length(normalized.normalized_value) <= 60

		union all

		select
			'ingredient',
			observation.label,
			observation.normalized_value,
			'api_observation',
			null::uuid,
			observation.source_value,
			observation.observation_count,
			4
		from public.food_preference_api_observations observation
		where observation.category = 'ingredient'
			and char_length(observation.normalized_value) <= 60
	),
	grouped_options as (
		select
			category,
			normalized_value,
			(array_agg(label order by source_rank, usage_weight desc, label))[1] as label,
			(array_agg(source_type order by source_rank, usage_weight desc, label))[1] as source_type,
			(array_remove(array_agg(tag_id order by source_rank, usage_weight desc, label), null))[1] as tag_id,
			array_agg(distinct source_value order by source_value) as source_values,
			sum(usage_weight)::integer as usage_count
		from raw_options
		where normalized_value <> ''
		group by category, normalized_value
	)
	select
		category,
		label,
		normalized_value,
		source_type,
		tag_id,
		source_values,
		usage_count
	from grouped_options;
end;
$$;

drop trigger if exists sync_food_preference_option_catalog_from_api_observations
	on public.food_preference_api_observations;
create trigger sync_food_preference_option_catalog_from_api_observations
	after insert or update or delete on public.food_preference_api_observations
	for each statement execute function public.sync_food_preference_option_catalog();

alter table public.food_preference_api_observations enable row level security;
alter table public.food_preference_api_observations force row level security;

create policy "Authenticated users can read food preference API observations"
	on public.food_preference_api_observations
	for select
	to authenticated
	using (true);

revoke all on table public.food_preference_api_observations
	from public, anon, authenticated;
grant select on table public.food_preference_api_observations to authenticated;

select public.rebuild_food_preference_option_catalog();
