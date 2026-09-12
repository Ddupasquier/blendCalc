begin;

select plan(19);

select has_table(
	'public',
	'privileged_queue_admission_decisions',
	'queue admission stores immutable system receipts'
);
select has_function(
	'public',
	'apply_catalog_queue_admission',
	array['integer'],
	'catalog queue admission has one bounded service boundary'
);
select has_function(
	'public',
	'resolve_catalog_submission_queue_admission',
	array['uuid', 'text', 'jsonb'],
	'catalog submission admission has one guarded resolution boundary'
);
select ok(
	has_function_privilege(
		'service_role',
		'public.apply_catalog_queue_admission(integer)',
		'execute'
	),
	'the service role can run catalog admission'
);
select ok(
	not has_function_privilege(
		'authenticated',
		'public.apply_catalog_queue_admission(integer)',
		'execute'
	),
	'browser sessions cannot run system admission directly'
);

insert into auth.users (id, aud, role, email)
values (
	'99950000-0000-4000-8000-000000000001',
	'authenticated',
	'authenticated',
	'queue-admission@blendcalc.local'
);

insert into public.shared_product_observations (
	id, barcode, source, source_reference, source_license,
	raw_payload, normalized_food, content_hash, observed_at
)
select
	'99950000-0000-4000-8000-000000000010',
	product.barcode,
	'open-food-facts',
	product.barcode,
	'ODbL-1.0',
	'{}'::jsonb,
	jsonb_build_object('productName', upper(product.product_name)),
	repeat('a', 64),
	'2026-09-11T20:00:00Z'
from public.shared_products product
where product.id = '81000000-0000-4000-8000-000000000001';

insert into public.catalog_provider_product_snapshots (
	id, shared_product_id, provider_key, source_reference, observation_id,
	content_hash, normalized_snapshot, observed_at
)
select
	'99950000-0000-4000-8000-000000000011',
	product.id,
	'open-food-facts',
	product.barcode,
	'99950000-0000-4000-8000-000000000010',
	repeat('b', 64),
	jsonb_build_object('productName', upper(product.product_name)),
	'2026-09-11T20:00:00Z'
from public.shared_products product
where product.id = '81000000-0000-4000-8000-000000000001';

insert into public.catalog_provider_change_reviews (
	id, shared_product_id, provider_key, snapshot_id,
	change_summary, material_field_paths, created_at
)
select
	'99950000-0000-4000-8000-000000000012',
	product.id,
	'open-food-facts',
	'99950000-0000-4000-8000-000000000011',
	jsonb_build_object('changes', jsonb_build_array(jsonb_build_object(
		'field', 'productName',
		'label', 'Product name',
		'severity', 'high',
		'previousValue', lower(product.product_name),
		'observedValue', upper(product.product_name)
	))),
	array['productName'],
	'2026-09-11T20:01:00Z'
from public.shared_products product
where product.id = '81000000-0000-4000-8000-000000000001';

insert into public.shared_product_conflicts (
	id, shared_product_id, barcode, field_path, observed_values, severity, created_at
)
select
	'99950000-0000-4000-8000-000000000013',
	product.id,
	product.barcode,
	'productName',
	jsonb_build_array(
		jsonb_build_object('snapshotId', '99950000-0000-4000-8000-000000000009', 'value', lower(product.product_name)),
		jsonb_build_object('snapshotId', '99950000-0000-4000-8000-000000000011', 'value', upper(product.product_name))
	),
	'high',
	'2026-09-11T20:01:00Z'
from public.shared_products product
where product.id = '81000000-0000-4000-8000-000000000001';

select is(
	(select count(*) from public.catalog_actionable_provider_change_reviews where id = '99950000-0000-4000-8000-000000000012'),
	1::bigint,
	'the provider change is the single actionable owner before admission'
);
select is(
	(select count(*) from public.catalog_actionable_product_conflicts where id = '99950000-0000-4000-8000-000000000013'),
	0::bigint,
	'the provider-derived conflict is not duplicated as separate work'
);

set local role service_role;
select set_config(
	'request.jwt.claims',
	'{"role":"service_role"}',
	true
);
select lives_ok(
	$$select public.apply_catalog_queue_admission(100)$$,
	'service admission evaluates the current provider evidence'
);
reset role;

select is(
	(select status from public.catalog_provider_change_reviews where id = '99950000-0000-4000-8000-000000000012'),
	'superseded',
	'an already-reflected provider change leaves the queue'
);
select is(
	(select status from public.shared_product_conflicts where id = '99950000-0000-4000-8000-000000000013'),
	'superseded',
	'its derived conflict closes in the same admission transaction'
);
select is(
	(select reason_code from public.privileged_queue_admission_decisions where subject_key = '99950000-0000-4000-8000-000000000012'),
	'already_reflected_in_catalog',
	'the exact provider outcome has a reasoned receipt'
);

insert into public.shared_product_conflicts (
	id, shared_product_id, barcode, field_path, observed_values, severity
)
select
	'99950000-0000-4000-8000-000000000014',
	product.id,
	product.barcode,
	'brandOwner',
	'[{"value":"TEST BRAND"},{"value":"test-brand"}]'::jsonb,
	'high'
from public.shared_products product
where product.id = '81000000-0000-4000-8000-000000000001';

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.apply_catalog_queue_admission(100);
reset role;

select is(
	(select status from public.shared_product_conflicts where id = '99950000-0000-4000-8000-000000000014'),
	'resolved',
	'case and punctuation-only identity conflicts resolve automatically'
);
select is(
	(select reason_code from public.privileged_queue_admission_decisions where subject_key = '99950000-0000-4000-8000-000000000014'),
	'normalized_values_equivalent',
	'the normalized conflict decision is auditable'
);

insert into public.shared_product_submissions (
	id, submitted_by, barcode, product_name, brand_owner, food,
	consent_to_share, status, verification_status, validation_report,
	evidence_paths, evidence_complete, category_option_id,
	submission_kind, submission_intent, change_summary
)
select
	'99950000-0000-4000-8000-000000000020',
	'99950000-0000-4000-8000-000000000001',
	product.barcode,
	product.product_name,
	product.brand_owner,
	product.food,
	true,
	'pending',
	'exact_identity',
	'{}'::jsonb,
	'{}'::jsonb,
	true,
	(select id from public.custom_food_category_options where enabled order by id limit 1),
	'new_product',
	'catalog_share',
	'{}'::jsonb
from public.shared_products product
where product.id = '81000000-0000-4000-8000-000000000001';

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select ok(
	public.resolve_catalog_submission_queue_admission(
		'99950000-0000-4000-8000-000000000020',
		'exact_current_catalog_match',
		jsonb_build_object(
			'sharedProductId', '81000000-0000-4000-8000-000000000001',
			'latestRevisionId', (
				select revision.id
				from public.shared_product_revisions revision
				where revision.shared_product_id = '81000000-0000-4000-8000-000000000001'
				order by revision.revision_number desc
				limit 1
			)
		)
	),
	'an exact current-catalog submission can close without human review'
);
reset role;

select is(
	(select status from public.shared_product_submissions where id = '99950000-0000-4000-8000-000000000020'),
	'auto_declined',
	'the no-op submission uses the non-punitive automatic terminal state'
);
select is(
	(select queue_resolution from public.shared_product_submissions where id = '99950000-0000-4000-8000-000000000020'),
	'already_available',
	'the submitter-facing result distinguishes an accepted no-op from a rejection'
);
select is(
	(select count(*) from public.privileged_queue_admission_decisions where subject_key = '99950000-0000-4000-8000-000000000020'),
	1::bigint,
	'the submission outcome has exactly one immutable receipt'
);
select throws_ok(
	$$update public.privileged_queue_admission_decisions
	set reason_code = 'rewritten'
	where subject_key = '99950000-0000-4000-8000-000000000020'$$,
	'P0001',
	'Privileged queue admission decisions are immutable',
	'admission receipts cannot be rewritten'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"99950000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
	true
);
select throws_ok(
	$$select public.apply_catalog_queue_admission(100)$$,
	'42501',
	'permission denied for function apply_catalog_queue_admission',
	'authenticated sessions cannot invoke admission even with AAL2'
);
reset role;

select finish();
rollback;
