begin;

select plan(14);

select has_table(
	'public',
	'product_ingredient_statements',
	'product ingredient statements are normalized relationally'
);

select has_table(
	'public',
	'product_ingredient_components',
	'product ingredient components are normalized relationally'
);

select has_table(
	'public',
	'food_compatibility_policy_ingredient_relationships',
	'parent and derivative relationships have a review-gated table'
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
	'00000000000314',
	'usda',
	'qa-relational-ingredients',
	'CC0-1.0',
	'{}'::jsonb,
	jsonb_build_object(
		'sourceKey', 'usda',
		'ingredients', 'Milk chocolate (milk, cocoa)',
		'sourceMetadata', jsonb_build_object('language', 'en'),
		'structuredIngredients', jsonb_build_array(
			jsonb_build_object(
				'id', 'milk-chocolate',
				'text', 'Milk chocolate',
				'percent', 60,
				'ingredients', jsonb_build_array(
					jsonb_build_object(
						'id', 'milk',
						'text', 'Milk',
						'percentEstimate', 35
					),
					jsonb_build_object(
						'id', 'cocoa',
						'text', 'Cocoa'
					)
				)
			)
		)
	),
	repeat('a', 64),
	'2026-07-31T12:00:00Z'::timestamptz
);

select public.extract_product_compatibility_facts(
	null,
	(
		select id
		from public.shared_product_observations
		where source_reference = 'qa-relational-ingredients'
	),
	null,
	(
		select normalized_food
		from public.shared_product_observations
		where source_reference = 'qa-relational-ingredients'
	),
	'shared_observation_metadata'
);

select is(
	(
		select count(*)::integer
		from public.product_ingredient_statements statement
		where statement.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-relational-ingredients'
		)
	),
	1,
	'one exact source statement is stored for the observation'
);

select is(
	(
		select statement.extraction_method
		from public.product_ingredient_statements statement
		where statement.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-relational-ingredients'
		)
	),
	'reported-tree',
	'the source tree remains identified as reported structure'
);

select is(
	(
		select count(*)::integer
		from public.product_ingredient_components component
		join public.product_ingredient_statements statement
			on statement.id = component.statement_id
		where statement.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-relational-ingredients'
		)
	),
	3,
	'all nested components are stored without flattening the tree'
);

select is(
	(
		select count(*)::integer
		from public.product_ingredient_components child
		join public.product_ingredient_components parent
			on parent.id = child.parent_component_id
		where child.source_text in ('Milk', 'Cocoa')
			and parent.source_text = 'Milk chocolate'
	),
	2,
	'nested ingredients retain their exact compound parent'
);

select is(
	(
		select percent_exact::numeric
		from public.product_ingredient_components
		where source_text = 'Milk chocolate'
	),
	60::numeric,
	'an explicitly reported exact percentage is retained'
);

select is(
	(
		select percent_estimate::numeric
		from public.product_ingredient_components
		where source_text = 'Milk'
	),
	35::numeric,
	'a source estimate remains distinguishable from an exact percentage'
);

select is(
	(
		select count(*)::integer
		from public.ingredient_terms
		where source_reference = 'qa-relational-ingredients'
	),
	0,
	'source components do not automatically create canonical taxonomy terms'
);

select ok(
	(
		select fact.ingredient_component_id is not null
			and fact.match_rule_id is not null
			and fact.policy_version_id is not null
		from public.product_compatibility_facts fact
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where fact.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-relational-ingredients'
		)
			and tag.slug = 'milk'
			and fact.source_type = 'label_ingredient_field'
		limit 1
	),
	'an ingredient fact links the exact component, DB rule, and policy version'
);

select is(
	(
		select fact.source_text
		from public.product_compatibility_facts fact
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where fact.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-relational-ingredients'
		)
			and tag.slug = 'milk'
			and fact.source_type = 'label_ingredient_field'
		limit 1
	),
	'Milk chocolate',
	'fact evidence retains the complete matched source component wording'
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
	'00000000000321',
	'usda',
	'qa-raw-ingredient-statement',
	'CC0-1.0',
	'{}'::jsonb,
	jsonb_build_object('ingredients', 'Water, natural flavors'),
	repeat('b', 64),
	'2026-07-31T12:00:00Z'::timestamptz
);

select public.sync_product_ingredient_evidence(
	null,
	(
		select id
		from public.shared_product_observations
		where source_reference = 'qa-raw-ingredient-statement'
	),
	null,
	(
		select normalized_food
		from public.shared_product_observations
		where source_reference = 'qa-raw-ingredient-statement'
	)
);

select is(
	(
		select statement.extraction_method
		from public.product_ingredient_statements statement
		where statement.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-raw-ingredient-statement'
		)
	),
	'raw-statement',
	'unstructured source text remains explicitly unparsed'
);

select is(
	(
		select count(*)::integer
		from public.product_ingredient_components component
		join public.product_ingredient_statements statement
			on statement.id = component.statement_id
		where statement.shared_product_observation_id = (
			select id
			from public.shared_product_observations
			where source_reference = 'qa-raw-ingredient-statement'
		)
	),
	0,
	'raw statement punctuation is not guessed into relational ingredients'
);

select * from finish();

rollback;
