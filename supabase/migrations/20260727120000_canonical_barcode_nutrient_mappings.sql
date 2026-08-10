insert into public.nutrient_source_mappings (
	source_key,
	source_nutrient_key,
	source_unit_name,
	source_nutrient_name,
	nutrient_id,
	priority,
	mapping_method,
	confidence,
	enabled,
	observation_count,
	provenance,
	review_status,
	review_reference,
	reviewed_at
)
values
	('open-food-facts', 'energy-kcal', 'KCAL', 'Energy', 1008, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts nutrition-label field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'energy', 'KJ', 'Energy', 1008, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts energy field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'proteins', 'G', 'Proteins', 1003, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts nutrition-label field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'fat', 'G', 'Fat', 1004, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts total-fat field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'carbohydrates', 'G', 'Carbohydrates', 1005, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts nutrition-label field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'fiber', 'G', 'Fiber', 1079, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts nutrition-label field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'sugars', 'G', 'Sugars', 2000, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts total-sugars field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'added-sugars', 'G', 'Added sugars', 1235, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts added-sugars field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'sodium', 'G', 'Sodium', 1093, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts sodium field; converted from grams to milligrams by the reviewed unit catalog."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'saturated-fat', 'G', 'Saturated fat', 1258, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts saturated-fat field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'trans-fat', 'G', 'Trans fat', 1257, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts trans-fat field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'polyunsaturated-fat', 'G', 'Polyunsaturated fat', 1293, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts polyunsaturated-fat field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'monounsaturated-fat', 'G', 'Monounsaturated fat', 1292, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts monounsaturated-fat field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'cholesterol', 'G', 'Cholesterol', 1253, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts cholesterol field; converted to the canonical unit by the reviewed unit catalog."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now()),
	('open-food-facts', 'cholesterol', 'MG', 'Cholesterol', 1253, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts cholesterol field."}'::jsonb, 'approved', '20260727120000_canonical_barcode_nutrient_mappings', now())
on conflict (source_key, source_nutrient_key, source_unit_name) do update set
	source_nutrient_name = excluded.source_nutrient_name,
	nutrient_id = excluded.nutrient_id,
	priority = excluded.priority,
	mapping_method = excluded.mapping_method,
	confidence = excluded.confidence,
	enabled = excluded.enabled,
	provenance = public.nutrient_source_mappings.provenance || excluded.provenance,
	review_status = excluded.review_status,
	review_reference = excluded.review_reference,
	reviewed_at = excluded.reviewed_at,
	updated_at = now();

create function pg_temp.canonicalize_barcode_food_nutrients(p_food jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
	v_food jsonb := p_food;
	v_nutrients jsonb;
	v_reported_ids jsonb;
begin
	if p_food is null or jsonb_typeof(p_food -> 'foodNutrients') <> 'array' then
		return p_food;
	end if;

	with raw_nutrients as (
		select
			item,
			ordinality,
			(item ->> 'nutrientId')::bigint as source_nutrient_id,
			nullif(btrim(item ->> 'nutrientNumber'), '') as source_nutrient_number
		from jsonb_array_elements(p_food -> 'foodNutrients')
			with ordinality as nutrients(item, ordinality)
		where jsonb_typeof(item) = 'object'
			and jsonb_typeof(item -> 'nutrientId') = 'number'
	),
	resolved_nutrients as (
		select
			raw_nutrients.*,
			coalesce(equivalence.canonical_nutrient_id, source_nutrient_id)
				as canonical_nutrient_id
		from raw_nutrients
		left join lateral (
			select candidate.canonical_nutrient_id
			from public.nutrient_equivalences candidate
			where candidate.enabled
				and candidate.source_key = 'usda'
				and (
					candidate.source_nutrient_id = raw_nutrients.source_nutrient_id
					or (
						candidate.source_nutrient_number is not null
						and candidate.source_nutrient_number =
							raw_nutrients.source_nutrient_number
					)
				)
			order by
				(candidate.source_nutrient_id = raw_nutrients.source_nutrient_id) desc,
				candidate.id
			limit 1
		) equivalence on true
	),
	selected_nutrients as (
		select distinct on (resolved.canonical_nutrient_id)
			resolved.ordinality,
			resolved.item,
			resolved.source_nutrient_id,
			resolved.canonical_nutrient_id
		from resolved_nutrients resolved
		order by
			resolved.canonical_nutrient_id,
			(resolved.source_nutrient_id = resolved.canonical_nutrient_id) desc,
			resolved.ordinality
	)
	select coalesce(
		jsonb_agg(
			selected.item || jsonb_build_object(
				'nutrientId', selected.canonical_nutrient_id,
				'nutrientName', definition.nutrient_name,
				'nutrientNumber', coalesce(definition.nutrient_number, ''),
				'unitName', definition.default_unit_name
			)
			order by selected.ordinality
		),
		'[]'::jsonb
	)
	into v_nutrients
	from selected_nutrients selected
	join public.nutrient_definitions definition
		on definition.nutrient_id = selected.canonical_nutrient_id;

	v_food := jsonb_set(v_food, '{foodNutrients}', v_nutrients, true);

	if jsonb_typeof(p_food -> 'reportedNutrientIds') = 'array' then
		with raw_ids as (
			select
				(value #>> '{}')::bigint as source_nutrient_id,
				ordinality
			from jsonb_array_elements(p_food -> 'reportedNutrientIds')
				with ordinality as ids(value, ordinality)
			where jsonb_typeof(value) = 'number'
		),
		resolved_ids as (
			select
				coalesce(equivalence.canonical_nutrient_id, raw.source_nutrient_id)
					as canonical_nutrient_id,
				min(raw.ordinality) as first_ordinality
			from raw_ids raw
			left join lateral (
				select candidate.canonical_nutrient_id
				from public.nutrient_equivalences candidate
				where candidate.enabled
					and candidate.source_key = 'usda'
					and candidate.source_nutrient_id = raw.source_nutrient_id
				order by candidate.id
				limit 1
			) equivalence on true
			group by coalesce(
				equivalence.canonical_nutrient_id,
				raw.source_nutrient_id
			)
		)
		select coalesce(
			jsonb_agg(canonical_nutrient_id order by first_ordinality),
			'[]'::jsonb
		)
		into v_reported_ids
		from resolved_ids;

		v_food := jsonb_set(
			v_food,
			'{reportedNutrientIds}',
			v_reported_ids,
			true
		);
	end if;

	return v_food;
end;
$$;

with canonical as (
	select
		id,
		pg_temp.canonicalize_barcode_food_nutrients(food) as food
	from public.user_food_list_items
)
update public.user_food_list_items target
set food = canonical.food
from canonical
where target.id = canonical.id
	and target.food is distinct from canonical.food;

with canonical as (
	select
		id,
		pg_temp.canonicalize_barcode_food_nutrients(food) as food
	from public.custom_foods
)
update public.custom_foods target
set food = canonical.food
from canonical
where target.id = canonical.id
	and target.food is distinct from canonical.food;

with canonical as (
	select
		id,
		pg_temp.canonicalize_barcode_food_nutrients(food) as food
	from public.shared_product_submissions
)
update public.shared_product_submissions target
set food = canonical.food
from canonical
where target.id = canonical.id
	and target.food is distinct from canonical.food;

with canonical as (
	select
		id,
		pg_temp.canonicalize_barcode_food_nutrients(food) as food
	from public.shared_products
)
update public.shared_products target
set food = canonical.food
from canonical
where target.id = canonical.id
	and target.food is distinct from canonical.food;

with canonical as (
	select
		id,
		pg_temp.canonicalize_barcode_food_nutrients(food) as food
	from public.shared_product_revisions
)
update public.shared_product_revisions target
set food = canonical.food
from canonical
where target.id = canonical.id
	and target.food is distinct from canonical.food;

with canonical as (
	select
		id,
		pg_temp.canonicalize_barcode_food_nutrients(normalized_food)
			as normalized_food
	from public.shared_product_observations
	where normalized_food is not null
)
update public.shared_product_observations target
set normalized_food = canonical.normalized_food
from canonical
where target.id = canonical.id
	and target.normalized_food is distinct from canonical.normalized_food;
