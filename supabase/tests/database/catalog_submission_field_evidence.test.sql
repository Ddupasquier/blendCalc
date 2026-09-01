begin;

select plan(14);

insert into auth.users (id, aud, role, email)
values (
	'10000000-0000-4000-8000-000000000004',
	'authenticated',
	'authenticated',
	'api-write-004@example.com'
);

insert into public.shared_product_submissions (
	id,
	submitted_by,
	barcode,
	product_name,
	food,
	consent_to_share
)
values (
	'40000000-0000-4000-8000-000000000004',
	'10000000-0000-4000-8000-000000000004',
	'00000000000004',
	'Field Evidence Fixture',
	'{"description":"Field Evidence Fixture","foodNutrients":[]}'::jsonb,
	true
);

insert into public.shared_product_observations (
	id,
	barcode,
	source,
	source_reference,
	source_license,
	submission_id,
	submitted_by,
	raw_payload,
	normalized_food,
	content_hash,
	observed_at
)
values (
	'41000000-0000-4000-8000-000000000004',
	'00000000000004',
	'user-label',
	'api-intake:field-evidence-fixture',
	'user-submission-terms',
	'40000000-0000-4000-8000-000000000004',
	'10000000-0000-4000-8000-000000000004',
	'{"source":"package label"}'::jsonb,
	'{"description":"Field Evidence Fixture"}'::jsonb,
	repeat('4', 64),
	'2026-09-01 12:00:00+00'
);

select has_table(
	'public',
	'shared_product_submission_field_evidence',
	'catalog intake has a dedicated proposed-field evidence table'
);

select columns_are(
	'public',
	'shared_product_submission_field_evidence',
	array[
		'id',
		'submission_id',
		'source_observation_id',
		'field_path',
		'proposed_value',
		'unit',
		'basis',
		'observed_at',
		'confidence',
		'evidence_references',
		'created_at'
	],
	'proposed fields retain value, unit, basis, source, time, confidence, and evidence references'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.shared_product_submission_field_evidence',
		'select'
	)
		and not has_table_privilege(
			'authenticated',
			'public.shared_product_submission_field_evidence',
			'insert'
		)
		and has_table_privilege(
			'service_role',
			'public.shared_product_submission_field_evidence',
			'select'
		)
		and has_table_privilege(
			'service_role',
			'public.shared_product_submission_field_evidence',
			'insert'
		)
		and not has_table_privilege(
			'service_role',
			'public.shared_product_submission_field_evidence',
			'update'
		),
	'proposed evidence is private and append-only through the service boundary'
);

select lives_ok(
	$$
		set local role service_role;
		insert into public.shared_product_submission_field_evidence (
			submission_id,
			source_observation_id,
			field_path,
			proposed_value,
			unit,
			basis,
			observed_at,
			confidence,
			evidence_references
		)
		values (
			'40000000-0000-4000-8000-000000000004',
			'41000000-0000-4000-8000-000000000004',
			'nutrient:1008',
			'90'::jsonb,
			'kcal',
			'{"kind":"serving","servingId":"cookie"}'::jsonb,
			'2026-09-01 12:00:00+00',
			'user-reported',
			array['nutrition-label']
		);
		reset role;
	$$,
	'the trusted service can attach valid field evidence through the complete constraint boundary'
);

select is(
	(
		select proposed_value::text
		from public.shared_product_submission_field_evidence
		where field_path = 'nutrient:1008'
	),
	'90',
	'the exact proposed value is retained'
);

select is(
	(
		select concat_ws(
			'|',
			evidence.unit,
			evidence.basis ->> 'kind',
			observation.source,
			observation.source_reference,
			evidence.observed_at::text,
			evidence.confidence,
			evidence.evidence_references[1]
		)
		from public.shared_product_submission_field_evidence evidence
		join public.shared_product_observations observation
			on observation.id = evidence.source_observation_id
		where evidence.field_path = 'nutrient:1008'
	),
	'kcal|serving|user-label|api-intake:field-evidence-fixture|2026-09-01 12:00:00+00|user-reported|nutrition-label',
	'the field remains linked to its unit, basis, source record, timestamp, confidence, and evidence'
);

select throws_ok(
	$$
		insert into public.shared_product_submission_field_evidence (
			submission_id, source_observation_id, field_path, proposed_value,
			observed_at, confidence, evidence_references
		) values (
			'40000000-0000-4000-8000-000000000004',
			'41000000-0000-4000-8000-000000000004',
			'productName', '"Duplicate"'::jsonb,
			'2026-09-01 12:00:00+00', 'user-reported', array[]::text[]
		)
	$$,
	23514,
	null,
	'fields without an evidence reference fail closed'
);

select throws_ok(
	$$
		insert into public.shared_product_submission_field_evidence (
			submission_id, source_observation_id, field_path, proposed_value,
			basis, observed_at, confidence, evidence_references
		) values (
			'40000000-0000-4000-8000-000000000004',
			'41000000-0000-4000-8000-000000000004',
			'productName', '"Invalid basis"'::jsonb,
			'[]'::jsonb, '2026-09-01 12:00:00+00', 'user-reported', array['front-label']
		)
	$$,
	23514,
	null,
	'non-object field bases fail closed'
);

select throws_ok(
	$$
		insert into public.shared_product_submission_field_evidence (
			submission_id, source_observation_id, field_path, proposed_value,
			observed_at, confidence, evidence_references
		) values (
			'40000000-0000-4000-8000-000000000004',
			'41000000-0000-4000-8000-000000000004',
			'productName', '"Unverified"'::jsonb,
			'2026-09-01 12:00:00+00', 'source-verified', array['front-label']
		)
	$$,
	23514,
	null,
	'unreviewed intake cannot claim canonical verification confidence'
);

insert into public.shared_product_submissions (
	id, submitted_by, barcode, product_name, food, consent_to_share
)
values (
	'40000000-0000-4000-8000-000000000005',
	'10000000-0000-4000-8000-000000000004',
	'00000000000005',
	'Other Submission',
	'{"description":"Other Submission","foodNutrients":[]}'::jsonb,
	true
);

select throws_ok(
	$$
		insert into public.shared_product_submission_field_evidence (
			submission_id, source_observation_id, field_path, proposed_value,
			observed_at, confidence, evidence_references
		) values (
			'40000000-0000-4000-8000-000000000005',
			'41000000-0000-4000-8000-000000000004',
			'productName', '"Wrong owner"'::jsonb,
			'2026-09-01 12:00:00+00', 'user-reported', array['front-label']
		)
	$$,
	23514,
	null,
	'a source observation cannot be attached to a different submission'
);

select throws_ok(
	$$
		insert into public.shared_product_submission_field_evidence (
			submission_id, source_observation_id, field_path, proposed_value,
			unit, basis, observed_at, confidence, evidence_references
		) values (
			'40000000-0000-4000-8000-000000000004',
			'41000000-0000-4000-8000-000000000004',
			'nutrient:1008', '91'::jsonb,
			'kcal', '{"kind":"serving","servingId":"cookie"}'::jsonb,
			'2026-09-01 12:00:00+00', 'user-reported', array['nutrition-label']
		)
	$$,
	23505,
	null,
	'the same source record cannot propose the same field twice'
);

select lives_ok(
	$$
		insert into public.shared_product_submission_field_evidence (
			submission_id, source_observation_id, field_path, proposed_value,
			unit, basis, observed_at, confidence, evidence_references
		) values (
			'40000000-0000-4000-8000-000000000004',
			'41000000-0000-4000-8000-000000000004',
			'productName', '"Field Evidence Fixture"'::jsonb,
			null, null, '2026-09-01 12:00:00+00', 'user-reported', array['front-label']
		)
	$$,
	'non-numeric fields retain explicit non-applicable unit and basis values'
);

select is(
	(
		select count(*)::integer
		from public.shared_product_submission_field_evidence
		where submission_id = '40000000-0000-4000-8000-000000000004'
	),
	2,
	'only valid distinct field proposals are retained'
);

select is(
	(
		select count(*)::integer
		from public.shared_product_submission_field_evidence
		where source_observation_id = '41000000-0000-4000-8000-000000000004'
	),
	2,
	'all retained fields point to the exact source observation record'
);

select * from finish();

rollback;
