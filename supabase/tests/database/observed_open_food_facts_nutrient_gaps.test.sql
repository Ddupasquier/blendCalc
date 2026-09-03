begin;

select plan(9);

select has_table(
	'public',
	'nutrient_source_mapping_observations',
	'trusted provider nutrient observations have a private table'
);

insert into public.product_api_cache (
	provider,
	cache_key,
	request_kind,
	status_code,
	response,
	fetched_at,
	expires_at
)
values (
	'open-food-facts',
	repeat('a', 64),
	'barcode-product',
	200,
	jsonb_build_object(
		'product', jsonb_build_object(
			'code', 'private-test-code-must-not-be-retained',
			'product_name', 'Private test product must not be retained',
			'nutriments', jsonb_build_object(
				'calcium_100g', 12,
				'calcium_unit', 'mg',
				'future-nutrient_serving', '2.5',
				'future-nutrient_unit', 'µg',
				'nutrition-score-fr_100g', 3,
				'nutrition-score-fr_unit', 'points'
			)
		)
	),
	'2026-09-02T12:00:00Z',
	'2026-09-09T12:00:00Z'
);

select is(
	(
		select observation_count
		from public.nutrient_source_mapping_observations
		where source_key = 'open-food-facts'
			and source_nutrient_key = 'future-nutrient'
			and source_unit_name = 'UG'
	),
	1::bigint,
	'a newly cached exact nutrient identity is counted once'
);

select is(
	(
		select first_observed_at
		from public.nutrient_source_mapping_observations
		where source_key = 'open-food-facts'
			and source_nutrient_key = 'future-nutrient'
	),
	'2026-09-02T12:00:00Z'::timestamptz,
	'the first trusted cache observation time is retained'
);

select is(
	(
		select count(*)
		from public.nutrient_source_mapping_observations
		where source_key = 'open-food-facts'
			and (source_nutrient_key, source_unit_name) in (
				('calcium', 'MG'),
				('future-nutrient', 'UG')
			)
	),
	2::bigint,
	'provider scores and other non-nutrient metadata are excluded'
);

update public.product_api_cache
set fetched_at = '2026-09-09T12:00:00Z',
	expires_at = '2026-09-16T12:00:00Z'
where provider = 'open-food-facts'
	and cache_key = repeat('a', 64);

select is(
	(
		select observation_count
		from public.nutrient_source_mapping_observations
		where source_key = 'open-food-facts'
			and source_nutrient_key = 'future-nutrient'
	),
	2::bigint,
	'a later provider cache refresh increases the anonymous count'
);

select is(
	(
		select last_observed_at
		from public.nutrient_source_mapping_observations
		where source_key = 'open-food-facts'
			and source_nutrient_key = 'future-nutrient'
	),
	'2026-09-09T12:00:00Z'::timestamptz,
	'the latest trusted cache observation time advances'
);

select ok(
	not exists (
		select 1
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'nutrient_source_mapping_observations'
			and column_name in ('user_id', 'barcode', 'product_name', 'amount', 'raw_payload')
	),
	'the observation table cannot retain user, product, amount, or raw payload details'
);

select ok(
	not has_table_privilege('authenticated', 'public.nutrient_source_mapping_observations', 'select')
		and not has_table_privilege('authenticated', 'public.nutrient_source_mapping_observations', 'insert')
		and not has_table_privilege('authenticated', 'public.nutrient_source_mapping_observations', 'update'),
	'ordinary application clients cannot read or write provider observations'
);

select ok(
	has_table_privilege('service_role', 'public.nutrient_source_mapping_observations', 'select')
		and has_table_privilege('service_role', 'public.nutrient_source_mapping_observations', 'insert')
		and has_table_privilege('service_role', 'public.nutrient_source_mapping_observations', 'update'),
	'only the trusted server role can operate on provider observations'
);

select * from finish();

rollback;
