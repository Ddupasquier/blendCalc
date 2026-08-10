begin;

select plan(6);

insert into public.shared_product_observations (
	id,
	barcode,
	source,
	source_reference,
	source_license,
	raw_payload,
	content_hash
)
values (
	'10000000-0000-4000-8000-000000000001',
	'00000000000001',
	'usda',
	'12345',
	'CC0-1.0',
	'{}'::jsonb,
	repeat('a', 64)
);

insert into public.food_nutrients (
	shared_product_observation_id,
	nutrient_id,
	amount_per_100g,
	unit_name,
	value_origin,
	source,
	source_reference,
	confidence
)
values (
	'10000000-0000-4000-8000-000000000001',
	1003,
	1,
	'G',
	'reported',
	'usda',
	'12345',
	'source-verified'
);

insert into public.food_servings (
	shared_product_observation_id,
	serving_order,
	label,
	gram_weight,
	is_primary,
	source,
	source_reference,
	confidence
)
values (
	'10000000-0000-4000-8000-000000000001',
	1,
	'1 serving',
	100,
	true,
	'usda',
	'12345',
	'source-verified'
);

select is(
	(
		select source_observation_id
		from public.food_nutrients
		where shared_product_observation_id =
			'10000000-0000-4000-8000-000000000001'
	),
	'10000000-0000-4000-8000-000000000001'::uuid,
	'nutrient lineage retains the exact observation'
);

select is(
	(
		select confidence
		from public.food_nutrients
		where shared_product_observation_id =
			'10000000-0000-4000-8000-000000000001'
	),
	'imported',
	'a provider observation does not blanket-verify a nutrient'
);

select is(
	(
		select source
		from public.food_nutrients
		where shared_product_observation_id =
			'10000000-0000-4000-8000-000000000001'
	),
	'usda',
	'nutrient source comes from the linked observation'
);

select is(
	(
		select source_observation_id
		from public.food_servings
		where shared_product_observation_id =
			'10000000-0000-4000-8000-000000000001'
	),
	'10000000-0000-4000-8000-000000000001'::uuid,
	'serving lineage retains the exact observation'
);

select is(
	(
		select confidence
		from public.food_servings
		where shared_product_observation_id =
			'10000000-0000-4000-8000-000000000001'
	),
	'imported',
	'a provider observation does not blanket-verify a serving'
);

select is(
	(
		select source
		from public.food_servings
		where shared_product_observation_id =
			'10000000-0000-4000-8000-000000000001'
	),
	'usda',
	'serving source comes from the linked observation'
);

select * from finish();

rollback;
