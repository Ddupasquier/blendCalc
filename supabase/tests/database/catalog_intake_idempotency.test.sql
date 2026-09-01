begin;

select plan(13);

insert into auth.users (id, aud, role, email)
values (
	'10000000-0000-4000-8000-000000000003',
	'authenticated',
	'authenticated',
	'api-write-003@example.com'
);

select has_table(
	'public',
	'catalog_intake_requests',
	'catalog intake has one durable idempotency ledger'
);

select ok(
	not has_table_privilege('authenticated', 'public.catalog_intake_requests', 'select')
		and not has_table_privilege('authenticated', 'public.catalog_intake_requests', 'insert')
		and has_table_privilege('service_role', 'public.catalog_intake_requests', 'select')
		and has_table_privilege('service_role', 'public.catalog_intake_requests', 'insert')
		and has_table_privilege('service_role', 'public.catalog_intake_requests', 'update'),
	'the ledger is service-only'
);

create temporary table first_acquisition as
select * from public.begin_catalog_intake_request(
	'10000000-0000-4000-8000-000000000003',
	'write-003-request-1',
	repeat('a', 64)
);

select is(
	(select outcome from first_acquisition),
	'acquired',
	'the first request acquires the key'
);

select is(
	(
		select outcome
		from public.begin_catalog_intake_request(
			'10000000-0000-4000-8000-000000000003',
			'write-003-request-1',
			repeat('a', 64)
		)
	),
	'in_progress',
	'a concurrent retry cannot execute the intake again'
);

select is(
	(
		select outcome
		from public.begin_catalog_intake_request(
			'10000000-0000-4000-8000-000000000003',
			'write-003-request-1',
			repeat('b', 64)
		)
	),
	'conflict',
	'a key cannot be reused for a different payload'
);

select is(
	public.complete_catalog_intake_request(
		(select request_id from first_acquisition),
		'10000000-0000-4000-8000-000000000003',
		repeat('a', 64),
		'succeeded',
		201,
		'{"status":"pending","submissionId":"submission-1"}'::jsonb
	),
	true,
	'the owner can finalize the acquired key once'
);

select is(
	(
		select outcome
		from public.begin_catalog_intake_request(
			'10000000-0000-4000-8000-000000000003',
			'write-003-request-1',
			repeat('a', 64)
		)
	),
	'replay',
	'a completed retry replays instead of executing'
);

select is(
	(
		select response_status
		from public.begin_catalog_intake_request(
			'10000000-0000-4000-8000-000000000003',
			'write-003-request-1',
			repeat('a', 64)
		)
	),
	201,
	'the replay preserves the original response status'
);

select is(
	(
		select response_body ->> 'submissionId'
		from public.begin_catalog_intake_request(
			'10000000-0000-4000-8000-000000000003',
			'write-003-request-1',
			repeat('a', 64)
		)
	),
	'submission-1',
	'the replay preserves the safe terminal response'
);

select is(
	public.complete_catalog_intake_request(
		(select request_id from first_acquisition),
		'10000000-0000-4000-8000-000000000003',
		repeat('a', 64),
		'succeeded',
		201,
		'{"status":"duplicate"}'::jsonb
	),
	false,
	'a terminal request cannot be completed twice'
);

select is(
	(
		select count(*)::integer
		from public.catalog_intake_requests
		where actor_user_id = '10000000-0000-4000-8000-000000000003'
			and idempotency_key = 'write-003-request-1'
	),
	1,
	'retries retain exactly one ledger row'
);

select throws_ok(
	$$
		select * from public.begin_catalog_intake_request(
			'10000000-0000-4000-8000-000000000003',
			'contains whitespace',
			repeat('c', 64)
		)
	$$,
	23514,
	null,
	'invalid idempotency keys fail closed'
);

select throws_ok(
	$$
		select * from public.begin_catalog_intake_request(
			'10000000-0000-4000-8000-000000000003',
			'write-003-request-2',
			'not-a-sha256'
		)
	$$,
	23514,
	null,
	'invalid request fingerprints fail closed'
);

select * from finish();

rollback;
