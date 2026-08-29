begin;

select plan(4);

select hasnt_function(
	'public',
	'record_product_source_daily_metric',
	array[
		'text', 'text', 'text', 'text',
		'bigint', 'bigint', 'bigint', 'bigint',
		'bigint', 'bigint', 'bigint', 'bigint',
		'bigint', 'bigint', 'bigint', 'bigint',
		'bigint', 'bigint', 'bigint', 'bigint'
	],
	'the superseded source-metric recorder is removed'
);

select has_function(
	'public',
	'record_product_source_daily_metric',
	array[
		'text', 'text', 'text', 'text',
		'bigint', 'bigint', 'bigint', 'bigint',
		'bigint', 'bigint', 'bigint', 'bigint',
		'bigint', 'bigint', 'bigint', 'bigint',
		'bigint', 'bigint', 'bigint', 'bigint',
		'bigint', 'bigint', 'bigint'
	],
	'the cache-aware source-metric recorder remains available'
);

select is(
	(
		select count(*)::integer
		from pg_proc procedure
		join pg_namespace namespace on namespace.oid = procedure.pronamespace
		where namespace.nspname = 'public'
			and procedure.proname = 'record_product_source_daily_metric'
	),
	1,
	'exactly one source-metric recorder signature remains'
);

select ok(
	has_function_privilege(
		'service_role',
		'public.record_product_source_daily_metric(text,text,text,text,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint)',
		'EXECUTE'
	)
		and not has_function_privilege(
			'authenticated',
			'public.record_product_source_daily_metric(text,text,text,text,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint,bigint)',
			'EXECUTE'
		),
	'the canonical recorder remains service-role-only'
);

select * from finish();

rollback;
