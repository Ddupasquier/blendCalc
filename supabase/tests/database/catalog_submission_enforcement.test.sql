begin;

select plan(13);

select has_table(
	'public',
	'user_catalog_submission_enforcement',
	'catalog submission enforcement has a dedicated current-state table'
);

select columns_are(
	'public',
	'user_catalog_submission_enforcement',
	array[
		'user_id',
		'moderator_rejection_count',
		'sharing_suspended_until',
		'latest_rejected_submission_id',
		'latest_rejected_by',
		'latest_rejected_at',
		'created_at',
		'updated_at'
	],
	'enforcement state exposes only the current count, suspension, and latest review evidence'
);

select trigger_is(
	'public',
	'shared_product_submissions',
	'record_moderator_catalog_submission_rejection',
	'private',
	'record_moderator_catalog_submission_rejection',
	'moderator rejection status changes update enforcement automatically'
);

select ok(
	has_table_privilege('service_role', 'public.user_catalog_submission_enforcement', 'select')
		and has_table_privilege('service_role', 'public.user_catalog_submission_enforcement', 'insert')
		and has_table_privilege('service_role', 'public.user_catalog_submission_enforcement', 'update'),
	'the service role can read and maintain catalog submission enforcement'
);

select ok(
	has_table_privilege('authenticated', 'public.user_catalog_submission_enforcement', 'select')
		and not has_table_privilege('authenticated', 'public.user_catalog_submission_enforcement', 'insert')
		and not has_table_privilege('authenticated', 'public.user_catalog_submission_enforcement', 'update'),
	'ordinary authenticated clients can read but cannot alter enforcement state'
);

insert into auth.users (id, aud, role, email)
values
	(
		'74000000-0000-4000-8000-000000000001',
		'authenticated',
		'authenticated',
		'catalog-enforcement-user@blendcalc.local'
	),
	(
		'74000000-0000-4000-8000-000000000002',
		'authenticated',
		'authenticated',
		'catalog-enforcement-moderator@blendcalc.local'
	);

insert into public.shared_product_submissions (
	submitted_by,
	barcode,
	product_name,
	food,
	consent_to_share
)
select
	'74000000-0000-4000-8000-000000000001',
	'9' || lpad(sequence_number::text, 13, '0'),
	'Catalog Enforcement Fixture ' || sequence_number,
	jsonb_build_object(
		'fdcId', -sequence_number,
		'description', 'Catalog Enforcement Fixture ' || sequence_number,
		'barcode', '9' || lpad(sequence_number::text, 13, '0'),
		'foodNutrients', jsonb_build_array()
	),
	true
from generate_series(1, 52) sequence_number;

with first_fifty as (
	select id
	from public.shared_product_submissions
	where submitted_by = '74000000-0000-4000-8000-000000000001'
	order by barcode
	limit 50
)
update public.shared_product_submissions submission
set
	status = 'rejected',
	reviewed_by = '74000000-0000-4000-8000-000000000002',
	reviewed_at = now(),
	review_note = 'Deterministic rejection boundary fixture.'
from first_fifty
where submission.id = first_fifty.id;

select is(
	(
		select moderator_rejection_count
		from public.user_catalog_submission_enforcement
		where user_id = '74000000-0000-4000-8000-000000000001'
	),
	50,
	'fifty moderator rejections are counted without crossing the suspension threshold'
);

select is(
	(
		select sharing_suspended_until
		from public.user_catalog_submission_enforcement
		where user_id = '74000000-0000-4000-8000-000000000001'
	),
	null,
	'fifty moderator rejections do not suspend public sharing'
);

with fifty_first as (
	select id
	from public.shared_product_submissions
	where submitted_by = '74000000-0000-4000-8000-000000000001'
		and status = 'pending'
	order by barcode
	limit 1
)
update public.shared_product_submissions submission
set
	status = 'rejected',
	reviewed_by = '74000000-0000-4000-8000-000000000002',
	reviewed_at = now(),
	review_note = 'Threshold-crossing rejection fixture.'
from fifty_first
where submission.id = fifty_first.id;

select is(
	(
		select moderator_rejection_count
		from public.user_catalog_submission_enforcement
		where user_id = '74000000-0000-4000-8000-000000000001'
	),
	51,
	'the fifty-first moderator rejection is counted'
);

select ok(
	(
		select sharing_suspended_until > now() + interval '5 months'
			and sharing_suspended_until <= now() + interval '6 months 1 minute'
		from public.user_catalog_submission_enforcement
		where user_id = '74000000-0000-4000-8000-000000000001'
	),
	'the fifty-first moderator rejection starts a six-calendar-month suspension'
);

select is(
	(
		select count(*)::integer
		from public.product_submission_blocks
		where user_id = '74000000-0000-4000-8000-000000000001'
			and rejection_count = 51
	),
	1,
	'threshold crossing appends one immutable block-history event'
);

update public.shared_product_submissions
set status = 'auto_declined'
where submitted_by = '74000000-0000-4000-8000-000000000001'
	and status = 'pending';

select is(
	(
		select moderator_rejection_count
		from public.user_catalog_submission_enforcement
		where user_id = '74000000-0000-4000-8000-000000000001'
	),
	51,
	'automated declines do not increase the moderator rejection count'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"74000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user"}',
	true
);

select is(
	(
		select count(*)::integer
		from public.user_catalog_submission_enforcement
	),
	1,
	'a user can read only their own catalog enforcement state'
);

select throws_ok(
	$$
		update public.user_catalog_submission_enforcement
		set moderator_rejection_count = 0
		where user_id = auth.uid()
	$$,
	'42501',
	'permission denied for table user_catalog_submission_enforcement',
	'a user cannot clear their own rejection count or suspension'
);

select * from finish();

rollback;
