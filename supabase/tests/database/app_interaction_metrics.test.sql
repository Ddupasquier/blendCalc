begin;

select plan(8);

select has_table(
	'public',
	'app_interaction_daily_metrics',
	'private daily interaction aggregate table exists'
);

select ok(
	(
		select relrowsecurity
		from pg_class
		where oid = 'public.app_interaction_daily_metrics'::regclass
	),
	'interaction metrics have RLS enabled'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.app_interaction_daily_metrics',
		'SELECT'
	),
	'authenticated users cannot read aggregate interaction metrics directly'
);

select ok(
	not has_function_privilege(
		'authenticated',
		'public.replace_app_interaction_daily_metrics(date, date, jsonb)',
		'EXECUTE'
	),
	'authenticated users cannot replace aggregate interaction metrics'
);

select is(
	public.replace_app_interaction_daily_metrics(
		'2026-07-28',
		'2026-07-29',
		'[
			{
				"metric_date": "2026-07-28",
				"metric_key": "page_view",
				"dimension_key": "all",
				"dimension_value": "all",
				"event_count": 12,
				"visitor_count": 7
			},
			{
				"metric_date": "2026-07-29",
				"metric_key": "auth_login_success",
				"dimension_key": "all",
				"dimension_value": "all",
				"event_count": 2,
				"visitor_count": 2
			}
		]'::jsonb
	),
	2,
	'service replacement records every supplied aggregate'
);

select is(
	(
		select event_count
		from public.app_interaction_daily_metrics
		where metric_date = '2026-07-28'
			and metric_key = 'page_view'
			and dimension_key = 'all'
	),
	12::bigint,
	'page-view count is stored exactly'
);

select is(
	public.replace_app_interaction_daily_metrics(
		'2026-07-28',
		'2026-07-29',
		'[
			{
				"metric_date": "2026-07-29",
				"metric_key": "page_reload",
				"dimension_key": "all",
				"dimension_value": "all",
				"event_count": 1,
				"visitor_count": 1
			}
		]'::jsonb
	),
	1,
	'a repeated synchronization atomically replaces the complete date range'
);

select is(
	(
		select count(*)
		from public.app_interaction_daily_metrics
		where metric_date between '2026-07-28' and '2026-07-29'
	),
	1::bigint,
	'stale rows in the synchronized range are removed'
);

select * from finish();

rollback;
