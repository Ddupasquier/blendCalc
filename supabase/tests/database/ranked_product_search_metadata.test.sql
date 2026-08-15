begin;

select plan(4);

select like(
	public.food_metadata_search_text(jsonb_build_object(
		'description', 'Garden Salad',
		'brandOwner', 'Taylor Farms'
	)),
	'%taylor farms%',
	'brand and owner metadata contributes to product search text'
);

select like(
	public.food_metadata_search_text(jsonb_build_object(
		'foodCategory', 'Vegetables',
		'brandedFoodCategory', 'Packaged Salad Kits',
		'categories', jsonb_build_array('Fresh Foods')
	)),
	'%packaged salad kits%',
	'canonical and source categories contribute to product search text'
);

select like(
	public.food_metadata_search_text(jsonb_build_object(
		'alternateDescription', 'Rocket leaves',
		'scientificName', 'Eruca vesicaria',
		'preparation', 'Washed and ready to eat'
	)),
	'%eruca vesicaria%',
	'alternate identity and preparation metadata contribute to product search text'
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
