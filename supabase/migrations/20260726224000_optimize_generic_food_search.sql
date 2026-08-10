create index generic_food_nutrients_searchable_food_idx
	on public.generic_food_nutrients (dataset_key, source_food_key)
	where mapping_status = 'canonical'
		and nutrient_id is not null
		and value_status = 'measured'
		and amount_per_100g is not null;

drop function if exists public.search_generic_food_records(text, integer);

create function public.search_generic_food_records(
	p_query text,
	p_limit integer default 100
)
returns table (
	application_food_id bigint,
	dataset_key text,
	source_food_key text,
	description text,
	alternate_description text,
	food_group_name text,
	scientific_name text,
	preparation text,
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
	source_identifiers jsonb,
	nutrients jsonb,
	measures jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
	with normalized_query as (
		select lower(
			btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))
		) as value
	),
	query_terms as (
		select term, ordinal
		from normalized_query query
		cross join lateral regexp_split_to_table(
			query.value,
			'[^[:alnum:]]+'
		) with ordinality as terms(term, ordinal)
		where term <> ''
	),
	indexed_query as (
		select
			query.value as text_value,
			to_tsquery(
				'simple',
				string_agg(terms.term || ':*', ' & ' order by terms.ordinal)
			) as search_value
		from normalized_query query
		join query_terms terms on true
		group by query.value
	),
	ranked as (
		select
			record.application_food_id,
			record.dataset_key,
			record.source_food_key,
			record.description,
			record.alternate_description,
			record.food_group_name,
			record.scientific_name,
			record.preparation,
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
				when lower(record.description) = query.text_value then 0
				when strpos(lower(record.description), query.text_value) = 1 then 1
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
			public.similarity(
				lower(record.description),
				query.text_value
			) as similarity_score
		from public.generic_food_records record
		join public.generic_food_datasets dataset
			on dataset.key = record.dataset_key
		join public.product_data_sources source
			on source.key = dataset.source_key
		cross join indexed_query query
		where dataset.active
			and dataset.import_enabled
			and source.enabled
			and record.measurement_basis = 'per_100g'
			and record.search_vector @@ query.search_value
			and exists (
				select 1
				from public.generic_food_nutrients nutrient
				where nutrient.dataset_key = record.dataset_key
					and nutrient.source_food_key = record.source_food_key
					and nutrient.mapping_status = 'canonical'
					and nutrient.nutrient_id is not null
					and nutrient.value_status = 'measured'
					and nutrient.amount_per_100g is not null
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
		ranked.alternate_description,
		ranked.food_group_name,
		ranked.scientific_name,
		ranked.preparation,
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
		coalesce(identifiers.rows, '[]'::jsonb) as source_identifiers,
		coalesce(nutrients.rows, '[]'::jsonb) as nutrients,
		coalesce(measures.rows, '[]'::jsonb) as measures
	from ranked
	left join lateral (
		select jsonb_agg(
			jsonb_build_object(
				'sourceKey', identifier.source_key,
				'identifierType', identifier.identifier_type,
				'identifierValue', identifier.identifier_value,
				'sourceField', identifier.source_field,
				'verificationMethod', identifier.verification_method
			)
			order by
				identifier.source_key,
				identifier.identifier_type,
				identifier.identifier_value
		) as rows
		from public.generic_food_source_identifiers identifier
		where identifier.dataset_key = ranked.dataset_key
			and identifier.source_food_key = ranked.source_food_key
	) identifiers on true
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

revoke all on function public.search_generic_food_records(text, integer)
	from public, anon;
grant execute on function public.search_generic_food_records(text, integer)
	to authenticated, service_role;
