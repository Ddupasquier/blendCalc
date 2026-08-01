begin;

select plan(11);

select has_column(
	'public',
	'food_compatibility_feedback',
	'feedback_type',
	'the compatibility queue distinguishes missing and incorrect warnings'
);

select has_column(
	'public',
	'food_compatibility_feedback',
	'preference_tag_id',
	'missing-warning reports retain the exact reviewed preference tag'
);

select has_column(
	'public',
	'food_compatibility_feedback',
	'observed_label_date',
	'reports can retain when the package was checked'
);

select has_column(
	'public',
	'food_compatibility_feedback',
	'evidence_path',
	'private package-label evidence has a storage reference'
);

select has_column(
	'public',
	'food_compatibility_feedback',
	'evidence_sha256',
	'package-label evidence retains an integrity digest'
);

select has_column(
	'public',
	'food_compatibility_feedback',
	'shared_product_revision_id',
	'reports preserve the current catalog revision when available'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'food_compatibility_feedback_payload_check'
	),
	'incorrect and missing warning payloads have separate structural requirements'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.food_compatibility_feedback',
		'INSERT'
	),
	'authenticated clients cannot bypass the server validation boundary'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.food_compatibility_feedback',
		'UPDATE'
	),
	'users cannot review or mutate compatibility reports directly'
);

select is(
	(
		select relrowsecurity
		from pg_class
		where oid = 'public.food_compatibility_feedback'::regclass
	),
	true,
	'compatibility reports keep row-level security enabled'
);

select is(
	(
		select relforcerowsecurity
		from pg_class
		where oid = 'public.food_compatibility_feedback'::regclass
	),
	true,
	'compatibility reports keep row-level security forced'
);

select * from finish();

rollback;
