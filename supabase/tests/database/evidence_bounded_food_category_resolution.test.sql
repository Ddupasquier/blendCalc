begin;

select plan(27);

select has_table(
	'public',
	'food_category_resolution_guidance',
	'evidence-bounded category guidance has one durable owner'
);

select ok(
	(select count(*) from public.food_category_resolution_guidance
		where enabled) >= 18,
	'the initial evidence-bumper corpus is available'
);

select ok(
	not exists (
		select 1
		from information_schema.columns
		where table_schema = 'public'
			and table_name = 'food_category_resolution_guidance'
			and column_name like 'target%'
	),
	'category guidance cannot silently remap source evidence to another category'
);

select ok(
	not has_table_privilege(
		'anon',
		'public.food_category_resolution_guidance',
		'SELECT'
	),
	'anonymous clients cannot read category resolution guidance'
);

select has_function(
	'private',
	'repair_provider_food_categories',
	array[]::text[],
	'existing provider-derived foods have one reusable repair boundary'
);

select ok(
	not has_function_privilege(
		'authenticated',
		'private.repair_provider_food_categories()',
		'EXECUTE'
	),
	'authenticated clients cannot run the stored-category repair'
);

select ok(
	has_function_privilege(
		'service_role',
		'private.repair_provider_food_categories()',
		'EXECUTE'
	),
	'the service role can run the controlled stored-category repair'
);

select is(
	(
		select resolved.category_option_label
		from public.resolve_custom_food_category_option_with_symbol(array[
			'en:dressings-and-sauces',
			'en:syrups',
			'en:dessert-sauces',
			'en:chocolate-sauce'
		]) resolved
	),
	'Chocolate Sauce',
	'Hershey-style chocolate syrup resolves to the most specific exact source category'
);

select is(
	(
		select resolved.source_normalized_value
		from public.resolve_custom_food_category_option_with_symbol(array[
			'en:dressings-and-sauces',
			'en:syrups',
			'en:dessert-sauces',
			'en:chocolate-sauce'
		]) resolved
	),
	'chocolate sauce',
	'the selected Hershey category is literally present in its source evidence'
);

select is(
	(
		select count(*)
		from public.resolve_custom_food_category_option_with_symbol(array['en:groceries'])
	),
	0::bigint,
	'a provider navigation bucket cannot masquerade as a food category'
);

select is(
	(
		select resolved.category_option_label
		from public.resolve_custom_food_category_option_with_symbol(array[
			'en:sweets',
			'en:sweet-spreads',
			'en:Pâtes à tartiner'
		]) resolved
	),
	'Sweet Spreads',
	'Nutella resolves to its specific source-observed spread category'
);

select is(
	(
		select cache.response #>> '{product,image_front_url}'
		from public.product_api_cache cache
		where cache.provider = 'open-food-facts'
			and cache.cache_key = 'ba7576c00c230ec7214aea6b9a4b05c58331ec1f6b7a7d9118cc4c5650bc6516'
	),
	'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.879.400.jpg',
	'the deterministic Nutella lookup retains the source front image used by staging'
);

select is(
	(
		select resolved.category_option_label
		from public.resolve_custom_food_category_option_with_symbol(array[
			'Dips and Salsa',
			'en:condiments',
			'en:sauces',
			'en:hot-sauces',
			'en:gochujang'
		]) resolved
	),
	'Gochujang',
	'gochujang resolves to its exact product type instead of a broad merchandising bucket'
);

select is(
	(
		select resolved.symbol_key
		from public.resolve_custom_food_category_option_with_symbol(array[
			'Dips and Salsa',
			'en:gochujang'
		]) resolved
	),
	'sauces-condiments',
	'the specific Gochujang category carries the broader presentation family'
);

select is(
	(
		select product.category_option_id
		from public.shared_products product
		where product.barcode = '08801005523455'
	),
	'gochujang',
	'the maintained existing Gochujang catalog fixture uses the specific category'
);

select is(
	(
		select product.food ->> 'foodCategory'
		from public.shared_products product
		where product.barcode = '08801005523455'
	),
	'Gochujang',
	'the existing Gochujang food payload uses the corrected category label'
);

select ok(
	(
		select product.food -> 'categories' @> '["Dips and Salsa", "gochujang"]'::jsonb
		from public.shared_products product
		where product.barcode = '08801005523455'
	),
	'the current canonical category does not discard original provider category evidence'
);

select ok(
	not exists (
		select 1
		from public.shared_product_revisions revision
		join public.shared_products product on product.id = revision.shared_product_id
		where product.barcode = '08801005523455'
			and revision.category_option_id <> 'gochujang'
	),
	'the maintained Gochujang revision fixture agrees with the current canonical category'
);

create temporary table category_repair_test_state on commit drop as
select
	product.id as shared_product_id,
	product.approved_submission_id,
	product.food as shared_food,
	(select count(*) from public.shared_product_revisions revision
		where revision.shared_product_id = product.id) as revision_count,
	(select id from public.custom_food_category_options
		where normalized_value = 'dips and salsa' and enabled limit 1) as old_category_id,
	(select id from public.custom_food_category_options
		where normalized_value = 'gochujang' and enabled limit 1) as specific_category_id,
	(select id from auth.users where email = 'qa-empty@blendcalc.local') as shared_user_id,
	(select id from auth.users where email = 'qa-onboarding@blendcalc.local') as custom_user_id
from public.shared_products product
where product.barcode = '08801005523455';

update public.shared_product_submissions submission
set
	category_option_id = state.old_category_id,
	food = jsonb_set(
		jsonb_set(
			jsonb_set(
				submission.food,
				'{categoryOptionId}',
				to_jsonb(state.old_category_id),
				true
			),
			'{foodCategory}',
			to_jsonb('Dips and Salsa'::text),
			true
		),
		'{fieldProvenance,categories}',
		'{"source":"usda","confidence":"imported"}'::jsonb,
		true
	)
from category_repair_test_state state
where submission.id = state.approved_submission_id;

update public.shared_products product
set
	category_option_id = state.old_category_id,
	food = jsonb_set(
		jsonb_set(
			jsonb_set(
				product.food,
				'{categoryOptionId}',
				to_jsonb(state.old_category_id),
				true
			),
			'{foodCategory}',
			to_jsonb('Dips and Salsa'::text),
			true
		),
		'{categories}',
		'["Dips and Salsa","sauces","hot sauces","gochujang"]'::jsonb,
		true
	) || jsonb_build_object(
		'fieldProvenance',
		coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
			|| '{"categories":{"source":"usda","confidence":"imported"}}'::jsonb
	)
from category_repair_test_state state
where product.id = state.shared_product_id;

insert into public.user_food_list_items (
	id,
	user_id,
	list_type,
	fdc_id,
	food,
	shared_product_id
)
select
	'94000000-0000-4000-8000-000000000001',
	state.shared_user_id,
	'fridge',
	(food ->> 'fdcId')::integer,
	food,
	state.shared_product_id
from category_repair_test_state state
join public.shared_products product on product.id = state.shared_product_id;

insert into public.custom_foods (
	id,
	user_id,
	fdc_id,
	food,
	category_option_id
)
select
	'94000000-0000-4000-8000-000000000002',
	state.custom_user_id,
	-9400008,
	(
		product.food - 'barcode' - 'gtinUpc'
		|| jsonb_build_object(
			'fdcId', -9400008,
			'description', 'QA Existing Provider Gochujang',
			'categoryOptionId', state.old_category_id,
			'foodCategory', 'Dips and Salsa',
			'categories', jsonb_build_array('Dips and Salsa', 'sauces', 'hot sauces', 'gochujang'),
			'sourceKey', 'usda',
			'trustStatus', 'imported',
			'fieldProvenance', coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
				|| '{"categories":{"source":"usda","confidence":"imported"}}'::jsonb
		)
	),
	state.old_category_id
from category_repair_test_state state
join public.shared_products product on product.id = state.shared_product_id;

insert into public.user_food_list_items (
	id,
	user_id,
	list_type,
	fdc_id,
	food
)
select
	'94000000-0000-4000-8000-000000000003',
	custom_food.user_id,
	'fridge',
	custom_food.fdc_id,
	custom_food.food
from public.custom_foods custom_food
where custom_food.id = '94000000-0000-4000-8000-000000000002';

insert into public.custom_foods (
	id,
	user_id,
	fdc_id,
	food,
	category_option_id
)
select
	'94000000-0000-4000-8000-000000000004',
	state.custom_user_id,
	-9400009,
	(
		product.food - 'barcode' - 'gtinUpc'
		|| jsonb_build_object(
			'fdcId', -9400009,
			'description', 'QA User Categorized Gochujang',
			'categoryOptionId', state.old_category_id,
			'foodCategory', 'Dips and Salsa',
			'categories', jsonb_build_array('Dips and Salsa', 'sauces', 'gochujang'),
			'sourceKey', 'user',
			'trustStatus', 'user-reported',
			'fieldProvenance', coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
				|| '{"categories":{"source":"user-label","confidence":"user-reported"}}'::jsonb
		)
	),
	state.old_category_id
from category_repair_test_state state
join public.shared_products product on product.id = state.shared_product_id;

select is(
	(private.repair_provider_food_categories() ->> 'sharedProducts')::integer,
	1,
	'the repair identifies the existing provider-derived shared product'
);

select is(
	(
		select product.category_option_id
		from public.shared_products product
		join category_repair_test_state state on state.shared_product_id = product.id
	),
	(
		select state.specific_category_id
		from category_repair_test_state state
	),
	'the repair updates the current shared product category'
);

select is(
	(
		select item.food ->> 'foodCategory'
		from public.user_food_list_items item
		where item.id = '94000000-0000-4000-8000-000000000001'
	),
	'Gochujang',
	'the repair updates saved snapshots linked to the shared product'
);

select is(
	(
		select custom_food.food ->> 'foodCategory'
		from public.custom_foods custom_food
		where custom_food.id = '94000000-0000-4000-8000-000000000002'
	),
	'Gochujang',
	'the repair updates existing provider-derived private foods'
);

select is(
	(
		select item.food ->> 'foodCategory'
		from public.user_food_list_items item
		where item.id = '94000000-0000-4000-8000-000000000003'
	),
	'Gochujang',
	'the repair updates saved snapshots linked by private food identity'
);

select is(
	(
		select count(*)
		from public.shared_product_revisions revision
		join category_repair_test_state state
			on state.shared_product_id = revision.shared_product_id
	),
	(
		select state.revision_count + 1
		from category_repair_test_state state
	),
	'the repair appends one category correction revision without rewriting history'
);

select is(
	(
		select custom_food.food ->> 'foodCategory'
		from public.custom_foods custom_food
		where custom_food.id = '94000000-0000-4000-8000-000000000004'
	),
	'Dips and Salsa',
	'the repair does not overwrite a category deliberately supplied by the user'
);

select is(
	private.repair_provider_food_categories(),
	'{"sharedProducts": 0, "customFoods": 0}'::jsonb,
	'rerunning the existing-data repair is an idempotent no-op'
);

select is(
	(
		select count(*)
		from public.shared_product_revisions revision
		join category_repair_test_state state
			on state.shared_product_id = revision.shared_product_id
	),
	(
		select state.revision_count + 1
		from category_repair_test_state state
	),
	'the idempotent rerun does not append a duplicate revision'
);

select * from finish();

rollback;
