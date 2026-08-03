begin;

select plan(12);

select has_table(
	'public',
	'blendcalc_api_publication_profiles',
	'API publication profiles are stored in the database'
);

select is(
	(
		select count(*)::integer
		from public.blendcalc_api_publication_profiles profile
		where profile.api_major = 1
			and profile.resource_scope = 'packaged-product'
			and profile.enabled
			and profile.is_default
	),
	1,
	'API v1 has exactly one enabled default packaged-product profile'
);

select is(
	(
		select profile.nutrition_profile_key
		from public.blendcalc_api_publication_profiles profile
		where profile.key = 'api-v1-packaged-product-v1'
	),
	'api-v1-packaged-core-v1',
	'the API publication profile references its nutrition profile'
);

select is(
	(
		select count(*)::integer
		from public.nutrition_completeness_profile_nutrients requirement
		where requirement.profile_key = 'api-v1-packaged-core-v1'
			and requirement.requirement_level = 'required'
	),
	8,
	'the API packaged-food profile has eight required core nutrients'
);

select ok(
	(
		select 'reported-zero' = any(profile.accepted_nutrient_value_statuses)
		from public.blendcalc_api_publication_profiles profile
		where profile.key = 'api-v1-packaged-product-v1'
	),
	'a source-reported zero is an accepted explicit value state'
);

select ok(
	(
		select not ('missing' = any(profile.accepted_nutrient_value_statuses))
		from public.blendcalc_api_publication_profiles profile
		where profile.key = 'api-v1-packaged-product-v1'
	),
	'missing is never accepted as a numeric nutrient value'
);

select ok(
	(
		select profile.require_canonical_nutrient_mapping
		from public.blendcalc_api_publication_profiles profile
		where profile.key = 'api-v1-packaged-product-v1'
	),
	'canonical nutrient mapping evidence is required'
);

select ok(
	(
		select 'medium' = any(profile.blocked_conflict_severities)
			and 'high' = any(profile.blocked_conflict_severities)
		from public.blendcalc_api_publication_profiles profile
		where profile.key = 'api-v1-packaged-product-v1'
	),
	'medium and high unresolved conflicts block publication'
);

select has_function(
	'public',
	'blendcalc_api_v1_product_readiness_reasons',
	array['uuid'],
	'the profile-backed publication-readiness function exists'
);

select has_column(
	'public',
	'blendcalc_api_v1_product_readiness',
	'publication_status',
	'the readiness view exposes a bounded publication status'
);

select has_column(
	'public',
	'blendcalc_api_v1_product_readiness',
	'quality_dimensions',
	'the readiness view exposes transparent quality dimensions'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.blendcalc_api_publication_profiles',
		'select'
	),
	'publication policy internals are not client-readable'
);

select * from finish();

rollback;
