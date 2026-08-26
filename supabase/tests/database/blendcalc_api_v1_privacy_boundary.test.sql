begin;

select plan(15);

insert into auth.users (id, aud, role, email)
values (
	'78000000-0000-4000-8000-000000000001',
	'authenticated',
	'authenticated',
	'api-privacy@blendcalc.local'
);

insert into public.custom_foods (
	user_id,
	fdc_id,
	barcode,
	category_option_id,
	food
)
select
	'78000000-0000-4000-8000-000000000001',
	-780001,
	'09999999999987',
	category.id,
	jsonb_build_object(
		'fdcId', -780001,
		'description', 'API Privacy Sentinel Food',
		'barcode', '09999999999987',
		'customFood', true,
		'customServingWeightGrams', 100,
		'categoryOptionId', category.id,
		'categories', jsonb_build_array(category.label),
		'privateLabel', 'API-PRIVATE-FOOD-SENTINEL',
		'foodNutrients', jsonb_build_array(
			jsonb_build_object('nutrientId', 1008, 'value', 100),
			jsonb_build_object('nutrientId', 1004, 'value', 0),
			jsonb_build_object('nutrientId', 1005, 'value', 25),
			jsonb_build_object('nutrientId', 1003, 'value', 0),
			jsonb_build_object('nutrientId', 1093, 'value', 0),
			jsonb_build_object('nutrientId', 2000, 'value', 0)
		)
	)
from public.custom_food_category_options category
where category.enabled
order by category.id
limit 1;

insert into public.shared_product_submissions (
	id,
	submitted_by,
	barcode,
	product_name,
	food,
	consent_to_share,
	evidence_paths,
	status
)
values (
	'78000000-0000-4000-8000-000000000002',
	'78000000-0000-4000-8000-000000000001',
	'09999999999994',
	'API Pending Privacy Sentinel',
	jsonb_build_object(
		'fdcId', -780002,
		'description', 'API Pending Privacy Sentinel',
		'foodNutrients', '[]'::jsonb
	),
	true,
	jsonb_build_object('front', 'private/API-PENDING-EVIDENCE-SENTINEL.jpg'),
	'pending'
);

select ok(
	not has_function_privilege(
		'authenticated',
		'public.get_blendcalc_api_product_v1(text)',
		'EXECUTE'
	),
	'authenticated clients cannot read raw canonical product documents'
);
select ok(
	not has_function_privilege(
		'authenticated',
		'public.search_blendcalc_api_products_v1(text,text[],integer,integer)',
		'EXECUTE'
	),
	'authenticated clients cannot search raw canonical product documents'
);
select ok(
	not has_function_privilege(
		'authenticated',
		'public.get_blendcalc_api_product_revision_history_v1(text,integer,integer)',
		'EXECUTE'
	),
	'authenticated clients cannot bypass revision-history sanitization'
);
select ok(
	not has_function_privilege(
		'anon',
		'public.get_blendcalc_api_product_v1(text)',
		'EXECUTE'
	),
	'anonymous clients cannot read raw canonical product documents'
);
select ok(
	not has_function_privilege(
		'anon',
		'public.search_blendcalc_api_products_v1(text,text[],integer,integer)',
		'EXECUTE'
	),
	'anonymous clients cannot search raw canonical product documents'
);
select ok(
	not has_function_privilege(
		'anon',
		'public.get_blendcalc_api_product_revision_history_v1(text,integer,integer)',
		'EXECUTE'
	),
	'anonymous clients cannot read raw revision-history rows'
);
select ok(
	has_function_privilege(
		'service_role',
		'public.get_blendcalc_api_product_v1(text)',
		'EXECUTE'
	),
	'the trusted server can read a publication-ready product'
);
select ok(
	has_function_privilege(
		'service_role',
		'public.search_blendcalc_api_products_v1(text,text[],integer,integer)',
		'EXECUTE'
	),
	'the trusted server can search publication-ready products'
);
select ok(
	has_function_privilege(
		'service_role',
		'public.get_blendcalc_api_product_revision_history_v1(text,integer,integer)',
		'EXECUTE'
	),
	'the trusted server can read publication-ready revision history'
);
select is(
	(
		select count(*)::integer
		from public.get_blendcalc_api_product_v1('00021130493609')
	),
	1,
	'the known publication-ready fixture remains available to the trusted reader'
);
select is(
	(
		select count(*)::integer
		from public.get_blendcalc_api_product_v1('00011110904416')
	),
	0,
	'an incomplete active catalog product is withheld'
);
select is(
	(
		select count(*)::integer
		from public.get_blendcalc_api_product_v1('09999999999994')
	),
	0,
	'the explicit pending product submission is withheld'
);
select is(
	(
		select count(*)::integer
		from public.get_blendcalc_api_product_v1('09999999999987')
	),
	0,
	'the explicit private custom food is withheld'
);
select is(
	(
		select count(*)::integer
		from public.search_blendcalc_api_products_v1(
			'no serving',
			array['no', 'serving'],
			50,
			0
		)
	),
	0,
	'search withholds incomplete catalog products'
);
select is(
	(
		select count(*)::integer
		from public.search_blendcalc_api_products_v1(
			'api pending privacy sentinel',
			array['api', 'pending', 'privacy', 'sentinel'],
			50,
			0
		)
	),
	0,
	'search withholds the explicit pending submission'
);

select * from finish();

rollback;
