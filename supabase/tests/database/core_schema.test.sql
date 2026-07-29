begin;

select plan(21);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'user_food_list_items', 'food-list table exists');
select has_table('public', 'custom_foods', 'custom-food table exists');
select has_table('public', 'shared_products', 'shared catalog table exists');
select has_table('public', 'nutrient_definitions', 'nutrient catalog table exists');
select has_table('public', 'food_image_assets', 'food-image table exists');
select has_table('public', 'generic_food_records', 'generic-food table exists');
select has_table(
	'public',
	'nutrient_relationship_rules',
	'nutrient-relationship rules table exists'
);
select ok(
	exists (
		select 1
		from public.nutrient_relationship_rules
		where enabled
	),
	'local QA validation rules are enabled'
);
select ok(
	exists (
		select 1
		from public.custom_food_category_options
		where normalized_value = 'nut and seed butters'
			and enabled
	),
	'local QA category fixtures include nut and seed butters'
);
select ok(
	(select relrowsecurity from pg_class where oid = 'public.user_food_list_items'::regclass),
	'food-list RLS is enabled'
);
select ok(
	(select relrowsecurity from pg_class where oid = 'public.custom_foods'::regclass),
	'custom-food RLS is enabled'
);
select has_function('public', 'save_custom_food', 'authoritative custom-food save exists');
select has_function('public', 'move_user_food_list_items', 'atomic bulk-list move exists');
select has_view(
	'public',
	'food_compatibility_policy_coverage',
	'food-compatibility policy coverage view exists'
);
select ok(
	not exists (
		select 1
		from public.food_compatibility_policy_coverage
		where category = 'dietary'
			and selectable
			and conflict_count = 0
	),
	'every selectable dietary preference has conflict policy'
);
select ok(
	exists (
		select 1
		from public.compatibility_rule_conflicts conflict
		join public.compatibility_tags preference
			on preference.id = conflict.preference_tag_id
		join public.compatibility_tags fact
			on fact.id = conflict.fact_tag_id
		where preference.slug = 'vegan'
			and fact.slug = 'meat'
			and conflict.severity = 'warning'
	),
	'vegan policy covers land-animal meat'
);
select ok(
	exists (
		select 1
		from public.compatibility_rule_conflicts conflict
		join public.compatibility_tags preference
			on preference.id = conflict.preference_tag_id
		where preference.slug = 'halal'
	),
	'halal is not exposed without conflict policy'
);
select ok(
	exists (
		select 1
		from public.food_compatibility_match_rules rule
		join public.compatibility_tags tag
			on tag.id = rule.tag_id
		where rule.enabled
			and tag.slug = 'meat'
			and rule.field_name = 'generic_food_identity'
			and rule.source_type = 'food_identity_taxonomy'
	),
	'authoritative generic foods have DB-backed meat evidence'
);
select ok(
	exists (
		select 1
		from public.food_compatibility_match_rules rule
		join public.compatibility_tags tag
			on tag.id = rule.tag_id
		where rule.enabled
			and tag.slug = 'shellfish'
			and rule.field_name = 'allergens'
			and rule.source_type = 'label_allergen_field'
	),
	'provider allergen aliases are canonicalized by DB policy'
);
select ok(
	not exists (
		select 1
		from public.food_compatibility_match_rules
		where enabled
			and field_name not in (
				'ingredients',
				'generic_food_identity',
				'allergens',
				'traces',
				'ingredient_analysis'
			)
	),
	'packaged names, brands, and categories cannot become warning evidence'
);

select * from finish();

rollback;
