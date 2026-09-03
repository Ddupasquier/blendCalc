begin;

select plan(13);

select has_table(
	'public',
	'product_api_request_leases',
	'cross-instance provider request leases exist'
);

select has_table(
	'public',
	'external_provider_request_budgets',
	'shared provider request budgets exist'
);

select ok(
	public.claim_product_api_request_lease(
		'open-food-facts',
		repeat('a', 64),
		'10000000-0000-4000-8000-000000000001',
		10000
	),
	'the first app instance claims an exact request lease'
);

select is(
	public.claim_product_api_request_lease(
		'open-food-facts',
		repeat('a', 64),
		'10000000-0000-4000-8000-000000000002',
		10000
	),
	false,
	'a second app instance cannot duplicate the leased request'
);

select lives_ok(
	$$select public.release_product_api_request_lease(
		'open-food-facts',
		repeat('a', 64),
		'10000000-0000-4000-8000-000000000001'
	)$$,
	'the owner can release its request lease'
);

select ok(
	public.claim_product_api_request_lease(
		'open-food-facts',
		repeat('a', 64),
		'10000000-0000-4000-8000-000000000002',
		10000
	),
	'another instance can claim a released request'
);

select is(
	(public.claim_external_provider_request_budget('open-food-facts', 2, 60000) ->> 'allowed')::boolean,
	true,
	'the first request is inside the shared provider budget'
);

select is(
	(public.claim_external_provider_request_budget('open-food-facts', 2, 60000) ->> 'allowed')::boolean,
	true,
	'the second request is inside the shared provider budget'
);

select is(
	(public.claim_external_provider_request_budget('open-food-facts', 2, 60000) ->> 'allowed')::boolean,
	false,
	'the shared provider budget stops another outbound request'
);

select ok(
	(public.claim_external_provider_request_budget('open-food-facts', 2, 60000) ->> 'retryAfterMilliseconds')::integer > 0,
	'a denied request receives a bounded retry time instead of retrying immediately'
);

select ok(
	not has_table_privilege('authenticated', 'public.product_api_request_leases', 'select')
		and not has_table_privilege('authenticated', 'public.product_api_request_leases', 'insert')
		and not has_table_privilege('authenticated', 'public.product_api_request_leases', 'update'),
	'ordinary application clients cannot inspect or claim request leases'
);

select ok(
	not has_table_privilege('authenticated', 'public.external_provider_request_budgets', 'select')
		and not has_table_privilege('authenticated', 'public.external_provider_request_budgets', 'insert')
		and not has_table_privilege('authenticated', 'public.external_provider_request_budgets', 'update'),
	'ordinary application clients cannot inspect or alter provider budgets'
);

select ok(
	has_function_privilege(
		'service_role',
		'public.claim_external_provider_request_budget(text,integer,integer)',
		'execute'
	),
	'the trusted server role can claim provider budget slots'
);

select * from finish();

rollback;
