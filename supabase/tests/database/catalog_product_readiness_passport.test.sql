begin;

select plan(10);

select ok(
	has_function_privilege(
		'authenticated',
		'public.get_blendcalc_api_catalog_product_readiness_passport(uuid)',
		'execute'
	),
	'authenticated sessions can reach the guarded product passport'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.get_blendcalc_api_catalog_product_readiness_passport(uuid)',
		'execute'
	),
	'anonymous clients cannot read product passports'
);

insert into auth.users (id, aud, role, email)
values
	('72100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'passport-user@blendcalc.local'),
	('72100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'passport-moderator@blendcalc.local'),
	('72100000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'passport-admin@blendcalc.local');

insert into public.app_role_assignments (user_id, role)
values
	('72100000-0000-4000-8000-000000000002', 'moderator'),
	('72100000-0000-4000-8000-000000000003', 'admin');

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72100000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.get_blendcalc_api_catalog_product_readiness_passport((select id from public.shared_products order by id limit 1))$$,
	'42501',
	'MFA-verified catalog access is required.',
	'normal users cannot read product passports'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72100000-0000-4000-8000-000000000002","role":"authenticated","app_role":"moderator","aal":"aal1"}',
	true
);

select throws_ok(
	$$select public.get_blendcalc_api_catalog_product_readiness_passport((select id from public.shared_products order by id limit 1))$$,
	'42501',
	'MFA-verified catalog access is required.',
	'catalog reviewers must verify MFA'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72100000-0000-4000-8000-000000000002","role":"authenticated","app_role":"moderator","aal":"aal2"}',
	true
);

select lives_ok(
	$$select public.get_blendcalc_api_catalog_product_readiness_passport((select id from public.shared_products order by id limit 1))$$,
	'MFA-verified catalog reviewers can read product passports'
);

select ok(
	public.get_blendcalc_api_catalog_product_readiness_passport(
		(select id from public.shared_products order by id limit 1)
	) ?& array['product', 'revision', 'qualityDimensions', 'evidence', 'issues'],
	'product passport has every top-level contract section'
);

select ok(
	public.get_blendcalc_api_catalog_product_readiness_passport(
		(select id from public.shared_products order by id limit 1)
	) -> 'product' ?& array[
		'sharedCatalogStatus',
		'blendCalcAPIV1Status',
		'searchableInBlendcalc',
		'usableInBlendcalc'
	],
	'product passport keeps blendCalc and API status separate'
);

select ok(
	public.get_blendcalc_api_catalog_product_readiness_passport(
		(select id from public.shared_products order by id limit 1)
	) -> 'evidence' ?& array[
		'selectedFieldCount',
		'normalizedNutrientCount',
		'nutrientsWithSourceEvidenceCount',
		'servingCount',
		'servingsWithSourceEvidenceCount',
		'observationCount',
		'sources'
	],
	'product passport reports bounded evidence coverage'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72100000-0000-4000-8000-000000000003","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select lives_ok(
	$$select public.get_blendcalc_api_catalog_product_readiness_passport((select id from public.shared_products order by id limit 1))$$,
	'MFA-verified data operators can read product passports'
);

select throws_ok(
	$$select public.get_blendcalc_api_catalog_product_readiness_passport('00000000-0000-4000-8000-000000000000')$$,
	'P0002',
	'Catalog product was not found.',
	'unknown product ids fail explicitly'
);

select * from finish();

rollback;
