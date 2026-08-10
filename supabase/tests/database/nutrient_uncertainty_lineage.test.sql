begin;

select plan(10);

insert into public.shared_product_observations (
	id,
	barcode,
	source,
	source_reference,
	source_license,
	raw_payload,
	normalized_food,
	content_hash
)
values (
	'10000000-0000-4000-8000-000000000021',
	'00000000000021',
	'usda',
	'12345',
	'CC0-1.0',
	'{}'::jsonb,
	jsonb_build_object(
		'foodNutrients', jsonb_build_array(
			jsonb_build_object(
				'nutrientId', 1003,
				'nutrientName', 'Protein',
				'nutrientNumber', '203',
				'unitName', 'G',
				'value', 0,
				'valueOrigin', 'reported',
				'valueStatus', 'reported-zero',
				'standardError', 0.15,
				'sourceNutrientKey', '1003',
				'sourceNutrientCode', '203',
				'mappingStatus', 'canonical',
				'mappingMethod', 'source-identifier',
				'mappingReviewReference', 'usda-fdc-nutrient-definition'
			),
			jsonb_build_object(
				'nutrientId', 1008,
				'nutrientName', 'Energy',
				'nutrientNumber', '208',
				'unitName', 'KCAL',
				'value', 12,
				'valueOrigin', 'derived',
				'valueStatus', 'derived',
				'mappingStatus', 'canonical',
				'derivationMethod', 'Atwater calculation'
			)
		),
		'reportedNutrientIds', jsonb_build_array(1003),
		'nutrientSourceReview', jsonb_build_array(
			jsonb_build_object(
				'nutrientName', 'Unmapped trace nutrient',
				'valueStatus', 'trace',
				'mappingStatus', 'unmapped'
			),
			jsonb_build_object(
				'nutrientName', 'Missing source nutrient',
				'valueStatus', 'missing',
				'mappingStatus', 'canonical'
			)
		)
	),
	repeat('d', 64)
);

select is(
	(select value_status from public.food_nutrients where shared_product_observation_id = '10000000-0000-4000-8000-000000000021' and nutrient_id = 1003),
	'reported-zero',
	'a source-reported zero remains distinct from missing'
);

select is(
	(select standard_error from public.food_nutrients where shared_product_observation_id = '10000000-0000-4000-8000-000000000021' and nutrient_id = 1003),
	0.15::numeric,
	'standard error is retained without changing the value'
);

select is(
	(select amount_per_100g from public.food_nutrients where shared_product_observation_id = '10000000-0000-4000-8000-000000000021' and nutrient_id = 1003),
	0::numeric,
	'uncertainty metadata does not change nutrient math'
);

select is(
	(select source_nutrient_key from public.food_nutrients where shared_product_observation_id = '10000000-0000-4000-8000-000000000021' and nutrient_id = 1003),
	'1003',
	'the source nutrient key is retained'
);

select is(
	(select source_nutrient_code from public.food_nutrients where shared_product_observation_id = '10000000-0000-4000-8000-000000000021' and nutrient_id = 1003),
	'203',
	'the source nutrient code is retained'
);

select is(
	(select mapping_status from public.food_nutrients where shared_product_observation_id = '10000000-0000-4000-8000-000000000021' and nutrient_id = 1003),
	'canonical',
	'the mapping status is retained'
);

select is(
	(select mapping_review_reference from public.food_nutrients where shared_product_observation_id = '10000000-0000-4000-8000-000000000021' and nutrient_id = 1003),
	'usda-fdc-nutrient-definition',
	'the mapping review reference is retained for moderation'
);

select is(
	(select value_status from public.food_nutrients where shared_product_observation_id = '10000000-0000-4000-8000-000000000021' and nutrient_id = 1008),
	'derived',
	'a derived value remains distinct from reported values'
);

select is(
	(select derivation_method from public.food_nutrients where shared_product_observation_id = '10000000-0000-4000-8000-000000000021' and nutrient_id = 1008),
	'Atwater calculation',
	'the exact derivation method is retained'
);

select is(
	(select count(*)::integer from public.food_nutrients where shared_product_observation_id = '10000000-0000-4000-8000-000000000021'),
	2,
	'trace and missing source facts do not become numeric nutrient rows'
);

select * from finish();

rollback;
