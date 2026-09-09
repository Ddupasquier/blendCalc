begin;

select plan(12);

select has_column(
	'blendcalc_api',
	'api_request_observations',
	'database_failed',
	'database failures are recorded explicitly'
);
select has_function(
	'blendcalc_api',
	'record_api_request_observation_v2',
	array['text', 'text', 'integer', 'double precision', 'double precision', 'integer', 'boolean', 'boolean', 'boolean'],
	'the additive request-observation function exists'
);
select has_view(
	'blendcalc_api',
	'api_shadow_parity_alert_dashboard',
	'the recent parity alert view exists'
);
select has_view(
	'blendcalc_api',
	'api_key_usage_operations_dashboard',
	'the aggregate API-key alert view exists'
);

select lives_ok(
	$$select blendcalc_api.record_api_request_observation_v2(
		'product', 'isolated', 503, 25, 12, 0, false, false, true
	)$$,
	'a failed database read can be recorded without request details'
);
select is(
	(
		select database_failure_count
		from blendcalc_api.api_request_operations_dashboard
		where window_name = '15 minutes'
			and operation = 'product'
			and read_mode = 'isolated'
	),
	1::bigint,
	'the recent request window reports database failures'
);

select lives_ok(
	$$select blendcalc_api.record_api_shadow_parity_observation(
		'search', false, repeat('a', 64), 8, repeat('b', 64), 7, null
	)$$,
	'a recent shadow divergence can be recorded'
);
select is(
	(
		select failure_count
		from blendcalc_api.api_shadow_parity_alert_dashboard
		where window_name = '15 minutes' and operation = 'search'
	),
	1::bigint,
	'the recent parity alert view reports divergence'
);

select lives_ok(
	$$select blendcalc_api.record_safe_request_log(
		'10000000-0000-4000-8000-000000000001',
		'/api/v1/products/{barcode}',
		'GET',
		429,
		15,
		'api-key',
		repeat('c', 64),
		'denied'
	)$$,
	'an API-key denial can be recorded without retaining the key'
);
select is(
	(
		select max_requests_per_key
		from blendcalc_api.api_key_usage_operations_dashboard
		where window_name = '15 minutes'
	),
	1::bigint,
	'the key-usage view reports a bounded per-key maximum'
);
select is(
	(
		select max_denied_per_key
		from blendcalc_api.api_key_usage_operations_dashboard
		where window_name = '15 minutes'
	),
	1::bigint,
	'the key-usage view reports a bounded per-key denial maximum'
);
select ok(
	not has_table_privilege('anon', 'blendcalc_api.api_key_usage_operations_dashboard', 'select')
		and has_table_privilege('service_role', 'blendcalc_api.api_key_usage_operations_dashboard', 'select'),
	'only the service role can read key-usage aggregates'
);

select * from finish();

rollback;
