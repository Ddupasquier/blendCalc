begin;

select plan(13);

select has_column(
	'public',
	'food_compatibility_policy_exemptions',
	'threshold_value',
	'policy exemptions can retain reviewed numeric thresholds'
);

select has_column(
	'public',
	'food_compatibility_policy_exemptions',
	'product_context',
	'policy exemptions can retain reviewed product and use context'
);

select is(
	(
		select version_number
		from public.food_compatibility_policy_versions
		where status = 'active'
	),
	2,
	'the multilingual terminology bundle is the active immutable policy'
);

select is(
	public.compatibility_normalize_text('Crustáceos & Œufs'),
	'crustaceos oeufs',
	'compatibility normalization preserves exact accented terminology safely'
);

select is(
	(
		select count(distinct language_code)::integer
		from public.food_compatibility_policy_ingredient_aliases alias
		join public.food_compatibility_policy_versions version
			on version.id = alias.policy_version_id
		where version.status = 'active'
			and alias.review_status = 'reviewed'
			and alias.language_code in ('en', 'fr', 'es')
	),
	3,
	'English, French, and Spanish reviewed aliases are active'
);

select ok(
	(
		select count(*) >= 30
		from public.food_compatibility_policy_preference_term_mappings mapping
		join public.food_compatibility_policy_versions version
			on version.id = mapping.policy_version_id
		where version.status = 'active'
			and mapping.preference_rule_type = 'allergen'
	),
	'active canonical ingredients map to reviewed allergen facts'
);

select ok(
	(
		select count(*) >= 10
		from public.food_compatibility_policy_exemptions exemption
		join public.food_compatibility_policy_versions version
			on version.id = exemption.policy_version_id
		where version.status = 'active'
			and exemption.warning_behavior = 'context-only'
	),
	'regional exemptions are retained only as context'
);

select is(
	(
		select threshold_value
		from public.food_compatibility_policy_exemptions exemption
		join public.food_compatibility_policy_versions version
			on version.id = exemption.policy_version_id
		join public.compatibility_tags tag on tag.id = exemption.fact_tag_id
		where version.status = 'active'
			and exemption.jurisdiction_code = 'AU-NZ'
			and tag.slug = 'wheat'
			and exemption.processing_state = 'glucose-syrup'
	),
	20::numeric,
	'the Australia/New Zealand wheat glucose threshold is reproducible'
);

select ok(
	(
		select exemption_snapshot @> '[{"jurisdictionCode":"AU-NZ","thresholdValue":20}]'::jsonb
		from public.food_compatibility_policy_versions
		where status = 'active'
	),
	'activated policy snapshots include exemption conditions'
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
values
	(
		'99000000000001',
		'usda',
		'qa-multilingual-french',
		'CC0-1.0',
		'{}'::jsonb,
		'{
			"fdcId":-9901,
			"description":"French milk fixture",
			"foodNutrients":[],
			"ingredientList":["Lait écrémé"],
			"sourceMetadata":{"language":"fr"}
		}'::jsonb,
		repeat('a', 64),
		'2026-07-31T16:40:00Z'::timestamptz
	),
	(
		'99000000000002',
		'usda',
		'qa-multilingual-spanish',
		'CC0-1.0',
		'{}'::jsonb,
		'{
			"fdcId":-9902,
			"description":"Spanish shellfish fixture",
			"foodNutrients":[],
			"allergens":["es:crustáceos"],
			"sourceMetadata":{"language":"es"}
		}'::jsonb,
		repeat('b', 64),
		'2026-07-31T16:40:00Z'::timestamptz
	),
	(
		'99000000000003',
		'usda',
		'qa-multilingual-unsupported',
		'CC0-1.0',
		'{}'::jsonb,
		'{
			"fdcId":-9903,
			"description":"Unsupported language fixture",
			"foodNutrients":[],
			"ingredientList":["Milch"],
			"sourceMetadata":{"language":"de"}
		}'::jsonb,
		repeat('c', 64),
		'2026-07-31T16:40:00Z'::timestamptz
	);

select public.extract_product_compatibility_facts(
	null,
	observation.id,
	null,
	observation.normalized_food,
	'shared_observation_metadata'
)
from public.shared_product_observations observation
where observation.source_reference like 'qa-multilingual-%';

select ok(
	exists (
		select 1
		from public.product_compatibility_facts fact
		join public.shared_product_observations observation
			on observation.id = fact.shared_product_observation_id
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where observation.source_reference = 'qa-multilingual-french'
			and tag.slug = 'milk'
			and fact.source_type = 'label_ingredient_field'
			and fact.source_text = 'Lait écrémé'
	),
	'a reviewed French structured ingredient creates the canonical milk fact'
);

select ok(
	exists (
		select 1
		from public.product_compatibility_facts fact
		join public.shared_product_observations observation
			on observation.id = fact.shared_product_observation_id
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where observation.source_reference = 'qa-multilingual-spanish'
			and tag.slug = 'shellfish'
			and fact.source_type = 'label_allergen_field'
	),
	'a reviewed Spanish allergen declaration creates the canonical shellfish fact'
);

select ok(
	not exists (
		select 1
		from public.product_compatibility_facts fact
		join public.shared_product_observations observation
			on observation.id = fact.shared_product_observation_id
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where observation.source_reference = 'qa-multilingual-unsupported'
			and tag.slug = 'milk'
	),
	'an unsupported German term is not guessed as milk'
);

select ok(
	exists (
		select 1
		from public.food_compatibility_policy_ingredient_relationships relationship
		join public.food_compatibility_policy_versions version
			on version.id = relationship.policy_version_id
		join public.ingredient_terms child on child.id = relationship.child_term_id
		join public.ingredient_terms parent on parent.id = relationship.parent_term_id
		where version.status = 'active'
			and child.canonical_key = 'fully-refined-soybean-oil'
			and parent.canonical_key = 'soy'
			and relationship.conflict_inheritance = 'none'
	),
	'a labeling exemption remains distinct from personal soy conflict inheritance'
);

select * from finish();

rollback;
