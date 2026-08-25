begin;

select plan(11);

select is(
	(
		select count(*)::integer
		from public.product_resolution_policy_versions
		where enabled and is_default
	),
	1,
	'exactly one reviewed product resolution policy is active by default'
);

select results_eq(
	$$
		select
			minimum_related_name_token_overlap,
			numeric_difference_ratio_floor,
			serving_weight_tolerance_grams,
			category_suggestion_minimum_score
		from public.product_resolution_policy_versions
		where key = 'exact-barcode-resolution-v1'
	$$,
	$$ values (0.2::numeric, 0.001::numeric, 0.1::numeric, 70::numeric) $$,
	'the reviewed identity, ratio, serving, and category boundaries are explicit'
);

select is(
	(
		select count(*)::integer
		from public.product_resolution_rank_values
		where policy_key = 'exact-barcode-resolution-v1'
	),
	10,
	'field-confidence and USDA subtype ranks are complete'
);

select is(
	(
		select count(*)::integer
		from public.product_resolution_difference_thresholds
		where policy_key = 'exact-barcode-resolution-v1'
	),
	6,
	'both comparison contexts retain low, medium, and high thresholds'
);

select ok(
	not exists (
		select 1
		from public.nutrition_completeness_profiles
		where assessment_policy_key <> 'exact-barcode-resolution-v1'
			or exact_source_score < mapped_source_score
			or mapped_source_score < derived_source_score
			or derived_source_score < missing_source_score
	),
	'nutrition completeness profiles use the reviewed scoring policy'
);

select is(
	(
		select count(*)::integer
		from public.product_source_field_coverage_policies
		where policy_key = 'exact-barcode-resolution-v1'
	),
	3,
	'each live barcode provider has an expiring field-coverage policy'
);

select ok(
	has_table_privilege('service_role', 'public.product_resolution_policy_versions', 'select')
		and has_table_privilege('service_role', 'public.product_source_field_coverage', 'insert')
		and has_table_privilege('service_role', 'public.product_source_field_coverage', 'update'),
	'the trusted server can read policy and maintain source coverage'
);

select ok(
	not has_table_privilege('authenticated', 'public.product_resolution_policy_versions', 'select')
		and not has_table_privilege('authenticated', 'public.product_source_field_coverage', 'select')
		and not has_table_privilege('anon', 'public.product_source_field_coverage', 'select'),
	'browser roles cannot read policy internals or provider lookup coverage'
);

select throws_ok(
	$$
		update public.nutrition_completeness_profiles
		set mapped_source_score = exact_source_score + 1
		where key = 'generic-core-v1'
	$$,
	'23514',
	null,
	'nutrition completeness score ordering cannot become internally inconsistent'
);

select throws_ok(
	$$
		insert into public.product_source_field_coverage (
			barcode,
			provider_key,
			field_path,
			coverage_status,
			policy_key,
			checked_at,
			expires_at
		)
		values (
			'00012345678905',
			'usda',
			'brandOwner',
			'product-not-found',
			'exact-barcode-resolution-v1',
			now(),
			now() + interval '1 day'
		)
	$$,
	'23514',
	null,
	'product-not-found coverage can only describe product identity'
);

select throws_ok(
	$$
		insert into public.product_source_field_coverage (
			barcode,
			provider_key,
			field_path,
			coverage_status,
			policy_key,
			checked_at,
			expires_at
		)
		values (
			'00012345678905',
			'usda',
			'productIdentity',
			'reported',
			'exact-barcode-resolution-v1',
			now(),
			now()
		)
	$$,
	'23514',
	null,
	'source coverage must expire after the provider check'
);

select * from finish();

rollback;
