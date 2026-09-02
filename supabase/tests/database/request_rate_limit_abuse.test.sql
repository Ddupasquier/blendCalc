begin;

select plan(9);

create temporary table abuse_rate_limit_results (
	step integer primary key,
	allowed boolean not null,
	remaining integer not null,
	retry_after_seconds integer not null
);

insert into abuse_rate_limit_results
select 1, result.*
from public.consume_request_rate_limit(
	'api-sec-008:retry-storm',
	repeat('a', 64),
	2,
	60
) result;

insert into abuse_rate_limit_results
select 2, result.*
from public.consume_request_rate_limit(
	'api-sec-008:retry-storm',
	repeat('a', 64),
	2,
	60
) result;

insert into abuse_rate_limit_results
select 3, result.*
from public.consume_request_rate_limit(
	'api-sec-008:retry-storm',
	repeat('a', 64),
	2,
	60
) result;

select is(
	(select allowed from abuse_rate_limit_results where step = 1),
	true,
	'the first request in a retry-storm window is allowed'
);
select is(
	(select remaining from abuse_rate_limit_results where step = 1),
	1,
	'the first request reports the remaining quota'
);
select is(
	(select allowed from abuse_rate_limit_results where step = 2),
	true,
	'the final request inside the quota remains allowed'
);
select is(
	(select remaining from abuse_rate_limit_results where step = 2),
	0,
	'the final allowed request exhausts the quota'
);
select is(
	(select allowed from abuse_rate_limit_results where step = 3),
	false,
	'a retry storm is denied after the quota is exhausted'
);
select cmp_ok(
	(select retry_after_seconds from abuse_rate_limit_results where step = 3),
	'>=',
	1,
	'a denied retry storm receives a positive retry delay'
);

insert into abuse_rate_limit_results
select 4, result.*
from public.consume_request_rate_limits(
	jsonb_build_array(
		jsonb_build_object(
			'scope', 'api-sec-008:retry-storm',
			'subject_hash', repeat('a', 64),
			'limit', 2,
			'window_seconds', 60
		),
		jsonb_build_object(
			'scope', 'api-sec-008:sustained',
			'subject_hash', repeat('b', 64),
			'limit', 10,
			'window_seconds', 600
		)
	)
) result;

select is(
	(select allowed from abuse_rate_limit_results where step = 4),
	false,
	'any exhausted identity layer denies the complete request'
);
select is(
	(select remaining from abuse_rate_limit_results where step = 4),
	0,
	'layered rate limiting reports the most restrictive remaining quota'
);
select is(
	(
		select request_count
		from public.request_rate_limits
		where scope = 'api-sec-008:sustained'
			and subject_hash = repeat('b', 64)
	),
	1::bigint,
	'every applicable layer is consumed during the atomic decision'
);

select * from finish();

rollback;
