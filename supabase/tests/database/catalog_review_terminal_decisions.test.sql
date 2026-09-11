begin;

select plan(15);

select ok(
	has_function_privilege(
		'authenticated',
		'public.resolve_catalog_conflict_without_correction(uuid,uuid,text)',
		'execute'
	),
	'authenticated sessions can reach the guarded conflict-resolution workflow'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.resolve_catalog_conflict_without_correction(uuid,uuid,text)',
		'execute'
	),
	'anonymous clients cannot resolve catalog conflicts'
);

insert into auth.users (id, aud, role, email)
values
	('72500000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'catalog-terminal-user@blendcalc.local'),
	('72500000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'catalog-terminal-moderator@blendcalc.local');

insert into public.app_role_assignments (user_id, role)
values ('72500000-0000-4000-8000-000000000002', 'moderator');

insert into public.shared_product_observations (
	id,
	barcode,
	source,
	source_reference,
	source_license,
	raw_payload,
	normalized_food,
	content_hash
)
select
	'72500000-0000-4000-8000-000000000010',
	product.barcode,
	'usda',
	'catalog-terminal-provider-observation',
	'Public domain',
	'{}'::jsonb,
	product.food,
	repeat('d', 64)
from public.shared_products product
where product.id = '84000000-0000-4000-8000-000000000681';

insert into public.catalog_provider_product_snapshots (
	id,
	shared_product_id,
	provider_key,
	source_reference,
	observation_id,
	content_hash,
	normalized_snapshot,
	observed_at
)
select
	'72500000-0000-4000-8000-000000000011',
	product.id,
	'usda',
	'catalog-terminal-provider-snapshot',
	'72500000-0000-4000-8000-000000000010',
	repeat('e', 64),
	product.food,
	now()
from public.shared_products product
where product.id = '84000000-0000-4000-8000-000000000681';

insert into public.catalog_provider_change_reviews (
	id,
	shared_product_id,
	provider_key,
	snapshot_id,
	change_summary,
	material_field_paths
)
values (
	'72500000-0000-4000-8000-000000000012',
	'84000000-0000-4000-8000-000000000681',
	'usda',
	'72500000-0000-4000-8000-000000000011',
	jsonb_build_object('changes', jsonb_build_array(jsonb_build_object(
		'field', 'ingredients',
		'label', 'Ingredients',
		'severity', 'high',
		'previousValue', 'Peanuts, salt',
		'observedValue', 'Peanuts, sugar, salt'
	))),
	array['ingredients']
);

insert into public.shared_product_conflicts (
	id,
	shared_product_id,
	barcode,
	field_path,
	observed_values,
	severity
)
select
	fixture.id,
	product.id,
	product.barcode,
	fixture.field_path,
	fixture.observed_values,
	'high'
from public.shared_products product
cross join (
	values
		(
			'72500000-0000-4000-8000-000000000020'::uuid,
			'product_name'::text,
			jsonb_build_array(
				jsonb_build_object('source', 'current label', 'value', 'Current name'),
				jsonb_build_object('source', 'provider', 'value', 'Observed name')
			)
		),
		(
			'72500000-0000-4000-8000-000000000021'::uuid,
			'ingredients'::text,
			jsonb_build_array(
				jsonb_build_object('source', 'current label', 'value', 'Peanuts, salt'),
				jsonb_build_object(
					'snapshotId', '72500000-0000-4000-8000-000000000011',
					'value', 'Peanuts, sugar, salt'
				)
			)
		),
		(
			'72500000-0000-4000-8000-000000000022'::uuid,
			'brand_owner'::text,
			jsonb_build_array(
				jsonb_build_object('source', 'current label', 'value', 'Current brand'),
				jsonb_build_object('source', 'other evidence', 'value', 'Other brand')
			)
		)
) fixture(id, field_path, observed_values)
where product.id = '84000000-0000-4000-8000-000000000681';

insert into public.catalog_correction_origins (
	id,
	shared_product_id,
	base_revision_id,
	origin_type,
	shared_product_conflict_id,
	affected_field_paths,
	prefilled_food
)
select
	'72500000-0000-4000-8000-000000000030',
	product.id,
	revision.id,
	'catalog_conflict',
	'72500000-0000-4000-8000-000000000020',
	array['product_name'],
	product.food
from public.shared_products product
join lateral (
	select candidate.id
	from public.shared_product_revisions candidate
	where candidate.shared_product_id = product.id
	order by candidate.revision_number desc
	limit 1
) revision on true
where product.id = '84000000-0000-4000-8000-000000000681';

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72500000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.resolve_catalog_conflict_without_correction(
		'72500000-0000-4000-8000-000000000020',
		'84000000-0000-4000-8000-000000000681',
		'The current package label is authoritative.'
	)$$,
	'42501',
	'MFA-verified catalog review access is required.',
	'ordinary users cannot resolve catalog conflicts'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72500000-0000-4000-8000-000000000002","role":"authenticated","app_role":"moderator","aal":"aal2"}',
	true
);

select is(
	(
		public.resolve_catalog_conflict_without_correction(
			'72500000-0000-4000-8000-000000000020',
			'84000000-0000-4000-8000-000000000681',
			'The current package label is authoritative.'
		) ->> 'reviewed'
	)::boolean,
	true,
	'a catalog reviewer can retain the current value and resolve the exact conflict'
);

reset role;
select is(
	(select status from public.shared_product_conflicts where id = '72500000-0000-4000-8000-000000000020'),
	'resolved',
	'the reviewed conflict reaches a terminal state'
);

select is(
	(select resolution_note from public.shared_product_conflicts where id = '72500000-0000-4000-8000-000000000020'),
	'The current package label is authoritative.',
	'the terminal conflict preserves the evidence note'
);

select is(
	(select status from public.catalog_correction_origins where id = '72500000-0000-4000-8000-000000000030'),
	'dismissed',
	'the unused correction handoff closes with the conflict'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72500000-0000-4000-8000-000000000002","role":"authenticated","app_role":"moderator","aal":"aal2"}',
	true
);

select ok(
	jsonb_array_length(public.get_catalog_review_work_summary(20) -> 'conflicts' -> 0 -> 'observedValues') > 0,
	'the review queue exposes the competing values instead of discarding them'
);

select is(
	public.get_catalog_review_work_summary(20) #>> '{providerChanges,0,changeSummary,changes,0,previousValue}',
	'Peanuts, salt',
	'the review queue preserves the earlier provider value'
);

select lives_ok(
	$$select public.review_catalog_provider_change(
		'72500000-0000-4000-8000-000000000012',
		'rejected',
		'The current exact package label remains stronger evidence.'
	)$$,
	'a reviewer can reject an unlinked provider observation'
);

reset role;
select is(
	(select status from public.catalog_provider_change_reviews where id = '72500000-0000-4000-8000-000000000012'),
	'rejected',
	'the provider observation leaves the pending queue'
);

select is(
	(select status from public.shared_product_conflicts where id = '72500000-0000-4000-8000-000000000021'),
	'resolved',
	'rejecting the provider observation closes its exact snapshot conflict'
);

select is(
	(select status from public.shared_product_conflicts where id = '72500000-0000-4000-8000-000000000022'),
	'open',
	'rejecting one provider snapshot does not close unrelated conflicts'
);

insert into public.shared_product_submissions (
	id,
	submitted_by,
	barcode,
	product_name,
	brand_owner,
	food,
	consent_to_share,
	status,
	verification_status,
	validation_report,
	evidence_paths,
	evidence_complete,
	category_option_id,
	submission_kind,
	target_shared_product_id,
	base_revision_id,
	change_summary,
	label_observed_at,
	submission_intent
)
select
	'72500000-0000-4000-8000-000000000040',
	'72500000-0000-4000-8000-000000000002',
	product.barcode,
	product.product_name,
	product.brand_owner,
	product.food,
	true,
	'pending',
	'manual_review',
	'{}'::jsonb,
	'{}'::jsonb,
	true,
	product.category_option_id,
	'product_update',
	product.id,
	revision.id,
	jsonb_build_object(
		'version', 1,
		'observedAt', now(),
		'baseRevisionNumber', revision.revision_number,
		'changes', jsonb_build_array(jsonb_build_object(
			'field', 'brand_owner',
			'label', 'Brand',
			'changeType', 'changed',
			'severity', 'medium',
			'previousValue', product.brand_owner,
			'submittedValue', 'Other brand'
		)),
		'sourceChecks', '[]'::jsonb
	),
	now(),
	'catalog_correction'
from public.shared_products product
join lateral (
	select candidate.id, candidate.revision_number
	from public.shared_product_revisions candidate
	where candidate.shared_product_id = product.id
	order by candidate.revision_number desc
	limit 1
) revision on true
where product.id = '84000000-0000-4000-8000-000000000681';

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72500000-0000-4000-8000-000000000002","role":"authenticated","app_role":"moderator","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.resolve_catalog_conflict_without_correction(
		'72500000-0000-4000-8000-000000000022',
		'84000000-0000-4000-8000-000000000681',
		'The current brand remains authoritative.'
	)$$,
	'P0001',
	'Review the linked catalog correction before resolving this conflict',
	'a linked conflict must be finished through its pending submission'
);

reset role;
select is(
	(select status from public.shared_product_conflicts where id = '72500000-0000-4000-8000-000000000022'),
	'open',
	'a rejected terminal shortcut cannot bypass the linked correction'
);

select * from finish();
rollback;
