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
	first_observed_at,
	last_observed_at,
	provenance,
	review_status,
	review_reference,
	reviewed_at
)
values
	(
		'open-food-facts',
		'calcium',
		'G',
		'Calcium',
		1087,
		0,
		'db_reviewed_api_key_match',
		1,
		true,
		1,
		now(),
		now(),
		jsonb_build_object(
			'sourceReference', 'https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/',
			'reviewedExampleBarcode', '00030000581728',
			'reason', 'Exact Open Food Facts calcium field with a reported gram unit.'
		),
		'approved',
		'20260902120000_open_food_facts_micronutrient_mappings',
		now()
	),
	(
		'open-food-facts',
		'iron',
		'G',
		'Iron',
		1089,
		0,
		'db_reviewed_api_key_match',
		1,
		true,
		1,
		now(),
		now(),
		jsonb_build_object(
			'sourceReference', 'https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/',
			'reviewedExampleBarcode', '00030000581728',
			'reason', 'Exact Open Food Facts iron field with a reported gram unit.'
		),
		'approved',
		'20260902120000_open_food_facts_micronutrient_mappings',
		now()
	),
	(
		'open-food-facts',
		'potassium',
		'G',
		'Potassium',
		1092,
		0,
		'db_reviewed_api_key_match',
		1,
		true,
		1,
		now(),
		now(),
		jsonb_build_object(
			'sourceReference', 'https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/',
			'reviewedExampleBarcode', '00030000581728',
			'reason', 'Exact Open Food Facts potassium field with a reported gram unit.'
		),
		'approved',
		'20260902120000_open_food_facts_micronutrient_mappings',
		now()
	),
	(
		'open-food-facts',
		'vitamin-d',
		'G',
		'Vitamin D',
		1114,
		0,
		'db_reviewed_api_key_match',
		1,
		true,
		1,
		now(),
		now(),
		jsonb_build_object(
			'sourceReference', 'https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/',
			'reviewedExampleBarcode', '00030000581728',
			'reason', 'Exact Open Food Facts vitamin-d field with a reported gram unit.'
		),
		'approved',
		'20260902120000_open_food_facts_micronutrient_mappings',
		now()
	)
on conflict (source_key, source_nutrient_key, source_unit_name) do update set
	source_nutrient_name = excluded.source_nutrient_name,
	nutrient_id = excluded.nutrient_id,
	priority = excluded.priority,
	mapping_method = excluded.mapping_method,
	confidence = excluded.confidence,
	enabled = excluded.enabled,
	observation_count = greatest(public.nutrient_source_mappings.observation_count, excluded.observation_count),
	first_observed_at = coalesce(public.nutrient_source_mappings.first_observed_at, excluded.first_observed_at),
	last_observed_at = greatest(public.nutrient_source_mappings.last_observed_at, excluded.last_observed_at),
	provenance = public.nutrient_source_mappings.provenance || excluded.provenance,
	review_status = excluded.review_status,
	review_reference = excluded.review_reference,
	reviewed_at = excluded.reviewed_at,
	updated_at = now();

insert into public.nutrient_unit_conversions (
	source_key,
	nutrient_id,
	from_unit_name,
	to_unit_name,
	multiplier,
	conversion_method,
	confidence,
	observation_count,
	provenance
)
values
	('open-food-facts', 1087, 'G', 'MG', 1000, 'reviewed_standard', 1, 1, jsonb_build_object('sourceReference', 'https://ucum.org/ucum', 'rule', 'grams to milligrams')),
	('open-food-facts', 1089, 'G', 'MG', 1000, 'reviewed_standard', 1, 1, jsonb_build_object('sourceReference', 'https://ucum.org/ucum', 'rule', 'grams to milligrams')),
	('open-food-facts', 1092, 'G', 'MG', 1000, 'reviewed_standard', 1, 1, jsonb_build_object('sourceReference', 'https://ucum.org/ucum', 'rule', 'grams to milligrams')),
	('open-food-facts', 1114, 'G', 'UG', 1000000, 'reviewed_standard', 1, 1, jsonb_build_object('sourceReference', 'https://ucum.org/ucum', 'rule', 'grams to micrograms'))
on conflict (source_key, nutrient_id, from_unit_name, to_unit_name) do update set
	multiplier = excluded.multiplier,
	conversion_method = excluded.conversion_method,
	confidence = excluded.confidence,
	observation_count = greatest(public.nutrient_unit_conversions.observation_count, excluded.observation_count),
	provenance = public.nutrient_unit_conversions.provenance || excluded.provenance,
	updated_at = now();
