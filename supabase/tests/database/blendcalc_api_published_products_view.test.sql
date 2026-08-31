begin;

select plan(9);

select has_view(
	'public',
	'blendcalc_api_v1_published_products',
	'blendCalcAPI v1 has a direct published-product inventory'
);

select has_column(
	'public',
	'blendcalc_api_v1_published_products',
	'quality_dimensions',
	'the published-product inventory retains publication quality evidence'
);

select has_column(
	'public',
	'blendcalc_api_v1_published_products',
	'api_path',
	'the published-product inventory exposes the exact API detail path'
);

select is(
	(
		select count(*)::bigint
		from public.blendcalc_api_v1_published_products
	),
	(
		select count(*)::bigint
		from public.blendcalc_api_v1_product_readiness
		where publishable
	),
	'the inventory contains every currently publishable product exactly once'
);

select ok(
	not exists (
		select 1
		from public.blendcalc_api_v1_published_products published
		left join public.blendcalc_api_v1_product_readiness readiness
			on readiness.shared_product_id = published.shared_product_id
		where not coalesce(readiness.publishable, false)
	),
	'the inventory never includes a withheld catalog product'
);

select ok(
	not exists (
		select 1
		from public.blendcalc_api_v1_published_products published
		where published.api_path <> '/api/v1/products/' || published.barcode
			or published.publication_status <> 'verified'
	),
	'published rows expose their exact API path and verified publication status'
);

select ok(
	not has_table_privilege(
		'anon',
		'public.blendcalc_api_v1_published_products',
		'select'
	),
	'anonymous clients cannot bypass the versioned HTTP API through the view'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.blendcalc_api_v1_published_products',
		'select'
	),
	'authenticated clients cannot bypass the versioned HTTP API through the view'
);

select ok(
	has_table_privilege(
		'service_role',
		'public.blendcalc_api_v1_published_products',
		'select'
	),
	'trusted server and Supabase operations can inspect the published inventory'
);

select * from finish();

rollback;
