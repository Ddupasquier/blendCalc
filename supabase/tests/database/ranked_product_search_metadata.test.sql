begin;

select plan(10);

select ok(
	position('taylor farms' in public.food_metadata_search_text(jsonb_build_object(
		'description', 'Garden Salad',
		'brandOwner', 'Taylor Farms'
	))) > 0,
	'brand and owner metadata contributes to product search text'
);

select ok(
	position('packaged salad kits' in public.food_metadata_search_text(jsonb_build_object(
		'foodCategory', 'Vegetables',
		'brandedFoodCategory', 'Packaged Salad Kits',
		'categories', jsonb_build_array('Fresh Foods')
	))) > 0,
	'canonical and source categories contribute to product search text'
);

select ok(
	position('eruca vesicaria' in public.food_metadata_search_text(jsonb_build_object(
		'alternateDescription', 'Rocket leaves',
		'scientificName', 'Eruca vesicaria',
		'preparation', 'Washed and ready to eat'
	))) > 0,
	'alternate identity and preparation metadata contribute to product search text'
);

select ok(
	position('soy protein isolate' in public.food_metadata_search_text(jsonb_build_object(
		'structuredIngredients', jsonb_build_array(jsonb_build_object(
			'text', 'Seasoning',
			'ingredients', jsonb_build_array(jsonb_build_object(
				'text', 'Soy Protein Isolate'
			))
		))
	))) > 0,
	'nested structured ingredients contribute to product search text'
);

select ok(
	position('shared equipment' in public.food_metadata_search_text(jsonb_build_object(
		'precautionaryStatements', jsonb_build_array(jsonb_build_object(
			'text', 'Made on shared equipment with peanuts',
			'allergens', jsonb_build_array('Peanuts')
		))
	))) > 0,
	'precautionary statements contribute to product search text'
);

select ok(
	position('tablespoon' in public.food_metadata_search_text(jsonb_build_object(
		'foodServings', jsonb_build_array(jsonb_build_object(
			'label', '1 tablespoon',
			'measureType', 'household measure'
		))
	))) > 0,
	'household serving labels contribute to product search text'
);

select ok(
	position('legacy-1234' in public.food_metadata_search_text(jsonb_build_object(
		'sourceIdentifiers', jsonb_build_object('providerRecord', 'legacy-1234')
	))) > 0,
	'source identifier values contribute without indexing internal field names'
);

select is(
	public.food_metadata_search_text(jsonb_build_object(
		'structuredIngredients', jsonb_build_object('text', 'invalid legacy shape'),
		'precautionaryStatements', 'null'::jsonb,
		'foodServings', jsonb_build_object('label', 'invalid legacy shape')
	)),
	'',
	'invalid optional metadata shapes remain searchable without breaking writes'
);

select is(
	(
		select count(*)::integer
		from public.search_blendcalc_products_v1(
			'afewa',
			array['afewa'],
			10,
			0
		)
		where brand_owner = 'Safeway, Inc.'
	),
	1,
	'API v1 catalog search accepts partial brand text for publication-ready products'
);

select is(
	(
		select count(*)::integer
		from public.official_food_safety_alert_matches match
		join public.official_food_safety_alerts alert on alert.id = match.alert_id
		where alert.is_active
			and alert.recalling_organization ilike '%taylor%'
			and match.status in ('active', 'confirmed')
	),
	4,
	'all four Taylor supplier recall products remain linked for organization search'
);

select * from finish();
rollback;
