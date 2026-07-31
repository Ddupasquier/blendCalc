begin;

select plan(18);

select has_table(
	'public',
	'product_precautionary_statements',
	'precautionary statements have a normalized evidence table'
);

select has_column(
	'public',
	'product_precautionary_statements',
	'shared_product_revision_id',
	'precautionary evidence can identify its label revision'
);

select has_column(
	'public',
	'product_precautionary_statements',
	'source_observation_id',
	'precautionary evidence can identify its source observation'
);

insert into public.shared_product_observations (
	barcode,
	source,
	source_reference,
	source_license,
	raw_payload,
	normalized_food,
	content_hash,
	observed_at
)
values (
	'00000000000338',
	'usda',
	'qa-precautionary-statements',
	'CC0-1.0',
	'{}'::jsonb,
	jsonb_build_object(
		'sourceKey', 'usda',
		'precautionaryStatements', jsonb_build_array(
			jsonb_build_object(
				'type', 'may_contain',
				'text', 'May contain milk',
				'allergens', jsonb_build_array('milk'),
				'languageCode', 'en',
				'sourceField', 'ingredients'
			),
			jsonb_build_object(
				'type', 'shared_equipment',
				'text', 'Made on shared equipment that also processes milk',
				'allergens', jsonb_build_array('milk'),
				'languageCode', 'en',
				'sourceField', 'ingredients'
			),
			jsonb_build_object(
				'type', 'shared_facility',
				'text', 'Made in a facility that also processes wheat',
				'allergens', jsonb_build_array('wheat'),
				'languageCode', 'en',
				'sourceField', 'ingredients'
			),
			jsonb_build_object(
				'type', 'other_precautionary',
				'text', 'Package advisory: sesame is handled nearby',
				'allergens', jsonb_build_array('sesame'),
				'languageCode', 'en',
				'sourceField', 'manufacturer_advisory'
			)
		)
	),
	repeat('c', 64),
	'2026-07-31T14:00:00Z'::timestamptz
);

select public.extract_product_compatibility_facts(
	null,
	(
		select id
		from public.shared_product_observations
		where source_reference = 'qa-precautionary-statements'
	),
	null,
	(
		select normalized_food
		from public.shared_product_observations
		where source_reference = 'qa-precautionary-statements'
	),
	'shared_observation_metadata'
);

select is(
	(
		select count(*)::integer
		from public.product_precautionary_statements statement
		where statement.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-precautionary-statements'
		)
	),
	4,
	'all four explicit statement types are retained separately'
);

select is(
	(
		select array_agg(statement.statement_type order by statement.statement_type)
		from public.product_precautionary_statements statement
		where statement.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-precautionary-statements'
		)
	),
	array[
		'may_contain',
		'other_precautionary',
		'shared_equipment',
		'shared_facility'
	]::text[],
	'statement classifications are preserved without ranking their risk'
);

select is(
	(
		select statement.statement_text
		from public.product_precautionary_statements statement
		where statement.statement_type = 'shared_equipment'
			and statement.shared_product_observation_id = (
				select id
				from public.shared_product_observations
				where source_reference = 'qa-precautionary-statements'
			)
	),
	'Made on shared equipment that also processes milk',
	'exact package wording is not replaced by normalized copy'
);

select is(
	(
		select statement.normalized_allergens
		from public.product_precautionary_statements statement
		where statement.statement_type = 'shared_facility'
			and statement.shared_product_observation_id = (
				select id
				from public.shared_product_observations
				where source_reference = 'qa-precautionary-statements'
			)
	),
	array['wheat']::text[],
	'normalized allergens remain attached to their exact statement'
);

select is(
	(
		select statement.language_code
		from public.product_precautionary_statements statement
		where statement.statement_type = 'may_contain'
			and statement.shared_product_observation_id = (
				select id
				from public.shared_product_observations
				where source_reference = 'qa-precautionary-statements'
			)
	),
	'en',
	'statement language is retained'
);

select ok(
	(
		select bool_and(
			statement.source_observation_id = statement.shared_product_observation_id
			and statement.label_observed_at = '2026-07-31T14:00:00Z'::timestamptz
		)
		from public.product_precautionary_statements statement
		where statement.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-precautionary-statements'
		)
	),
	'observation identity and observed label date stay attached'
);

select is(
	(
		select count(*)::integer
		from public.product_compatibility_facts fact
		where fact.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-precautionary-statements'
		)
			and fact.precautionary_statement_id is not null
	),
	4,
	'each recognized statement produces its own compatibility evidence'
);

select is(
	(
		select count(*)::integer
		from public.product_compatibility_facts fact
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where fact.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-precautionary-statements'
		)
			and tag.slug = 'milk'
	),
	2,
	'repeated allergens deduplicate within a statement but not across distinct statements'
);

select ok(
	(
		select bool_and(
			fact.match_rule_id is not null
			and fact.policy_version_id =
				public.active_food_compatibility_policy_version_id()
		)
		from public.product_compatibility_facts fact
		where fact.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-precautionary-statements'
		)
			and fact.precautionary_statement_id is not null
	),
	'precautionary facts link the exact DB rule and active policy version'
);

select is(
	(
		select fact.source_text
		from public.product_compatibility_facts fact
		join public.product_precautionary_statements statement
			on statement.id = fact.precautionary_statement_id
		where statement.statement_type = 'shared_facility'
		limit 1
	),
	'Made in a facility that also processes wheat',
	'fact evidence exposes exact wording rather than a generated sentence'
);

insert into public.shared_product_observations (
	barcode,
	source,
	source_reference,
	source_license,
	raw_payload,
	normalized_food,
	content_hash,
	observed_at
)
values (
	'00000000000345',
	'usda',
	'qa-legacy-traces-only',
	'CC0-1.0',
	'{}'::jsonb,
	jsonb_build_object('traces', jsonb_build_array('milk')),
	repeat('d', 64),
	'2026-07-31T14:05:00Z'::timestamptz
);

select public.extract_product_compatibility_facts(
	null,
	(
		select id
		from public.shared_product_observations
		where source_reference = 'qa-legacy-traces-only'
	),
	null,
	(
		select normalized_food
		from public.shared_product_observations
		where source_reference = 'qa-legacy-traces-only'
	),
	'shared_observation_metadata'
);

select is(
	(
		select count(*)::integer
		from public.product_precautionary_statements statement
		where statement.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-legacy-traces-only'
		)
	),
	0,
	'legacy normalized traces are not misrepresented as exact package wording'
);

select is(
	(
		select count(*)::integer
		from public.product_compatibility_facts fact
		where fact.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-legacy-traces-only'
		)
			and fact.fact_type = 'may_contain'
	),
	1,
	'legacy normalized trace evidence remains available for compatibility checks'
);

select ok(
	(
		select bool_and(statement.shared_product_revision_id is null)
		from public.product_precautionary_statements statement
		where statement.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-precautionary-statements'
		)
	),
	'observation statements do not fabricate a catalog revision'
);

select policies_are(
	'public',
	'product_precautionary_statements',
	array[
		'Service role manages product precautionary statements',
		'Users can read active catalog precautionary statements'
	],
	'precautionary evidence has explicit read and service-write policies'
);

select has_function(
	'public',
	'sync_product_precautionary_statements',
	array['uuid', 'uuid', 'uuid', 'jsonb'],
	'precautionary evidence synchronization is reusable'
);

select * from finish();
rollback;
