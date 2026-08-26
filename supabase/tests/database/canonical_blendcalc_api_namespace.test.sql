begin;

select plan(12);

select hasnt_view(
	'public',
	'api_publication_concerns',
	'the legacy publication-concern view is removed'
);

select hasnt_view(
	'public',
	'api_publication_holds',
	'the legacy publication-hold view is removed'
);

select hasnt_function(
	'public',
	'get_blendcalc_product_v1',
	array['text'],
	'the legacy product reader is removed'
);

select hasnt_function(
	'public',
	'search_blendcalc_products_v1',
	array['text', 'text[]', 'integer', 'integer'],
	'the legacy product search is removed'
);

select hasnt_function(
	'public',
	'get_blendcalc_product_revision_history_v1',
	array['text', 'integer', 'integer'],
	'the legacy revision-history reader is removed'
);

select hasnt_function(
	'public',
	'get_catalog_product_readiness_passport',
	array['uuid'],
	'the legacy readiness-passport reader is removed'
);

select is(
	(
		select count(*)::integer
		from public.blendcalc_api_publication_profiles profile
		where profile.key = 'api-v1-packaged-product-v1'
	),
	0,
	'the legacy publication profile is removed'
);

select is(
	(
		select count(*)::integer
		from public.nutrition_completeness_profiles profile
		where profile.key = 'api-v1-packaged-core-v1'
	),
	0,
	'the legacy nutrition profile is removed'
);

select has_table(
	'public',
	'blendcalc_api_publication_concerns',
	'the canonical publication-concern table remains'
);

select has_table(
	'public',
	'blendcalc_api_publication_holds',
	'the canonical publication-hold table remains'
);

select has_function(
	'public',
	'get_blendcalc_api_product_v1',
	array['text'],
	'the canonical product reader remains'
);

select has_function(
	'public',
	'get_blendcalc_api_catalog_product_readiness_passport',
	array['uuid'],
	'the canonical readiness-passport reader remains'
);

select * from finish();

rollback;
