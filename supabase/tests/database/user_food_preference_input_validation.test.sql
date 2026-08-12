begin;

select plan(10);

select has_function(
	'public',
	'validate_user_food_preference_inputs',
	'Food preference input validation is installed'
);

insert into auth.users (id, aud, role, email)
values (
	'73000000-0000-4000-8000-000000000010',
	'authenticated',
	'authenticated',
	'food-preference-validation@blendcalc.local'
);

select lives_ok(
	$$
		insert into public.user_food_preferences (
			user_id,
			allergens,
			dietary_restrictions,
			prioritized_nutrient_ids,
			default_smoothie_serving_grams,
			sensitive_acknowledged_at
		)
		values (
			'73000000-0000-4000-8000-000000000010',
			array['peanut', 'shellfish, molluscs'],
			array['vegan'],
			array[1008, 1003],
			350,
			now()
		)
	$$,
	'Valid reviewed and exact custom preference wording is accepted'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"73000000-0000-4000-8000-000000000010","role":"authenticated","app_role":"user"}',
	true
);

select lives_ok(
	$$
		update public.user_food_preferences
		set dietary_restrictions = array['vegan', 'gluten-free']
		where user_id = auth.uid()
	$$,
	'Owner-scoped authenticated writes still pass database validation'
);

select throws_ok(
	$$
		update public.user_food_preferences
		set allergens = array['peanut', ' Peanut  ']
		where user_id = '73000000-0000-4000-8000-000000000010'
	$$,
	'23514',
	'Allergen preferences must not contain duplicate values.',
	'Normalized duplicate allergens are rejected'
);

select throws_ok(
	$$
		update public.user_food_preferences
		set dietary_restrictions = array[repeat('x', 61)]
		where user_id = '73000000-0000-4000-8000-000000000010'
	$$,
	'23514',
	'Food preference entries must contain 1 to 60 characters.',
	'Oversized custom preference wording is rejected'
);

select throws_ok(
	$$
		update public.user_food_preferences
		set prioritized_nutrient_ids = array[1008, 1008]
		where user_id = '73000000-0000-4000-8000-000000000010'
	$$,
	'23514',
	'Priority nutrients must not contain duplicate values.',
	'Duplicate priority nutrients are rejected'
);

select throws_ok(
	$$
		update public.user_food_preferences
		set prioritized_nutrient_ids = array[999999]
		where user_id = '73000000-0000-4000-8000-000000000010'
	$$,
	'23514',
	'Priority nutrients must come from the active Mix display profile.',
	'Priority nutrients outside the database profile are rejected'
);

select throws_ok(
	$$
		update public.user_food_preferences
		set default_smoothie_serving_grams = 5000.01
		where user_id = '73000000-0000-4000-8000-000000000010'
	$$,
	'23514',
	'Default Mix serving size must not exceed 5,000 grams.',
	'Oversized serving defaults are rejected'
);

select throws_ok(
	$$
		update public.user_food_preferences
		set sensitive_acknowledged_at = null
		where user_id = '73000000-0000-4000-8000-000000000010'
	$$,
	'23514',
	'Food preference acknowledgement is required before saving preferences.',
	'Preference values cannot be saved without acknowledgement'
);

select ok(
	not has_function_privilege(
		'authenticated',
		'public.validate_user_food_preference_inputs()',
		'EXECUTE'
	),
	'Authenticated clients cannot execute the validation trigger directly'
);

select * from finish();

rollback;
