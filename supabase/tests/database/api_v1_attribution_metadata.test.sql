begin;

select plan(8);

select ok(
	public.blendcalc_api_v1_source_attribution_is_complete('usda', '123'),
	'a direct external API record remains eligible when its provider also owns imported datasets'
);

insert into public.product_data_sources (
	key,
	display_name,
	source_type,
	homepage_url,
	terms_url,
	attribution_text,
	enabled,
	canonical_storage_allowed,
	canonical_license_name,
	canonical_policy_reviewed_at,
	api_redistribution_allowed
)
values (
	'api-attribution-fixture',
	'API Attribution Fixture',
	'standards_api',
	'https://example.com/api-attribution-fixture',
	'https://example.com/api-attribution-fixture/license',
	'API Attribution Fixture contributors',
	true,
	true,
	'Fixture Licence',
	now(),
	true
);

insert into public.generic_food_datasets (
	key,
	source_key,
	display_name,
	version,
	region_code,
	source_url,
	download_url,
	license_name,
	license_url,
	attribution_text,
	license_review_status,
	import_enabled,
	active,
	imported_at
)
values (
	'api-attribution-2026',
	'api-attribution-fixture',
	'API Attribution Dataset 2026',
	'2026',
	'US',
	'https://example.com/api-attribution-fixture/dataset',
	'https://example.com/api-attribution-fixture/download',
	'Fixture Licence',
	'https://example.com/api-attribution-fixture/license',
	'API Attribution Fixture contributors',
	'approved',
	true,
	true,
	now()
);

select ok(
	public.blendcalc_api_v1_source_attribution_is_complete(
		'api-attribution-fixture',
		'api-attribution-2026:101'
	),
	'an exact imported dataset release is eligible'
);

select ok(
	not public.blendcalc_api_v1_source_attribution_is_complete(
		'api-attribution-fixture',
		'unknown-release:101'
	),
	'an unknown dataset release fails closed'
);

select ok(
	not public.blendcalc_api_v1_source_attribution_is_complete(
		'api-attribution-fixture',
		null
	),
	'a dataset-backed source without an exact release reference fails closed'
);

update public.generic_food_datasets
set imported_at = null
where key = 'api-attribution-2026';

select ok(
	not public.blendcalc_api_v1_source_attribution_is_complete(
		'api-attribution-fixture',
		'api-attribution-2026:101'
	),
	'a dataset without an import date fails closed'
);

select ok(
	not has_function_privilege(
		'authenticated',
		'public.blendcalc_api_v1_source_attribution_is_complete(text,text)',
		'EXECUTE'
	),
	'browser clients cannot invoke the internal attribution gate'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.blendcalc_api_v1_source_attribution_is_complete(text,text)',
		'EXECUTE'
	),
	'anonymous clients cannot invoke the internal attribution gate'
);

select ok(
	has_function_privilege(
		'service_role',
		'public.blendcalc_api_v1_source_attribution_is_complete(text,text)',
		'EXECUTE'
	),
	'the trusted server can invoke the attribution gate'
);

select * from finish();

rollback;
