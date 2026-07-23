begin;

select plan(11);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'user_food_list_items', 'food-list table exists');
select has_table('public', 'custom_foods', 'custom-food table exists');
select has_table('public', 'shared_products', 'shared catalog table exists');
select has_table('public', 'nutrient_definitions', 'nutrient catalog table exists');
select has_table('public', 'food_image_assets', 'food-image table exists');
select has_table('public', 'generic_food_records', 'generic-food table exists');
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

select * from finish();

rollback;
