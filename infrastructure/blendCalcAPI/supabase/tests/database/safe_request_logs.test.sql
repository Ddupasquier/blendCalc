begin;

select plan(24);

select has_table('blendcalc_api', 'safe_request_logs', 'safe API request logs are durable');
select has_function(
	'blendcalc_api',
	'record_safe_request_log',
	array['uuid', 'text', 'text', 'integer', 'double precision', 'text', 'text', 'text'],
	'the trusted server has one bounded request-log writer'
);
select has_column('blendcalc_api', 'safe_request_logs', 'request_id', 'request IDs are retained');
select has_column('blendcalc_api', 'safe_request_logs', 'endpoint', 'normalized endpoints are retained');
select has_column('blendcalc_api', 'safe_request_logs', 'response_status', 'response status is retained');
select has_column('blendcalc_api', 'safe_request_logs', 'duration_ms', 'request duration is retained');
select has_column('blendcalc_api', 'safe_request_logs', 'actor_hash', 'pseudonymous actor identity is retained');
select has_column('blendcalc_api', 'safe_request_logs', 'rate_limit_result', 'rate-limit outcome is retained');
select hasnt_column('blendcalc_api', 'safe_request_logs', 'url', 'raw URLs are not stored');
select hasnt_column('blendcalc_api', 'safe_request_logs', 'query', 'query values are not stored');
select hasnt_column('blendcalc_api', 'safe_request_logs', 'headers', 'request headers are not stored');
select hasnt_column('blendcalc_api', 'safe_request_logs', 'body', 'request bodies are not stored');
select hasnt_column('blendcalc_api', 'safe_request_logs', 'ip_address', 'IP addresses are not stored');
select hasnt_column('blendcalc_api', 'safe_request_logs', 'actor_id', 'raw actor identifiers are not stored');

select ok(
	not has_schema_privilege('anon', 'blendcalc_api', 'usage')
		and not has_schema_privilege('authenticated', 'blendcalc_api', 'usage')
		and not has_table_privilege('anon', 'blendcalc_api.safe_request_logs', 'select')
		and not has_table_privilege('authenticated', 'blendcalc_api.safe_request_logs', 'select'),
	'browser roles cannot read request logs'
);

select ok(
	has_table_privilege('service_role', 'blendcalc_api.safe_request_logs', 'select')
		and has_function_privilege(
			'service_role',
			'blendcalc_api.record_safe_request_log(uuid,text,text,integer,double precision,text,text,text)',
			'execute'
		),
	'the service role can read and write request logs'
);

select lives_ok(
	$$select blendcalc_api.record_safe_request_log(
		'00000000-0000-0000-0000-000000000101',
		'/api/v1/products/{barcode}',
		'GET',
		200,
		12.5,
		'authenticated-user',
		repeat('a', 64),
		'allowed'
	)$$,
	'a valid pseudonymous request log is accepted'
);

select is(
	(select count(*)::integer from blendcalc_api.safe_request_logs),
	1,
	'one request is stored'
);

select is(
	(select actor_hash from blendcalc_api.safe_request_logs limit 1),
	repeat('a', 64),
	'only the supplied pseudonymous actor hash is retained'
);

select lives_ok(
	$$select blendcalc_api.record_safe_request_log(
		'00000000-0000-0000-0000-000000000101',
		'/api/v1/products/{barcode}',
		'GET',
		200,
		12.5,
		'authenticated-user',
		repeat('a', 64),
		'allowed'
	)$$,
	'retrying the same request ID is idempotent'
);

select is(
	(select count(*)::integer from blendcalc_api.safe_request_logs),
	1,
	'an idempotent retry does not duplicate the request'
);

select throws_ok(
	$$select blendcalc_api.record_safe_request_log(
		'00000000-0000-0000-0000-000000000102',
		'/api/v1/products/00000000000001',
		'GET',
		200,
		5,
		'anonymous',
		null,
		'allowed'
	)$$,
	23514,
	null,
	'a raw product path cannot enter the log'
);

select lives_ok(
	$$select blendcalc_api.record_safe_request_log(
		'00000000-0000-0000-0000-000000000103',
		'/api/v1/{unknown}',
		'POST',
		405,
		4,
		'anonymous',
		null,
		'not-evaluated'
	)$$,
	'an anonymous unsupported request retains no actor identity'
);

select is(
	(
		select actor_hash
		from blendcalc_api.safe_request_logs
		where request_id = '00000000-0000-0000-0000-000000000103'
	),
	null,
	'anonymous request logs have no actor hash'
);

select * from finish();

rollback;
