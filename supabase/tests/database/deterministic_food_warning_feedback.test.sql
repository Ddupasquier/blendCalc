begin;

select plan(11);

select ok(
	not has_function_privilege(
		'authenticated',
		'public.apply_deterministic_food_warning_decision(uuid)',
		'execute'
	),
	'clients cannot invoke the internal deterministic decision function'
);

select ok(
	not has_function_privilege(
		'service_role',
		'public.apply_deterministic_food_warning_decision(uuid)',
		'execute'
	),
	'the service role cannot bypass the insert-trigger decision boundary'
);

insert into auth.users (id, aud, role, email)
values (
	'72900000-0000-4000-8000-000000000001',
	'authenticated',
	'authenticated',
	'deterministic-warning-user@blendcalc.local'
);

insert into public.food_compatibility_feedback (
	id,
	reported_by,
	policy_version_id,
	shared_product_id,
	shared_product_revision_id,
	source_key,
	source_id,
	barcode,
	food_description,
	warning_id,
	issue_code,
	issue_params,
	fact_snapshot,
	report_reason,
	report_fingerprint
)
select
	'72900000-0000-4000-8000-000000000010',
	'72900000-0000-4000-8000-000000000001',
	public.active_food_compatibility_policy_version_id(),
	product.id,
	revision.id,
	product.source,
	coalesce(product.source_reference, product.id::text),
	product.barcode,
	product.product_name,
	'allergen-soy-soy-contains',
	'FOOD_ALLERGEN_CONTAINS',
	jsonb_build_object('factLabel', 'Soy'),
	jsonb_build_object(
		'facts',
		(
			select jsonb_agg(jsonb_build_object(
				'slug', tag.slug,
				'label', tag.label,
				'category', tag.category,
				'factType', fact.fact_type,
				'sourceType', fact.source_type,
				'sourceText', fact.source_text,
				'confidence', fact.confidence
			) order by fact.fact_type, fact.source_type, fact.source_text)
			from public.product_compatibility_facts fact
			join public.compatibility_tags tag on tag.id = fact.tag_id
			where fact.shared_product_id = product.id
				and tag.slug = 'soy'
				and fact.confidence = 'confirmed'
		)
	),
	'incorrect_match',
	repeat('d', 64)
from public.shared_products product
join lateral (
	select candidate.id
	from public.shared_product_revisions candidate
	where candidate.shared_product_id = product.id
	order by candidate.revision_number desc
	limit 1
) revision on true
where product.id = '81000000-0000-4000-8000-000000000051';

select is(
	(
		select status
		from public.food_compatibility_feedback
		where id = '72900000-0000-4000-8000-000000000010'
	),
	'dismissed',
	'an exact unchanged confirmed warning is dismissed before it reaches review'
);

select is(
	(
		select decision_method
		from public.food_compatibility_feedback
		where id = '72900000-0000-4000-8000-000000000010'
	),
	'system_exact_evidence',
	'the automatic outcome records system ownership'
);

select ok(
	(
		select
			reviewed_by is null
			and reviewed_at is not null
			and resolution_action = 'none'
			and follow_up_status = 'not_required'
			and decision_metadata ->> 'decisionCode' =
				'CURRENT_WARNING_EXACTLY_SUPPORTED'
			and jsonb_array_length(decision_metadata -> 'matchedFacts') > 0
		from public.food_compatibility_feedback
		where id = '72900000-0000-4000-8000-000000000010'
	),
	'the system decision preserves an auditable exact-evidence receipt'
);

insert into public.food_compatibility_feedback (
	id,
	reported_by,
	policy_version_id,
	shared_product_id,
	shared_product_revision_id,
	source_key,
	source_id,
	barcode,
	food_description,
	warning_id,
	issue_code,
	issue_params,
	fact_snapshot,
	report_reason,
	report_fingerprint
)
select
	'72900000-0000-4000-8000-000000000011',
	'72900000-0000-4000-8000-000000000001',
	public.active_food_compatibility_policy_version_id(),
	product.id,
	revision.id,
	product.source,
	coalesce(product.source_reference, product.id::text),
	product.barcode,
	product.product_name,
	'allergen-soy-soy-contains',
	'FOOD_ALLERGEN_CONTAINS',
	jsonb_build_object('factLabel', 'Soy'),
	jsonb_build_object('facts', jsonb_build_array(jsonb_build_object(
		'slug', 'soy',
		'label', 'Soy',
		'factType', 'contains',
		'sourceType', 'label_allergen_field',
		'sourceText', 'soybeans',
		'confidence', 'confirmed'
	))),
	'outdated_source_data',
	repeat('e', 64)
from public.shared_products product
join lateral (
	select candidate.id
	from public.shared_product_revisions candidate
	where candidate.shared_product_id = product.id
	order by candidate.revision_number desc
	limit 1
) revision on true
where product.id = '81000000-0000-4000-8000-000000000051';

select is(
	(
		select status
		from public.food_compatibility_feedback
		where id = '72900000-0000-4000-8000-000000000011'
	),
	'pending',
	'outdated-source claims remain in human review'
);

insert into public.food_compatibility_feedback (
	id,
	reported_by,
	policy_version_id,
	shared_product_id,
	shared_product_revision_id,
	source_key,
	source_id,
	barcode,
	food_description,
	warning_id,
	issue_code,
	issue_params,
	fact_snapshot,
	report_reason,
	report_fingerprint
)
select
	'72900000-0000-4000-8000-000000000012',
	'72900000-0000-4000-8000-000000000001',
	public.active_food_compatibility_policy_version_id(),
	product.id,
	null,
	product.source,
	coalesce(product.source_reference, product.id::text),
	product.barcode,
	product.product_name,
	'allergen-soy-soy-contains',
	'FOOD_ALLERGEN_CONTAINS',
	jsonb_build_object('factLabel', 'Soy'),
	jsonb_build_object('facts', jsonb_build_array(jsonb_build_object(
		'slug', 'soy',
		'label', 'Soy',
		'factType', 'contains',
		'sourceType', 'label_allergen_field',
		'sourceText', 'soybeans',
		'confidence', 'confirmed'
	))),
	'incorrect_match',
	repeat('f', 64)
from public.shared_products product
where product.id = '81000000-0000-4000-8000-000000000051';

select is(
	(
		select status
		from public.food_compatibility_feedback
		where id = '72900000-0000-4000-8000-000000000012'
	),
	'pending',
	'reports without an exact captured revision remain in human review'
);

insert into public.food_compatibility_feedback (
	id,
	reported_by,
	policy_version_id,
	shared_product_id,
	shared_product_revision_id,
	source_key,
	source_id,
	barcode,
	food_description,
	warning_id,
	issue_code,
	issue_params,
	fact_snapshot,
	report_reason,
	report_fingerprint
)
select
	'72900000-0000-4000-8000-000000000013',
	'72900000-0000-4000-8000-000000000001',
	policy_version_id,
	shared_product_id,
	shared_product_revision_id,
	source_key,
	source_id,
	barcode,
	food_description,
	warning_id,
	issue_code,
	issue_params,
	fact_snapshot,
	'wrong_evidence_type',
	repeat('1', 64)
from public.food_compatibility_feedback
where id = '72900000-0000-4000-8000-000000000010';

select is(
	(
		select status
		from public.food_compatibility_feedback
		where id = '72900000-0000-4000-8000-000000000013'
	),
	'pending',
	'wrong-evidence-type claims remain in human review'
);

insert into public.food_compatibility_feedback (
	id,
	reported_by,
	policy_version_id,
	shared_product_id,
	shared_product_revision_id,
	source_key,
	source_id,
	barcode,
	food_description,
	warning_id,
	issue_code,
	issue_params,
	fact_snapshot,
	report_reason,
	report_fingerprint
)
select
	'72900000-0000-4000-8000-000000000014',
	'72900000-0000-4000-8000-000000000001',
	policy_version_id,
	shared_product_id,
	shared_product_revision_id,
	source_key,
	source_id,
	barcode,
	food_description,
	warning_id,
	issue_code,
	issue_params,
	jsonb_set(fact_snapshot, '{facts,0,confidence}', '"inferred"'),
	'incorrect_match',
	repeat('2', 64)
from public.food_compatibility_feedback
where id = '72900000-0000-4000-8000-000000000010';

select is(
	(
		select status
		from public.food_compatibility_feedback
		where id = '72900000-0000-4000-8000-000000000014'
	),
	'pending',
	'non-confirmed evidence remains in human review'
);

select throws_ok(
	$$update public.food_compatibility_feedback
	set review_note = 'Rewritten system decision'
	where id = '72900000-0000-4000-8000-000000000010'$$,
	'P0001',
	'Food-warning decisions are immutable',
	'completed deterministic decisions cannot be rewritten'
);

select is(
	(
		select count(*)::integer
		from public.food_compatibility_feedback
		where status = 'pending'
			and id in (
				'72900000-0000-4000-8000-000000000010',
				'72900000-0000-4000-8000-000000000011',
				'72900000-0000-4000-8000-000000000012',
				'72900000-0000-4000-8000-000000000013',
				'72900000-0000-4000-8000-000000000014'
			)
	),
	4,
	'only ambiguous or stale reports remain in the moderation queue'
);

select * from finish();

rollback;
