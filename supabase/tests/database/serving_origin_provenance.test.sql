begin;

select plan(8);

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
values
(
	'10000000-0000-4000-8000-000000000011',
	'00000000000011',
	'open-food-facts',
	'00000000000011',
	'ODbL-1.0',
	'{}'::jsonb,
	jsonb_build_object(
		'foodIdentityType', 'packaged',
		'foodServings', jsonb_build_array(jsonb_build_object(
			'label', '1/2 cup',
			'gramWeight', 125,
			'amount', 0.5,
			'unitKey', 'cup',
			'measureType', 'Package serving',
			'isHouseholdMeasure', true,
			'sourceMeasureKey', 'serving_size',
			'origin', 'package-label',
			'gramWeightMethod', 'source-reported',
			'calculationBasis', 'Package reports 1/2 cup as 125g'
		))
	),
	repeat('b', 64)
),
(
	'10000000-0000-4000-8000-000000000012',
	'00000000000012',
	'usda',
	'67890',
	'CC0-1.0',
	'{}'::jsonb,
	'{}'::jsonb,
	repeat('c', 64)
);

insert into public.food_servings (
	shared_product_observation_id,
	serving_order,
	label,
	gram_weight,
	amount,
	unit_key,
	is_primary,
	source,
	source_reference,
	confidence
)
values (
	'10000000-0000-4000-8000-000000000012',
	1,
	'1 serving',
	100,
	null,
	null,
	true,
	'usda',
	'67890',
	'imported'
);

select is(
	(select origin from public.food_servings where shared_product_observation_id = '10000000-0000-4000-8000-000000000011'),
	'package-label',
	'an exact source serving retains its package-label origin'
);

select is(
	(select gram_weight_method from public.food_servings where shared_product_observation_id = '10000000-0000-4000-8000-000000000011'),
	'source-reported',
	'an exact source serving retains its reported gram-weight method'
);

select is(
	(select measure_type from public.food_servings where shared_product_observation_id = '10000000-0000-4000-8000-000000000011'),
	'Package serving',
	'an exact source serving retains its measure type'
);

select is(
	(select is_household_measure from public.food_servings where shared_product_observation_id = '10000000-0000-4000-8000-000000000011'),
	true,
	'an exact volume serving remains a household measure'
);

select is(
	(select source_measure_key from public.food_servings where shared_product_observation_id = '10000000-0000-4000-8000-000000000011'),
	'serving_size',
	'an exact source serving retains its source measure key'
);

select is(
	(select calculation_basis from public.food_servings where shared_product_observation_id = '10000000-0000-4000-8000-000000000011'),
	'Package reports 1/2 cup as 125g',
	'an exact source serving retains its calculation basis'
);

select is(
	(select origin from public.food_servings where shared_product_observation_id = '10000000-0000-4000-8000-000000000012'),
	'unknown',
	'a provider identity does not invent a serving origin'
);

select is(
	(select gram_weight_method from public.food_servings where shared_product_observation_id = '10000000-0000-4000-8000-000000000012'),
	'unknown',
	'a provider identity does not invent a gram-weight method'
);

select * from finish();

rollback;
