begin;

select plan(18);

select has_table('blendcalc_api', 'api_request_observations', 'request observations are durable');
select has_table('blendcalc_api', 'api_shadow_parity_observations', 'shadow parity observations are durable');
select has_table('blendcalc_api', 'publication_sync_runs', 'publication sync runs are durable');
select has_view('blendcalc_api', 'api_request_operations_dashboard', 'request dashboard exists');
select has_view('blendcalc_api', 'api_shadow_parity_dashboard', 'parity dashboard exists');
select has_view('blendcalc_api', 'publication_operations_dashboard', 'publication dashboard exists');

select ok(
	not has_table_privilege('anon', 'blendcalc_api.api_request_observations', 'select')
		and not has_table_privilege('authenticated', 'blendcalc_api.api_request_observations', 'select'),
	'browser roles cannot read operational observations'
);

select ok(
	has_table_privilege('service_role', 'blendcalc_api.api_request_observations', 'select')
		and has_table_privilege('service_role', 'blendcalc_api.publication_sync_runs', 'insert'),
	'the trusted server role can maintain operational data'
);

select is(
	(
		select count(*)::integer
		from pg_class table_contract
		join pg_namespace schema_contract on schema_contract.oid = table_contract.relnamespace
		where schema_contract.nspname = 'blendcalc_api'
			and table_contract.relname in (
				'api_request_observations',
				'api_shadow_parity_observations',
				'publication_sync_runs'
			)
			and table_contract.relrowsecurity
			and table_contract.relforcerowsecurity
	),
	3,
	'every operational table forces row level security'
);

select lives_ok(
	$$select blendcalc_api.record_api_request_observation(
		'search', 'isolated', 200, 25, 9, 4, true, false
	)$$,
	'a privacy-safe request observation can be recorded'
);

select lives_ok(
	$$select blendcalc_api.record_api_request_observation(
		'search', 'isolated', 304, 12, 4, 4, true, true
	)$$,
	'a cache validation hit can be recorded'
);

select is(
	(select request_count from blendcalc_api.api_request_operations_dashboard where window_name = '24 hours' and operation = 'search' and read_mode = 'isolated'),
	2::bigint,
	'the request dashboard reports request volume'
);

select is(
	(select cache_effectiveness from blendcalc_api.api_request_operations_dashboard where window_name = '24 hours' and operation = 'search' and read_mode = 'isolated'),
	0.5000::numeric,
	'the request dashboard reports cache effectiveness'
);

select lives_ok(
	$$select blendcalc_api.record_api_shadow_parity_observation(
		'product', false, repeat('a', 64), 8, repeat('b', 64), 6, null
	)$$,
	'a parity mismatch can be recorded without request identifiers'
);

select is(
	(select failure_count from blendcalc_api.api_shadow_parity_dashboard where operation = 'product'),
	1::bigint,
	'the parity dashboard reports failures'
);

select throws_ok(
	$$select blendcalc_api.record_api_request_observation(
		'search', 'isolated', 304, 12, 4, 4, false, true
	)$$,
	'23514',
	null,
	'an impossible cache observation is rejected'
);

select col_is_null(
	'blendcalc_api',
	'api_request_observations',
	'database_duration_ms',
	'database timing may remain unknown when a request never reaches the database'
);

select col_is_null(
	'blendcalc_api',
	'publication_generations',
	'target_catalog_hash',
	'legacy generations can remain explicitly unverified until the next parity run'
);

select * from finish();

rollback;
