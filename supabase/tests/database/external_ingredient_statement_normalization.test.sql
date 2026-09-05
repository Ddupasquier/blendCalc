begin;

select plan(12);

select has_function(
	'public',
	'apply_external_ingredient_statement_normalization',
	array['text', 'uuid', 'jsonb', 'jsonb'],
	'external ingredient normalization has one service boundary'
);

select ok(
	has_function_privilege(
		'service_role',
		'public.apply_external_ingredient_statement_normalization(text,uuid,jsonb,jsonb)',
		'EXECUTE'
	),
	'the service worker can apply a reviewed preview'
);

select ok(
	not has_function_privilege(
		'authenticated',
		'public.apply_external_ingredient_statement_normalization(text,uuid,jsonb,jsonb)',
		'EXECUTE'
	)
	and not has_function_privilege(
		'anon',
		'public.apply_external_ingredient_statement_normalization(text,uuid,jsonb,jsonb)',
		'EXECUTE'
	),
	'browser roles cannot invoke the backfill boundary'
);

select throws_ok(
	$$
	select public.apply_external_ingredient_statement_normalization(
		'custom_food',
		gen_random_uuid(),
		'{"description":"Private recipe","ingredients":"My MIX","fieldProvenance":{"ingredients":{"source":"user-label"}}}'::jsonb,
		'{"description":"Private recipe","ingredients":"My mix","ingredientList":["My mix"],"ingredientAnalysis":{"ingredientTags":[],"analysisTags":[],"derivedTraceTags":[],"normalization":{"method":"external-ingredient-statement","version":1,"sourceField":"ingredients","languageCode":"en"}},"fieldProvenance":{"ingredients":{"source":"user-label"}}}'::jsonb
	)
	$$,
	'Only externally sourced ingredient statements can be normalized',
	'user-authored ingredient text is rejected before any write'
);

create temporary table ingredient_normalization_context on commit drop as
select
	product.id,
	product.food as original_food,
	product.food
		|| jsonb_build_object(
			'ingredients', 'DRY ROASTED _PEANUTS_, SALT. MAY CONTAIN SOY.',
			'ingredientList', jsonb_build_array('DRY ROASTED _PEANUTS_', 'SALT'),
			'fieldProvenance',
			coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
				|| jsonb_build_object(
					'ingredients',
					jsonb_build_object('source', 'usda', 'sourceReference', product.source_reference)
				)
		) as expected_food,
	product.food
		|| jsonb_build_object(
			'ingredients', 'Dry roasted peanuts, salt',
			'ingredientList', jsonb_build_array('Dry roasted peanuts', 'salt'),
			'fieldProvenance',
			coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
				|| jsonb_build_object(
					'ingredients',
					jsonb_build_object('source', 'usda', 'sourceReference', product.source_reference)
				),
			'ingredientAnalysis',
			coalesce(product.food -> 'ingredientAnalysis', '{}'::jsonb)
			|| jsonb_build_object(
				'ingredientTags', '[]'::jsonb,
				'analysisTags', '[]'::jsonb,
				'derivedTraceTags', '[]'::jsonb,
				'normalization', jsonb_build_object(
					'method', 'external-ingredient-statement',
					'version', 1,
					'sourceField', 'ingredients',
					'languageCode', 'en'
				),
				'allergenDeclarationAnalysis', jsonb_build_object(
					'method', 'bounded-ingredient-label-pattern',
					'sourceField', 'ingredients',
					'languageCode', 'en',
					'languageStatus', 'supported',
					'extractionStatus', 'parsed',
					'contains', '[]'::jsonb,
					'mayContain', jsonb_build_array('Soy'),
					'statements', jsonb_build_array(jsonb_build_object(
						'type', 'may_contain',
						'text', 'MAY CONTAIN SOY',
						'allergens', jsonb_build_array('Soy')
					))
				)
			),
			'precautionaryStatements',
			coalesce(product.food -> 'precautionaryStatements', '[]'::jsonb)
			|| jsonb_build_array(jsonb_build_object(
				'type', 'may_contain',
				'text', 'MAY CONTAIN SOY',
				'allergens', jsonb_build_array('Soy'),
				'sourceField', 'ingredients',
				'languageCode', 'en'
			))
		) as normalized_food,
	(
		select count(*)
		from public.shared_product_revisions revision
		where revision.shared_product_id = product.id
	) as revision_count
from public.shared_products product
where product.status = 'active'
	and product.confidence <> 'moderator-reviewed'
	and product.category_option_id is not null
	and exists (
		select 1
		from public.shared_product_revisions revision
		where revision.shared_product_id = product.id
	)
limit 1;

select is(
	(select count(*)::integer from ingredient_normalization_context),
	1,
	'the local catalog supplies an imported normalization fixture'
);

update public.shared_products product
set food = context.expected_food
from ingredient_normalization_context context
where product.id = context.id;

select is(
	public.apply_external_ingredient_statement_normalization(
		'shared_product',
		context.id,
		context.expected_food,
		context.normalized_food
	),
	'updated',
	'the exact preview is applied atomically'
)
from ingredient_normalization_context context;

select is(
	(
		select product.food ->> 'ingredients'
		from public.shared_products product
		join ingredient_normalization_context context on context.id = product.id
	),
	'Dry roasted peanuts, salt',
	'the canonical ingredient statement is normalized'
);

select is(
	(
		select (product.food #>> '{ingredientAnalysis,normalization,version}')::integer
		from public.shared_products product
		join ingredient_normalization_context context on context.id = product.id
	),
	1,
	'the canonical snapshot records the normalization version'
);

select is(
	(
		select count(*)
		from public.shared_product_revisions revision
		join ingredient_normalization_context context
			on context.id = revision.shared_product_id
	),
	(select revision_count + 1 from ingredient_normalization_context),
	'normalization appends one immutable revision'
);

select ok(
	exists (
		select 1
		from public.shared_product_revisions revision
		join ingredient_normalization_context context
			on context.id = revision.shared_product_id
		where revision.food = context.normalized_food
			and revision.supersedes_revision_id is not null
			and revision.change_summary #>> '{changes,0,field}' = 'ingredients'
	),
	'the appended revision explains and links the change'
);

select throws_ok(
	format(
		$$select public.apply_external_ingredient_statement_normalization('shared_product', %L, %L::jsonb, %L::jsonb)$$,
		context.id,
		context.normalized_food,
		context.normalized_food || jsonb_build_object('description', 'Changed by backfill')
	),
	'Ingredient normalization changed unrelated food fields',
	'unrelated fields cannot be changed by the normalization boundary'
)
from ingredient_normalization_context context;

select is(
	public.apply_external_ingredient_statement_normalization(
		'shared_product',
		context.id,
		context.normalized_food,
		context.normalized_food
	),
	'unchanged',
	'a repeated application is idempotent'
)
from ingredient_normalization_context context;

select * from finish();

rollback;
