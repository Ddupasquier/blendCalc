begin;

select plan(8);

select ok(
	not exists (
		select 1
		from public.nutrient_source_mappings
		where mapping_method in ('api_taxonomy_match', 'api_observation_match')
			and (enabled or review_status <> 'pending_review')
	),
	'semantic nutrient matches remain disabled review candidates'
);

select ok(
	not exists (
		select 1
		from public.nutrient_source_mappings
		where enabled and review_status <> 'approved'
	),
	'enabled nutrient mappings are approved'
);

select ok(
	not exists (
		select 1
		from public.nutrient_source_mappings
		where review_status = 'approved'
			and (
				nullif(btrim(review_reference), '') is null
				or reviewed_at is null
			)
	),
	'approved nutrient mappings retain review evidence'
);

select throws_ok(
	$$
		insert into public.nutrient_source_mappings (
			source_key,
			source_nutrient_key,
			source_unit_name,
			nutrient_id,
			mapping_method,
			confidence,
			enabled,
			review_status,
			review_reference,
			reviewed_at
		)
		values (
			'open-food-facts',
			'qa-semantic-vitamin',
			'G',
			1106,
			'api_taxonomy_match',
			1,
			true,
			'approved',
			'qa-automatic-semantic-approval',
			now()
		)
	$$,
	'23514',
	'new row for relation "nutrient_source_mappings" violates check constraint "nutrient_source_mappings_semantic_candidate_check"',
	'semantic similarity cannot become an approved mapping without a reviewed identity method'
);

select lives_ok(
	$$
		update public.nutrient_source_mappings
		set observation_count = observation_count
		where source_key = 'open-food-facts'
			and mapping_method in ('api_taxonomy_match', 'api_observation_match')
			and review_status = 'pending_review'
	$$,
	'pending semantic nutrient observations can refresh non-authoritative metadata'
);

select ok(
	not exists (
		select 1
		from public.food_nutrients
		where mapping_method in ('api_taxonomy_match', 'api_observation_match')
			and mapping_status = 'canonical'
	),
	'previous semantic nutrient lineage is no longer canonical'
);

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings
		where mapping_method = 'db_reviewed_api_key_match'
			and enabled
			and review_status = 'approved'
	),
	'explicitly reviewed source-key mappings remain active'
);

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
	'10000000-0000-4000-8000-000000000029',
	'00000000000029',
	'open-food-facts',
	'00000000000029',
	'ODbL-1.0',
	'{}'::jsonb,
	jsonb_build_object(
		'foodNutrients',
		jsonb_build_array(jsonb_build_object(
			'nutrientId', 1109,
			'nutrientName', 'Vitamin E',
			'nutrientNumber', '323',
			'unitName', 'MG',
			'value', 1,
			'valueStatus', 'reported',
			'mappingStatus', 'canonical',
			'mappingMethod', 'api_taxonomy_match',
			'mappingReviewReference', 'legacy-automatic-taxonomy-match'
		))
	),
	repeat('f', 64)
);

select is(
	(
		select mapping_status
		from public.food_nutrients
		where shared_product_observation_id =
			'10000000-0000-4000-8000-000000000029'
			and nutrient_id = 1109
	),
	'unmapped',
	'legacy semantic metadata cannot recreate canonical normalized lineage'
);

select * from finish();

rollback;
