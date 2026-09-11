begin;

select plan(35);

select has_table(
	'public',
	'nutrient_mapping_deterministic_rules',
	'deterministic nutrient mapping rules have a database-owned table'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.nutrient_mapping_deterministic_rules',
		'select'
	),
	'browser sessions cannot read deterministic mapping rules directly'
);

select ok(
	has_table_privilege(
		'service_role',
		'public.nutrient_mapping_deterministic_rules',
		'select'
	),
	'trusted server audits can read deterministic mapping rules'
);

select ok(
	not has_table_privilege(
		'service_role',
		'public.nutrient_mapping_deterministic_rules',
		'insert'
	),
	'runtime service credentials cannot create automatic approval rules'
);

select has_table(
	'public',
	'nutrient_mapping_deterministic_backfill_runs',
	'deterministic backfill runs retain an auditable summary'
);

select has_table(
	'public',
	'nutrient_mapping_deterministic_backfill_results',
	'deterministic backfill results retain one outcome per evaluated mapping'
);

select ok(
	has_table_privilege(
		'service_role',
		'public.nutrient_mapping_deterministic_backfill_results',
		'select'
	),
	'trusted server audits can inspect backfill results'
);

select ok(
	not has_table_privilege(
		'service_role',
		'public.nutrient_mapping_deterministic_backfill_runs',
		'insert'
	),
	'runtime service credentials cannot manufacture backfill audit runs'
);

select ok(
	not has_function_privilege(
		'service_role',
		'private.run_deterministic_nutrient_mapping_backfill(text)',
		'execute'
	),
	'runtime service credentials cannot launch a deterministic backfill'
);

select is(
	array[
		private.normalize_nutrient_unit_name('GRAM'),
		private.normalize_nutrient_unit_name('mcg'),
		private.normalize_nutrient_unit_name('µg')
	],
	array['G', 'UG', 'UG'],
	'database unit matching uses the same canonical aliases as nutrient ingestion'
);

select ok(
	exists (
		select 1
		from public.nutrient_mapping_deterministic_backfill_runs run
		where run.operation_reference = 'DEV-074 initial pending nutrient mapping review backfill'
			and run.completed_at is not null
			and run.approved_count + run.skipped_count = run.pending_count
	),
	'the migration evaluates the complete pending-review snapshot'
);

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings mapping
		where mapping.source_key = 'open-food-facts'
			and mapping.source_nutrient_key = 'arachidonic-acid'
			and mapping.source_unit_name = 'G'
			and mapping.nutrient_id = 700855
			and mapping.mapping_method = 'db_reviewed_api_key_match'
			and mapping.review_status = 'approved'
			and mapping.enabled
	),
	'the exact arachidonic-acid gram identity is approved automatically'
);

select ok(
	exists (
		select 1
		from public.nutrient_mapping_review_decisions decision
		join public.nutrient_source_mappings mapping
			on mapping.id = decision.mapping_id
		where mapping.source_key = 'open-food-facts'
			and mapping.source_nutrient_key = 'arachidonic-acid'
			and mapping.source_unit_name = 'G'
			and decision.decision_origin = 'deterministic_rule'
			and decision.deterministic_rule_id is not null
			and decision.reviewed_by is null
			and decision.selected_nutrient_id = 700855
	),
	'arachidonic-acid approval retains its exact system decision evidence'
);

select ok(
	exists (
		select 1
		from public.nutrient_unit_conversions conversion
		where conversion.source_key = 'open-food-facts'
			and conversion.nutrient_id = 1176
			and conversion.from_unit_name = 'G'
			and conversion.to_unit_name = 'UG'
			and conversion.multiplier = 1000000
			and conversion.conversion_method = 'reviewed_standard'
			and conversion.confidence = 1
	),
	'biotin has an exact reviewed grams-to-micrograms conversion'
);

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings mapping
		where mapping.source_key = 'open-food-facts'
			and mapping.source_nutrient_key = 'biotin'
			and mapping.source_unit_name = 'G'
			and mapping.nutrient_id = 1176
			and mapping.review_status = 'approved'
			and mapping.enabled
	),
	'the exact biotin identity is approved only after its reviewed unit path exists'
);

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings mapping
		where mapping.source_key = 'open-food-facts'
			and mapping.source_nutrient_key = 'biotin'
			and mapping.source_unit_name = 'UG'
			and mapping.nutrient_id = 1176
			and mapping.review_status = 'approved'
			and mapping.enabled
	),
	'the exact queued biotin microgram identity is approved without conversion'
);

select ok(
	exists (
		select 1
		from public.nutrient_mapping_review_decisions decision
		join public.nutrient_source_mappings mapping
			on mapping.id = decision.mapping_id
		where mapping.source_key = 'open-food-facts'
			and mapping.source_nutrient_key = 'biotin'
			and mapping.source_unit_name = 'G'
			and decision.decision_origin = 'deterministic_rule'
			and decision.selected_nutrient_id = 1176
			and decision.evidence_reference like 'https://github.com/openfoodfacts/%'
	),
	'biotin approval retains its provider evidence reference'
);

select ok(
	not exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		join public.nutrient_source_mappings mapping
			on occurrence.subject_key = mapping.id::text
		where mapping.source_key = 'open-food-facts'
			and mapping.source_nutrient_key in ('arachidonic-acid', 'biotin')
			and occurrence.issue_code = 'NUTRIENT_MAPPING_GAP'
	),
	'deterministic approvals do not remain in the human work queue'
);

select lives_ok(
	$$
		update public.nutrient_mapping_deterministic_rules
		set review_note = review_note
		where source_key = 'open-food-facts'
			and source_nutrient_key in ('arachidonic-acid', 'biotin')
			and enabled
	$$,
	'reevaluating an exact rule is idempotent'
);

select is(
	(
		select count(*)::integer
		from public.nutrient_mapping_review_decisions decision
		join public.nutrient_source_mappings mapping
			on mapping.id = decision.mapping_id
		where mapping.source_key = 'open-food-facts'
			and mapping.source_nutrient_key in ('arachidonic-acid', 'biotin')
			and decision.decision_origin = 'deterministic_rule'
	),
	3,
	'reevaluation does not duplicate deterministic decisions'
);

insert into public.nutrient_source_mappings (
	source_key,
	source_nutrient_key,
	source_unit_name,
	source_nutrient_name,
	nutrient_id,
	priority,
	mapping_method,
	confidence,
	enabled,
	provenance,
	review_status
)
values
	(
		'open-food-facts',
		'qa-backfill-protein',
		'G',
		'Protein from an exact backfill rule',
		1003,
		100,
		'api_observation_match',
		1,
		false,
		'{"reason":"Exact test identity awaiting the full-queue backfill."}'::jsonb,
		'pending_review'
	),
	(
		'open-food-facts',
		'qa-backfill-unproven',
		'G',
		'Unproven nutrient identity',
		1003,
		100,
		'api_observation_match',
		1,
		false,
		'{"reason":"No deterministic rule exists for this identity."}'::jsonb,
		'pending_review'
	);

alter table public.nutrient_mapping_deterministic_rules
	disable trigger apply_deterministic_nutrient_mapping_rule;

insert into public.nutrient_mapping_deterministic_rules (
	source_key,
	source_nutrient_key,
	source_unit_name,
	source_nutrient_name,
	nutrient_id,
	rule_version,
	review_reference,
	evidence_reference,
	review_note,
	effective_at,
	provenance
)
values (
	'open-food-facts',
	'qa-backfill-protein',
	'G',
	'Protein from an exact backfill rule',
	1003,
	1,
	'DEV-074:test:qa-backfill-protein:G:v1',
	'https://example.test/exact-backfill-provider-key',
	'The exact test provider identity and canonical gram unit are reviewed.',
	'2026-09-10T00:00:00Z',
	'{"owner":"database-test"}'::jsonb
);

alter table public.nutrient_mapping_deterministic_rules
	enable trigger apply_deterministic_nutrient_mapping_rule;

create temporary table qa_deterministic_backfill_run (id uuid primary key);

insert into qa_deterministic_backfill_run (id)
select private.run_deterministic_nutrient_mapping_backfill(
	'DEV-074 pgTAP complete pending-review backfill'
);

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings mapping
		where mapping.source_nutrient_key = 'qa-backfill-protein'
			and mapping.review_status = 'approved'
			and mapping.enabled
	),
	'the full-queue backfill approves an existing exact-rule mapping'
);

select ok(
	exists (
		select 1
		from public.nutrient_mapping_deterministic_backfill_results result
		join qa_deterministic_backfill_run run on run.id = result.run_id
		where result.source_nutrient_key = 'qa-backfill-protein'
			and result.result = 'approved'
			and result.reason = 'approved_exact_rule'
			and result.decision_id is not null
	),
	'the backfill records the exact approved mapping and decision'
);

select ok(
	exists (
		select 1
		from public.nutrient_mapping_deterministic_backfill_results result
		join qa_deterministic_backfill_run run on run.id = result.run_id
		where result.source_nutrient_key = 'qa-backfill-unproven'
			and result.result = 'skipped'
			and result.reason = 'no_exact_rule'
			and result.decision_id is null
	),
	'the backfill leaves an unproven mapping queued with an explicit reason'
);

select ok(
	exists (
		select 1
		from public.nutrient_mapping_deterministic_backfill_runs backfill
		join qa_deterministic_backfill_run run on run.id = backfill.id
		where backfill.completed_at is not null
			and backfill.approved_count + backfill.skipped_count = backfill.pending_count
			and backfill.approved_count >= 1
			and backfill.skipped_count >= 1
	),
	'the completed backfill summary reconciles every evaluated pending mapping'
);

insert into public.nutrient_source_mappings (
	source_key,
	source_nutrient_key,
	source_unit_name,
	source_nutrient_name,
	nutrient_id,
	priority,
	mapping_method,
	confidence,
	enabled,
	provenance,
	review_status
)
values
	(
		'open-food-facts',
		'qa-biotin-like-name',
		'G',
		'Biotin',
		1176,
		100,
		'api_taxonomy_match',
		1,
		false,
		'{"reason":"Name similarity alone is not identity evidence."}'::jsonb,
		'pending_review'
	),
	(
		'open-food-facts',
		'arachidonic-acid',
		'MG',
		'Arachidonic acid',
		700855,
		100,
		'api_observation_match',
		1,
		false,
		'{"reason":"The observed unit does not match the exact rule."}'::jsonb,
		'pending_review'
	),
	(
		'open-food-facts',
		'omega-6-fat',
		'G',
		'Omega-6 fatty acids',
		700855,
		100,
		'api_taxonomy_match',
		1,
		false,
		'{"reason":"A parent nutrient label cannot prove one exact canonical identity."}'::jsonb,
		'pending_review'
	);

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings mapping
		where mapping.source_nutrient_key = 'qa-biotin-like-name'
			and mapping.review_status = 'pending_review'
			and not mapping.enabled
	),
	'a perfect-confidence name resemblance without an exact rule stays pending'
);

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings mapping
		where mapping.source_nutrient_key = 'arachidonic-acid'
			and mapping.source_unit_name = 'MG'
			and mapping.review_status = 'pending_review'
			and not mapping.enabled
	),
	'the right provider key with the wrong unit stays pending'
);

insert into public.nutrient_mapping_deterministic_rules (
	source_key,
	source_nutrient_key,
	source_unit_name,
	source_nutrient_name,
	nutrient_id,
	rule_version,
	review_reference,
	evidence_reference,
	review_note,
	effective_at,
	provenance
)
values (
	'open-food-facts',
	'qa-protein-kj',
	'KJ',
	'QA protein in an incompatible unit',
	1003,
	1,
	'DEV-074:test:qa-protein-kj:KJ:v1',
	'https://example.test/exact-provider-key',
	'The exact test identity is known, but its unit requires a reviewed conversion.',
	'2026-09-10T00:00:00Z',
	'{"owner":"database-test"}'::jsonb
);

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings mapping
		where mapping.source_nutrient_key = 'qa-protein-kj'
			and mapping.source_unit_name = 'KJ'
			and mapping.review_status = 'pending_review'
			and not mapping.enabled
	),
	'an exact rule cannot approve a mapping without a reviewed unit path'
);

insert into public.nutrient_unit_conversions (
	source_key,
	nutrient_id,
	from_unit_name,
	to_unit_name,
	multiplier,
	conversion_method,
	confidence,
	provenance
)
values (
	'open-food-facts',
	1003,
	'KJ',
	'G',
	1,
	'api_observed_ratio',
	1,
	'{"owner":"database-test"}'::jsonb
);

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings mapping
		where mapping.source_nutrient_key = 'qa-protein-kj'
			and mapping.review_status = 'pending_review'
			and not mapping.enabled
	),
	'an observed ratio is not sufficient conversion evidence for automatic approval'
);

update public.nutrient_unit_conversions
set conversion_method = 'moderator_verified'
where source_key = 'open-food-facts'
	and nutrient_id = 1003
	and from_unit_name = 'KJ'
	and to_unit_name = 'G';

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings mapping
		where mapping.source_nutrient_key = 'qa-protein-kj'
			and mapping.nutrient_id = 1003
			and mapping.review_status = 'approved'
			and mapping.enabled
	),
	'adding the reviewed nutrient-specific conversion completes automatic approval'
);

select ok(
	exists (
		select 1
		from public.nutrient_mapping_review_decisions decision
		join public.nutrient_source_mappings mapping
			on mapping.id = decision.mapping_id
		where mapping.source_nutrient_key = 'qa-protein-kj'
			and decision.decision_origin = 'deterministic_rule'
			and decision.reviewed_by is null
			and decision.selected_nutrient_id = 1003
	),
	'a conversion-triggered approval retains deterministic rule evidence'
);

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings mapping
		where mapping.source_key = 'open-food-facts'
			and mapping.source_nutrient_key = 'omega-6-fat'
			and mapping.review_status = 'pending_review'
			and not mapping.enabled
	),
	'an ambiguous parent nutrient remains queued for human review'
);

insert into auth.users (id, aud, role, email)
values (
	'72400000-0000-4000-8000-000000000074',
	'authenticated',
	'authenticated',
	'deterministic-rule-owner@blendcalc.local'
);

select throws_ok(
	$$
		insert into public.nutrient_mapping_review_decisions (
			mapping_id,
			source_key,
			source_nutrient_key,
			source_unit_name,
			outcome,
			previous_nutrient_id,
			selected_nutrient_id,
			previous_mapping_method,
			review_note,
			evidence_reference,
			reviewed_by,
			decision_origin,
			deterministic_rule_id
		)
		select
			mapping.id,
			mapping.source_key,
			mapping.source_nutrient_key,
			mapping.source_unit_name,
			'approved',
			mapping.nutrient_id,
			mapping.nutrient_id,
			mapping.mapping_method,
			'Invalid mixed ownership.',
			'https://example.test/invalid',
			'72400000-0000-4000-8000-000000000074'::uuid,
			'deterministic_rule',
			rule.id
		from public.nutrient_source_mappings mapping
		join public.nutrient_mapping_deterministic_rules rule
			on rule.source_key = mapping.source_key
			and rule.source_nutrient_key = mapping.source_nutrient_key
			and rule.source_unit_name = mapping.source_unit_name
		where mapping.source_nutrient_key = 'arachidonic-acid'
			and mapping.source_unit_name = 'G'
		limit 1
	$$,
	'23514',
	'new row for relation "nutrient_mapping_review_decisions" violates check constraint "nutrient_mapping_review_decisions_actor_check"',
	'deterministic decisions cannot claim a human reviewer'
);

select is(
	(
		select count(*)::integer
		from public.nutrient_mapping_deterministic_rules rule
		where rule.source_key = 'open-food-facts'
			and rule.review_reference like 'DEV-074:open-food-facts:%'
			and rule.rule_version = 1
			and rule.enabled
	),
	47,
	'the local reference catalog receives every reviewed exact-key and unit rule it supports'
);

select ok(
	not exists (
		select 1
		from public.nutrient_mapping_deterministic_rules rule
		where rule.review_reference like 'DEV-074:open-food-facts:%'
			and not exists (
				select 1
				from public.nutrient_source_mappings mapping
				where mapping.source_key = rule.source_key
					and mapping.source_nutrient_key = rule.source_nutrient_key
					and private.normalize_nutrient_unit_name(mapping.source_unit_name) = rule.source_unit_name
					and mapping.nutrient_id = rule.nutrient_id
					and mapping.review_status = 'approved'
					and mapping.enabled
			)
	),
	'every production deterministic rule has an eligible approved mapping'
);

select ok(
	not exists (
		select 1
		from public.nutrient_mapping_deterministic_rules rule
		where rule.source_nutrient_key in (
			'beta-alanine',
			'choline-chloride',
			'collagen-meat-protein-ratio',
			'crude-ash',
			'crude-fat',
			'crude-protein',
			'energy-from-fat',
			'omega-3-fat',
			'omega-6-fat',
			'omega-9-fat',
			'protein-value',
			'serum-proteins',
			'unsaturated-fat',
			'vitamin-k',
			'water-hardness'
		)
	),
	'broader, component, ratio, and non-equivalent identities remain outside automation'
);

select * from finish();

rollback;
