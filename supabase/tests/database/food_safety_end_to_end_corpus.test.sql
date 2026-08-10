begin;

select plan(18);

create temporary table food_safety_corpus (
	case_id text primary key,
	barcode text not null unique,
	normalized_food jsonb not null,
	raw_payload jsonb not null
) on commit drop;

create temporary table food_safety_corpus_expectations (
	case_id text not null references food_safety_corpus(case_id),
	tag_slug text not null,
	fact_type text not null,
	source_type text not null,
	primary key (case_id, tag_slug, fact_type, source_type)
) on commit drop;

insert into food_safety_corpus (case_id, barcode, raw_payload, normalized_food)
values
	(
		'explicit-fields',
		'99000000001001',
		'{"fixture":"synthetic","allergens_tags":["en:milk"],"traces_tags":["en:peanuts"]}'::jsonb,
		'{
			"description":"Synthetic explicit fields",
			"foodIdentityType":"packaged",
			"ingredientList":["Cocoa","Sugar"],
			"allergens":["en:milk"],
			"traces":["en:peanuts"],
			"sourceMetadata":{"language":"en"}
		}'::jsonb
	),
	(
		'nested-ingredient',
		'99000000001002',
		'{"fixture":"synthetic","ingredients":[{"text":"Chocolate filling","ingredients":[{"text":"Milk"}]}]}'::jsonb,
		'{
			"description":"Synthetic nested ingredient",
			"foodIdentityType":"packaged",
			"ingredients":"Chocolate filling (milk, cocoa)",
			"structuredIngredients":[{
				"id":"chocolate-filling",
				"text":"Chocolate filling",
				"ingredients":[{"id":"milk","text":"Milk"},{"id":"cocoa","text":"Cocoa"}]
			}],
			"sourceMetadata":{"language":"en"}
		}'::jsonb
	),
	(
		'french-label',
		'99000000001003',
		'{"fixture":"synthetic","lang":"fr","ingredients":[{"text":"Lait écrémé"}]}'::jsonb,
		'{
			"description":"Synthetic French label",
			"foodIdentityType":"packaged",
			"structuredIngredients":[{"id":"fr:lait-ecreme","text":"Lait écrémé"}],
			"sourceMetadata":{"language":"fr"}
		}'::jsonb
	),
	(
		'spanish-label',
		'99000000001004',
		'{"fixture":"synthetic","lang":"es","allergens_tags":["es:crustáceos"]}'::jsonb,
		'{
			"description":"Synthetic Spanish label",
			"foodIdentityType":"packaged",
			"ingredientList":["Agua","Sal"],
			"allergens":["es:crustáceos"],
			"sourceMetadata":{"language":"es"}
		}'::jsonb
	),
	(
		'unsupported-language',
		'99000000001005',
		'{"fixture":"synthetic","lang":"de","ingredients":[{"text":"Milch"}]}'::jsonb,
		'{
			"description":"Synthetic unsupported label",
			"foodIdentityType":"packaged",
			"structuredIngredients":[{"id":"de:milch","text":"Milch"}],
			"sourceMetadata":{"language":"de"}
		}'::jsonb
	),
	(
		'eggplant-negative',
		'99000000001006',
		'{"fixture":"synthetic","ingredients":[{"text":"Eggplant"}]}'::jsonb,
		'{
			"description":"Synthetic eggplant bowl",
			"foodIdentityType":"packaged",
			"structuredIngredients":[{"id":"eggplant","text":"Eggplant"}],
			"sourceMetadata":{"language":"en"}
		}'::jsonb
	),
	(
		'almond-milk-negative',
		'99000000001007',
		'{"fixture":"synthetic","ingredients":[{"text":"Almond milk"}]}'::jsonb,
		'{
			"description":"Synthetic almond beverage",
			"foodIdentityType":"packaged",
			"structuredIngredients":[{"id":"almond-milk","text":"Almond milk"}],
			"sourceMetadata":{"language":"en"}
		}'::jsonb
	),
	(
		'title-only-negative',
		'99000000001008',
		'{"fixture":"synthetic","product_name":"Milk Egg Peanut Fantasy"}'::jsonb,
		'{
			"description":"Milk Egg Peanut Fantasy",
			"brandOwner":"Milk Egg Peanut Brand",
			"foodIdentityType":"packaged",
			"ingredientList":["Water"],
			"sourceMetadata":{"language":"en"}
		}'::jsonb
	),
	(
		'shared-equipment',
		'99000000001009',
		'{"fixture":"synthetic","ingredients_text":"Made on shared equipment that also processes sesame."}'::jsonb,
		'{
			"description":"Synthetic shared equipment label",
			"foodIdentityType":"packaged",
			"ingredientList":["Rice","Salt"],
			"traces":["sesame"],
			"precautionaryStatements":[{
				"type":"shared_equipment",
				"text":"Made on shared equipment that also processes sesame",
				"allergens":["sesame"],
				"languageCode":"en",
				"sourceField":"ingredients"
			}],
			"sourceMetadata":{"language":"en"}
		}'::jsonb
	),
	(
		'shared-facility',
		'99000000001010',
		'{"fixture":"synthetic","ingredients_text":"Produced in a facility that also handles peanuts."}'::jsonb,
		'{
			"description":"Synthetic shared facility label",
			"foodIdentityType":"packaged",
			"ingredientList":["Corn","Salt"],
			"traces":["peanuts"],
			"precautionaryStatements":[{
				"type":"shared_facility",
				"text":"Produced in a facility that also handles peanuts",
				"allergens":["peanuts"],
				"languageCode":"en",
				"sourceField":"ingredients"
			}],
			"sourceMetadata":{"language":"en"}
		}'::jsonb
	),
	(
		'may-contain',
		'99000000001011',
		'{"fixture":"synthetic","traces":"tree nuts"}'::jsonb,
		'{
			"description":"Synthetic may contain label",
			"foodIdentityType":"packaged",
			"ingredientList":["Fruit","Sugar"],
			"traces":["tree nuts"],
			"precautionaryStatements":[{
				"type":"may_contain",
				"text":"May contain tree nuts",
				"allergens":["tree nuts"],
				"languageCode":"en",
				"sourceField":"traces"
			}],
			"sourceMetadata":{"language":"en"}
		}'::jsonb
	),
	(
		'refined-soy',
		'99000000001012',
		'{"fixture":"synthetic","ingredients":[{"text":"Fully refined soybean oil"}]}'::jsonb,
		'{
			"description":"Synthetic refined oil food",
			"foodIdentityType":"packaged",
			"structuredIngredients":[{"id":"refined-soy","text":"Fully refined soybean oil"}],
			"sourceMetadata":{"language":"en"}
		}'::jsonb
	),
	(
		'wheat-ingredient',
		'99000000001013',
		'{"fixture":"synthetic","ingredients":[{"text":"Wheat flour"}]}'::jsonb,
		'{
			"description":"Synthetic wheat crackers",
			"foodIdentityType":"packaged",
			"structuredIngredients":[{"id":"wheat-flour","text":"Wheat flour"}],
			"sourceMetadata":{"language":"en"}
		}'::jsonb
	),
	(
		'formulation-before',
		'99000000001014',
		'{"fixture":"synthetic","rev":1,"ingredients":[{"text":"Oats"},{"text":"Cocoa"}]}'::jsonb,
		'{
			"description":"Synthetic reformulated bar",
			"foodIdentityType":"packaged",
			"structuredIngredients":[{"id":"oats","text":"Oats"},{"id":"cocoa","text":"Cocoa"}],
			"sourceMetadata":{"language":"en","revision":1}
		}'::jsonb
	),
	(
		'formulation-after',
		'99000000001015',
		'{"fixture":"synthetic","rev":2,"allergens_tags":["en:peanuts"]}'::jsonb,
		'{
			"description":"Synthetic reformulated bar",
			"foodIdentityType":"packaged",
			"structuredIngredients":[{"id":"oats","text":"Oats"},{"id":"peanuts","text":"Peanuts"}],
			"allergens":["en:peanuts"],
			"sourceMetadata":{"language":"en","revision":2}
		}'::jsonb
	),
	(
		'generic-shrimp',
		'99000000001016',
		'{"fixture":"synthetic","source":"usda","description":"Crustaceans, shrimp, raw"}'::jsonb,
		'{
			"description":"Crustaceans, Shrimp, Raw",
			"dataType":"Foundation",
			"foodIdentityType":"generic",
			"sourceKey":"usda",
			"foodNutrients":[]
		}'::jsonb
	),
	(
		'empty-evidence',
		'99000000001017',
		'{"fixture":"synthetic"}'::jsonb,
		'{
			"description":"Synthetic unknown food",
			"foodIdentityType":"packaged",
			"sourceMetadata":{"language":"en"}
		}'::jsonb
	);

insert into food_safety_corpus_expectations (
	case_id,
	tag_slug,
	fact_type,
	source_type
)
values
	('explicit-fields', 'milk', 'contains', 'label_allergen_field'),
	('explicit-fields', 'peanut', 'may_contain', 'label_trace_field'),
	('nested-ingredient', 'milk', 'ingredient_present', 'label_ingredient_field'),
	('french-label', 'milk', 'ingredient_present', 'label_ingredient_field'),
	('spanish-label', 'shellfish', 'contains', 'label_allergen_field'),
	('almond-milk-negative', 'tree-nut', 'ingredient_present', 'label_ingredient_field'),
	('shared-equipment', 'sesame', 'may_contain', 'label_trace_field'),
	('shared-facility', 'peanut', 'may_contain', 'label_trace_field'),
	('may-contain', 'tree-nut', 'may_contain', 'label_trace_field'),
	('refined-soy', 'soy', 'ingredient_present', 'label_ingredient_field'),
	('wheat-ingredient', 'wheat', 'ingredient_present', 'label_ingredient_field'),
	('formulation-after', 'peanut', 'contains', 'label_allergen_field'),
	('generic-shrimp', 'shellfish', 'contains', 'food_identity_taxonomy');

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
select
	corpus.barcode,
	case when corpus.case_id = 'generic-shrimp' then 'usda' else 'open-food-facts' end,
	concat('qa-safety-corpus-', corpus.case_id),
	case when corpus.case_id = 'generic-shrimp' then 'CC0-1.0' else 'ODbL-1.0' end,
	corpus.raw_payload,
	corpus.normalized_food,
	lpad(row_number() over (order by corpus.case_id)::text, 64, '0'),
	'2026-07-31T17:00:00Z'::timestamptz +
		(row_number() over (order by corpus.case_id) * interval '1 second')
from food_safety_corpus corpus;

select public.extract_product_compatibility_facts(
	null,
	observation.id,
	null,
	observation.normalized_food,
	'shared_observation_metadata'
)
from public.shared_product_observations observation
where observation.source_reference like 'qa-safety-corpus-%';

select is(
	(
		select count(*)::integer
		from public.shared_product_observations observation
		where observation.source_reference like 'qa-safety-corpus-%'
	),
	17,
	'the committed corpus contains seventeen synthetic source-shaped observations'
);

select ok(
	not exists (
		select 1
		from public.shared_product_observations observation
		where observation.source_reference like 'qa-safety-corpus-%'
			and observation.raw_payload ->> 'fixture' <> 'synthetic'
	),
	'corpus payloads are explicitly synthetic and contain no copied or private evidence'
);

select ok(
	not exists (
		select 1
		from food_safety_corpus_expectations expected
		where not exists (
			select 1
			from public.shared_product_observations observation
			join public.product_compatibility_facts fact
				on fact.shared_product_observation_id = observation.id
			join public.compatibility_tags tag on tag.id = fact.tag_id
			where observation.source_reference =
				concat('qa-safety-corpus-', expected.case_id)
				and tag.slug = expected.tag_slug
				and fact.fact_type = expected.fact_type
				and fact.source_type = expected.source_type
		)
	),
	'all expected canonical facts survive normalization and DB extraction'
);

select ok(
	not exists (
		select 1
		from public.shared_product_observations observation
		join public.product_compatibility_facts fact
			on fact.shared_product_observation_id = observation.id
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where observation.source_reference = 'qa-safety-corpus-unsupported-language'
			and tag.slug = 'milk'
	),
	'unsupported German terminology is not guessed as milk'
);

select ok(
	not exists (
		select 1
		from public.shared_product_observations observation
		join public.product_compatibility_facts fact
			on fact.shared_product_observation_id = observation.id
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where observation.source_reference = 'qa-safety-corpus-eggplant-negative'
			and tag.slug = 'egg'
	),
	'eggplant is a token-boundary negative control for egg'
);

select ok(
	not exists (
		select 1
		from public.shared_product_observations observation
		join public.product_compatibility_facts fact
			on fact.shared_product_observation_id = observation.id
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where observation.source_reference = 'qa-safety-corpus-almond-milk-negative'
			and tag.slug = 'milk'
	),
	'almond milk is a compound-term negative control for dairy milk'
);

select is(
	(
		select count(*)::integer
		from public.shared_product_observations observation
		join public.product_compatibility_facts fact
			on fact.shared_product_observation_id = observation.id
		where observation.source_reference = 'qa-safety-corpus-title-only-negative'
	),
	0,
	'product names and brands never create compatibility facts'
);

select is(
	(
		select count(*)::integer
		from public.shared_product_observations observation
		join public.product_ingredient_statements statement
			on statement.shared_product_observation_id = observation.id
		join public.product_ingredient_components component
			on component.statement_id = statement.id
		where observation.source_reference = 'qa-safety-corpus-nested-ingredient'
	),
	3,
	'nested source ingredients are retained relationally'
);

select ok(
	not exists (
		select 1
		from public.shared_product_observations observation
		join public.product_compatibility_facts fact
			on fact.shared_product_observation_id = observation.id
		where observation.source_reference like 'qa-safety-corpus-%'
			and fact.source_type = 'label_ingredient_field'
			and (
				fact.ingredient_component_id is null
				or fact.policy_version_id is null
			)
	),
	'ingredient-derived facts link their source component and immutable policy'
);

select ok(
	not exists (
		select 1
		from public.shared_product_observations observation
		join public.product_compatibility_facts fact
			on fact.shared_product_observation_id = observation.id
		where observation.source_reference like 'qa-safety-corpus-%'
			and fact.source_type = 'label_trace_field'
			and exists (
				select 1
				from public.product_precautionary_statements statement
				where statement.shared_product_observation_id = observation.id
			)
			and fact.precautionary_statement_id is null
	),
	'facts from exact precautionary statements link their source statement'
);

select ok(
	exists (
		select 1
		from public.shared_product_observations observation
		join public.product_precautionary_statements statement
			on statement.shared_product_observation_id = observation.id
		where observation.source_reference = 'qa-safety-corpus-shared-equipment'
			and statement.statement_type = 'shared_equipment'
			and statement.statement_text =
				'Made on shared equipment that also processes sesame'
	),
	'shared-equipment wording remains lossless'
);

select ok(
	exists (
		select 1
		from public.shared_product_observations observation
		join public.product_precautionary_statements statement
			on statement.shared_product_observation_id = observation.id
		where observation.source_reference = 'qa-safety-corpus-shared-facility'
			and statement.statement_type = 'shared_facility'
			and statement.statement_text =
				'Produced in a facility that also handles peanuts'
	),
	'shared-facility wording remains lossless'
);

select ok(
	exists (
		select 1
		from public.shared_product_observations observation
		join public.product_compatibility_facts fact
			on fact.shared_product_observation_id = observation.id
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where observation.source_reference = 'qa-safety-corpus-formulation-after'
			and tag.slug = 'peanut'
	) and not exists (
		select 1
		from public.shared_product_observations observation
		join public.product_compatibility_facts fact
			on fact.shared_product_observation_id = observation.id
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where observation.source_reference = 'qa-safety-corpus-formulation-before'
			and tag.slug = 'peanut'
	),
	'formulation revisions preserve the newly introduced conflict'
);

select ok(
	exists (
		select 1
		from public.shared_product_observations observation
		join public.product_compatibility_facts fact
			on fact.shared_product_observation_id = observation.id
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where observation.source_reference = 'qa-safety-corpus-refined-soy'
			and tag.slug = 'soy'
	) and exists (
		select 1
		from public.food_compatibility_policy_exemptions exemption
		join public.food_compatibility_policy_versions version
			on version.id = exemption.policy_version_id
		join public.compatibility_tags tag on tag.id = exemption.fact_tag_id
		where version.status = 'active'
			and tag.slug = 'soy'
			and exemption.processing_state = 'fully-refined'
			and exemption.warning_behavior = 'context-only'
	),
	'regional labeling exemptions remain context while personal soy evidence remains'
);

select ok(
	(
		select count(distinct fact.source_type) >= 4
		from public.shared_product_observations observation
		join public.product_compatibility_facts fact
			on fact.shared_product_observation_id = observation.id
		where observation.source_reference like 'qa-safety-corpus-%'
	),
	'extraction coverage reports ingredient, allergen, trace, and identity sources'
);

select ok(
	not exists (
		select 1
		from public.shared_product_observations observation
		join public.product_compatibility_facts fact
			on fact.shared_product_observation_id = observation.id
		join public.food_compatibility_policy_versions version
			on version.id = fact.policy_version_id
		where observation.source_reference like 'qa-safety-corpus-%'
			and version.status <> 'active'
	),
	'every extracted result reports the active immutable policy version'
);

create temporary table food_safety_fact_counts_before as
select
	observation.id as observation_id,
	count(fact.id)::integer as fact_count
from public.shared_product_observations observation
left join public.product_compatibility_facts fact
	on fact.shared_product_observation_id = observation.id
where observation.source_reference like 'qa-safety-corpus-%'
group by observation.id;

select public.extract_product_compatibility_facts(
	null,
	observation.id,
	null,
	observation.normalized_food,
	'shared_observation_metadata'
)
from public.shared_product_observations observation
where observation.source_reference like 'qa-safety-corpus-%';

select ok(
	not exists (
		select 1
		from food_safety_fact_counts_before before
		join (
			select
				observation.id as observation_id,
				count(fact.id)::integer as fact_count
			from public.shared_product_observations observation
			left join public.product_compatibility_facts fact
				on fact.shared_product_observation_id = observation.id
			where observation.source_reference like 'qa-safety-corpus-%'
			group by observation.id
		) after on after.observation_id = before.observation_id
		where after.fact_count <> before.fact_count
	),
	'corpus extraction is idempotent'
);

select is(
	(
		select count(*)::integer
		from public.shared_product_observations observation
		left join public.product_compatibility_facts fact
			on fact.shared_product_observation_id = observation.id
		where observation.source_reference = 'qa-safety-corpus-empty-evidence'
			and fact.id is not null
	),
	0,
	'missing source evidence never becomes an inferred compatibility fact'
);

select * from finish();

rollback;
