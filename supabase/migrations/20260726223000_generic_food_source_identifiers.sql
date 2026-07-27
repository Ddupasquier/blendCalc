create table public.generic_food_source_identifiers (
	dataset_key text not null,
	source_food_key text not null,
	source_key text not null
		references public.product_data_sources(key) on delete restrict,
	identifier_type text not null
		check (identifier_type ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	identifier_value text not null
		check (btrim(identifier_value) <> ''),
	source_field text not null
		check (btrim(source_field) <> ''),
	verification_method text not null default 'source-reference'
		check (verification_method in (
			'source-reference',
			'exact-identifier',
			'moderator-review'
		)),
	metadata jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (
		dataset_key,
		source_food_key,
		source_key,
		identifier_type,
		identifier_value
	),
	foreign key (dataset_key, source_food_key)
		references public.generic_food_records(dataset_key, source_food_key)
		on delete cascade
);

create index generic_food_source_identifiers_lookup_idx
	on public.generic_food_source_identifiers (
		source_key,
		identifier_type,
		identifier_value
	);

create trigger set_generic_food_source_identifiers_updated_at
	before update on public.generic_food_source_identifiers
	for each row execute function public.set_updated_at();

comment on table public.generic_food_source_identifiers is
	'Exact identifiers explicitly supplied by a generic-food dataset. These links support cross-source deduplication without fuzzy identity guesses.';

insert into public.generic_food_source_identifiers (
	dataset_key,
	source_food_key,
	source_key,
	identifier_type,
	identifier_value,
	source_field,
	verification_method,
	metadata
)
select
	record.dataset_key,
	record.source_food_key,
	'usda',
	'ndb-number',
	lpad(regexp_replace(record.external_reference, '\D', '', 'g'), 5, '0'),
	'USDA_NDB_Code',
	'source-reference',
	jsonb_build_object(
		'declaredByDataset', record.dataset_key,
		'rawValue', record.external_reference
	)
from public.generic_food_records record
where record.dataset_key = 'cnf-2026'
	and record.external_reference is not null
	and regexp_replace(record.external_reference, '\D', '', 'g') <> ''
on conflict do nothing;

update public.user_food_list_items item
set food = item.food || jsonb_strip_nulls(jsonb_build_object(
	'foodIdentityType', product.food -> 'foodIdentityType',
	'scientificName', product.food -> 'scientificName',
	'alternateDescription', product.food -> 'alternateDescription',
	'preparation', product.food -> 'preparation',
	'ingredients', product.food -> 'ingredients',
	'ingredientList', product.food -> 'ingredientList',
	'structuredIngredients', product.food -> 'structuredIngredients',
	'ingredientAnalysis', product.food -> 'ingredientAnalysis',
	'additives', product.food -> 'additives',
	'allergens', product.food -> 'allergens',
	'traces', product.food -> 'traces',
	'dietaryTags', product.food -> 'dietaryTags',
	'labels', product.food -> 'labels',
	'packageQuantity', product.food -> 'packageQuantity',
	'sourceMetadata', product.food -> 'sourceMetadata',
	'foodNutrients', product.food -> 'foodNutrients',
	'reportedNutrientIds', product.food -> 'reportedNutrientIds',
	'foodServings', product.food -> 'foodServings',
	'hasSourceServing', product.food -> 'hasSourceServing',
	'servingSize', product.food -> 'servingSize',
	'servingSizeUnit', product.food -> 'servingSizeUnit',
	'householdServingFullText', product.food -> 'householdServingFullText',
	'customServingLabel', product.food -> 'customServingLabel',
	'customServingWeightGrams', product.food -> 'customServingWeightGrams',
	'fieldProvenance', product.food -> 'fieldProvenance',
	'sourceIdentifiers', product.food -> 'sourceIdentifiers'
))
from public.shared_products product
where product.id = item.shared_product_id
	and product.status = 'active';

delete from public.custom_foods custom_food
where coalesce(custom_food.source_key, 'custom') <> 'custom'
	and coalesce((custom_food.food ->> 'customFood')::boolean, false) is false;

alter table public.generic_food_source_identifiers enable row level security;
alter table public.generic_food_source_identifiers force row level security;

create policy generic_food_source_identifiers_read
	on public.generic_food_source_identifiers
	for select to authenticated
	using (
		exists (
			select 1
			from public.generic_food_datasets dataset
			join public.product_data_sources source
				on source.key = dataset.source_key
			where dataset.key = generic_food_source_identifiers.dataset_key
				and dataset.active
				and dataset.import_enabled
				and source.enabled
		)
	);

revoke all on table public.generic_food_source_identifiers
	from public, anon, authenticated;
grant select on table public.generic_food_source_identifiers to authenticated;
grant all on table public.generic_food_source_identifiers to service_role;

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
