alter table public.generic_food_nutrients
	alter column amount_per_100g drop not null,
	add column value_status text not null default 'measured';

alter table public.generic_food_nutrients
	add constraint generic_food_nutrients_value_status_check
	check (
		value_status in ('measured', 'trace', 'present-unquantified')
		and (
			(value_status = 'measured' and amount_per_100g is not null and amount_per_100g >= 0)
			or (value_status <> 'measured' and amount_per_100g is null)
		)
	);

alter table public.generic_food_records
	add column measurement_basis text not null default 'per_100g'
		check (measurement_basis in ('per_100g', 'per_100ml'));

update public.generic_food_datasets
set metadata = metadata || jsonb_build_object(
	'per100mlFoodGroupPrefixes', jsonb_build_array('Q'),
	'measurementBasisNote', 'CoFID reports alcoholic beverages per 100 ml. These records are preserved but excluded from weight-based search until a verified density conversion is available.'
)
where key = 'cofid-2021';

create index generic_food_records_measurement_basis_idx
	on public.generic_food_records (dataset_key, measurement_basis, source_food_key);

create index generic_food_nutrients_value_status_idx
	on public.generic_food_nutrients (
		dataset_key,
		source_food_key,
		value_status,
		nutrient_id
	);

create or replace function public.search_generic_food_records(
	p_query text,
	p_limit integer default 100
)
returns table (
	application_food_id bigint,
	dataset_key text,
	source_food_key text,
	description text,
	food_group_name text,
	external_reference text,
	source_updated_at date,
	source_key text,
	source_display_name text,
	dataset_display_name text,
	dataset_version text,
	source_url text,
	license_name text,
	license_url text,
	attribution_text text,
	metadata jsonb,
	nutrients jsonb,
	measures jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
	with normalized_query as (
		select lower(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as value
	),
	query_terms as (
		select term
		from normalized_query query
		cross join lateral regexp_split_to_table(query.value, '\s+') as term
		where term <> ''
	),
	ranked as (
		select
			record.application_food_id,
			record.dataset_key,
			record.source_food_key,
			record.description,
			record.food_group_name,
			record.external_reference,
			record.source_updated_at,
			dataset.source_key,
			source.display_name as source_display_name,
			dataset.display_name as dataset_display_name,
			dataset.version as dataset_version,
			dataset.source_url,
			dataset.license_name,
			dataset.license_url,
			dataset.attribution_text,
			record.metadata,
			case
				when lower(record.description) = query.value then 0
				when strpos(lower(record.description), query.value) = 1 then 1
				when not exists (
					select 1
					from query_terms
					where strpos(
						array_to_string(
							(regexp_split_to_array(lower(record.description), '\s+'))[1:3],
							' '
						),
						query_terms.term
					) = 0
				) then 2
				else 3
			end as relevance_tier,
			public.similarity(lower(record.description), query.value) as similarity_score
		from public.generic_food_records record
		join public.generic_food_datasets dataset
			on dataset.key = record.dataset_key
		join public.product_data_sources source
			on source.key = dataset.source_key
		cross join normalized_query query
		where query.value <> ''
			and dataset.active
			and dataset.import_enabled
			and source.enabled
			and record.measurement_basis = 'per_100g'
			and not exists (
				select 1
				from query_terms
				where strpos(record.search_text, query_terms.term) = 0
			)
		order by
			relevance_tier,
			similarity_score desc,
			length(record.description),
			record.description,
			record.application_food_id
		limit least(greatest(coalesce(p_limit, 100), 1), 100)
	)
	select
		ranked.application_food_id,
		ranked.dataset_key,
		ranked.source_food_key,
		ranked.description,
		ranked.food_group_name,
		ranked.external_reference,
		ranked.source_updated_at,
		ranked.source_key,
		ranked.source_display_name,
		ranked.dataset_display_name,
		ranked.dataset_version,
		ranked.source_url,
		ranked.license_name,
		ranked.license_url,
		ranked.attribution_text,
		ranked.metadata,
		coalesce(nutrients.rows, '[]'::jsonb) as nutrients,
		coalesce(measures.rows, '[]'::jsonb) as measures
	from ranked
	left join lateral (
		select jsonb_agg(
			jsonb_build_object(
				'nutrientId', nutrient.nutrient_id,
				'nutrientNumber', nutrient.source_nutrient_key,
				'nutrientName', nutrient.source_nutrient_name,
				'unitName', nutrient.unit_name,
				'value', nutrient.amount_per_100g,
				'standardError', nutrient.standard_error,
				'observationCount', nutrient.observation_count,
				'sourceUpdatedAt', nutrient.source_updated_at,
				'metadata', nutrient.metadata
			)
			order by nutrient.nutrient_id, nutrient.source_nutrient_key
		) as rows
		from public.generic_food_nutrients nutrient
		where nutrient.dataset_key = ranked.dataset_key
			and nutrient.source_food_key = ranked.source_food_key
			and nutrient.mapping_status = 'canonical'
			and nutrient.nutrient_id is not null
			and nutrient.value_status = 'measured'
			and nutrient.amount_per_100g is not null
	) nutrients on true
	left join lateral (
		select jsonb_agg(
			jsonb_build_object(
				'sourceMeasureKey', measure.source_measure_key,
				'measureType', measure.measure_type,
				'description', measure.description,
				'gramWeight', measure.gram_weight,
				'sourceUpdatedAt', measure.source_updated_at,
				'metadata', measure.metadata
			)
			order by measure.gram_weight, measure.description
		) as rows
		from public.generic_food_measures measure
		where measure.dataset_key = ranked.dataset_key
			and measure.source_food_key = ranked.source_food_key
			and measure.is_household_measure
			and measure.gram_weight > 0
	) measures on true;
$$;
