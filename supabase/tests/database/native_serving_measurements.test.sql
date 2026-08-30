begin;

select plan(22);

select has_table(
	'public',
	'food_nutrient_measurements',
	'exact nutrient measurements have a dedicated table'
);

select is(
	(select dimension from public.serving_measure_units where key = 'item'),
	'count',
	'item servings are represented as a count dimension'
);

select is(
	(select unit_key from public.serving_measure_aliases where normalized_alias = 'cookie'),
	'item',
	'cookie labels resolve to the item measure'
);

select is(
	(select unit_key from public.serving_measure_aliases where normalized_alias = 'bottle'),
	'item',
	'package count labels resolve without inventing a weight'
);

insert into auth.users (id, aud, role, email)
values (
	'74000000-0000-4000-8000-000000000001',
	'authenticated',
	'authenticated',
	'native-serving@blendcalc.local'
);

select lives_ok(
	$$
		insert into public.custom_foods (
			id,
			user_id,
			fdc_id,
			food,
			category_option_id
		)
		select
			'74000000-0000-4000-8000-000000000002',
			'74000000-0000-4000-8000-000000000001',
			-740001,
			jsonb_build_object(
				'fdcId', -740001,
				'description', 'QA Cookie',
				'customFood', true,
				'categoryOptionId', category.id,
				'foodNutrients', (
					select jsonb_agg(jsonb_build_object(
						'nutrientId', nutrient_id,
						'nutrientName', nutrient_name,
						'unitName', unit_name,
						'value', amount,
						'standardError', case when nutrient_id = 1008 then 3 else null end,
						'measurementBasis', jsonb_build_object(
							'kind', 'serving',
							'quantity', 1,
							'unitKey', 'serving',
							'servingLabel', '2 cookies'
						)
					))
					from (values
						(1008, 'Energy', 'KCAL', 160::numeric),
						(1004, 'Total lipid (fat)', 'G', 0::numeric),
						(1005, 'Carbohydrate, by difference', 'G', 20::numeric),
						(1003, 'Protein', 'G', 2::numeric),
						(1093, 'Sodium, Na', 'MG', 100::numeric)
					) nutrients(nutrient_id, nutrient_name, unit_name, amount)
				),
				'foodServings', jsonb_build_array(jsonb_build_object(
					'label', '2 cookies',
					'amount', 2,
					'unitKey', 'item',
					'isPrimary', true,
					'origin', 'package-label',
					'gramWeightMethod', 'unknown',
					'source', 'user-label',
					'confidence', 'user-reported'
				))
			),
			category.id
		from public.custom_food_category_options category
		where category.enabled
		order by category.id
		limit 1
	$$,
	'a count-based custom food saves without a gram weight'
);

select is(
	(
		select count(*)::integer
		from public.food_nutrient_measurements
		where custom_food_id = '74000000-0000-4000-8000-000000000002'
			and basis_kind = 'serving'
			and basis_quantity = 1
			and basis_serving_label = '2 cookies'
	),
	5,
	'all required nutrients retain the exact package-serving basis'
);

select is(
	(
		select count(*)::integer
		from public.food_nutrients
		where custom_food_id = '74000000-0000-4000-8000-000000000002'
	),
	0,
	'native-only nutrients are not mislabeled as per-100-gram values'
);

select lives_ok(
	$$
		update public.custom_foods custom_food
		set food = jsonb_set(
			custom_food.food,
			'{foodNutrients}',
			(
				select jsonb_agg(nutrient.value - 'unitName' order by nutrient.position)
				from jsonb_array_elements(custom_food.food -> 'foodNutrients')
					with ordinality nutrient(value, position)
			)
		)
		where custom_food.id = '74000000-0000-4000-8000-000000000002'
	$$,
	'legacy nutrient JSON without a repeated unit remains compatible'
);

select is(
	(
		select measurement.unit_name
		from public.food_nutrient_measurements measurement
		where measurement.custom_food_id = '74000000-0000-4000-8000-000000000002'
			and measurement.nutrient_id = 1003
	),
	(
		select upper(definition.default_unit_name)
		from public.nutrient_definitions definition
		where definition.nutrient_id = 1003
	),
	'missing repeated units resolve from the authoritative nutrient definition'
);

select ok(
	(
		select gram_weight is null
			and milliliter_volume is null
			and amount = 2
			and unit_key = 'item'
		from public.food_servings
		where custom_food_id = '74000000-0000-4000-8000-000000000002'
			and is_primary
	),
	'the normalized serving retains an exact count without guessed mass or volume'
);

select lives_ok(
	$$
		update public.custom_foods custom_food
		set food = jsonb_set(
			custom_food.food,
			'{foodServings,0}',
			(custom_food.food #> '{foodServings,0}') || jsonb_build_object(
				'label', '2 cookies (30 g)',
				'gramWeight', 30,
				'gramWeightMethod', 'user-reported'
			)
		)
		where custom_food.id = '74000000-0000-4000-8000-000000000002'
	$$,
	'an exact package gram weight enables a derived per-100-gram projection'
);

select ok(
	(
		select amount_per_100g = 160::numeric * 100 / 30
			and value_origin = 'derived'
			and value_status = 'derived'
			and standard_error = 3::numeric * 100 / 30
			and derivation_method = 'exact-native-basis-to-100g'
		from public.food_nutrients
		where custom_food_id = '74000000-0000-4000-8000-000000000002'
			and nutrient_id = 1008
	),
	'the per-100-gram projection records its exact formula and derived status'
);

select ok(
	(
		select amount = 160
			and basis_kind = 'serving'
			and basis_serving_label = '2 cookies'
		from public.food_nutrient_measurements
		where custom_food_id = '74000000-0000-4000-8000-000000000002'
			and nutrient_id = 1008
	),
	'the original package-serving observation remains authoritative'
);

select lives_ok(
	$$
		update public.custom_foods custom_food
		set food = jsonb_set(
			custom_food.food,
			'{foodServings,0,gramWeight}',
			'40'::jsonb
		)
		where custom_food.id = '74000000-0000-4000-8000-000000000002'
	$$,
	'an updated exact package weight refreshes the derived projection'
);

select is(
	(
		select amount_per_100g
		from public.food_nutrients
		where custom_food_id = '74000000-0000-4000-8000-000000000002'
			and nutrient_id = 1008
	),
	160::numeric * 100 / 40,
	'the per-100-gram projection never retains an outdated package weight'
);

select lives_ok(
	$$
		update public.custom_foods custom_food
		set food = jsonb_set(
			jsonb_set(
				custom_food.food,
				'{foodServings,0}',
				(custom_food.food #> '{foodServings,0}') - 'gramWeight'
			),
			'{foodServings,0,gramWeightMethod}',
			'"unknown"'::jsonb
		)
		where custom_food.id = '74000000-0000-4000-8000-000000000002'
	$$,
	'removing exact package mass evidence invalidates the derived projection'
);

select is(
	(
		select count(*)::integer
		from public.food_nutrients
		where custom_food_id = '74000000-0000-4000-8000-000000000002'
	),
	0,
	'a derived per-100-gram projection disappears when its exact conversion evidence disappears'
);

select lives_ok(
	$$
		insert into public.food_servings (
			owner_user_id,
			custom_food_id,
			serving_order,
			label,
			gram_weight,
			milliliter_volume,
			amount,
			unit_key,
			is_primary,
			source,
			confidence,
			origin,
			gram_weight_method
		)
		values (
			'74000000-0000-4000-8000-000000000001',
			'74000000-0000-4000-8000-000000000002',
			2,
			'240 mL',
			null,
			240,
			240,
			'ml',
			false,
			'user-label',
			'user-reported',
			'package-label',
			'unknown'
		)
	$$,
	'an exact volume serving saves without a density or gram weight'
);

select ok(
	(
		select gram_weight is null and milliliter_volume = 240
		from public.food_servings
		where custom_food_id = '74000000-0000-4000-8000-000000000002'
			and serving_order = 2
	),
	'the database preserves exact milliliters independently of mass'
);

select ok(
	has_table_privilege('service_role', 'public.food_nutrient_measurements', 'select')
		and has_table_privilege('service_role', 'public.food_nutrient_measurements', 'insert')
		and has_table_privilege('service_role', 'public.food_nutrient_measurements', 'update'),
	'the service role can maintain exact nutrient measurements'
);

select ok(
	not has_table_privilege('anon', 'public.food_nutrient_measurements', 'select'),
	'anonymous clients cannot read exact nutrient measurements'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"74000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user"}',
	true
);

select is(
	(
		select count(*)::integer
		from public.food_nutrient_measurements
		where custom_food_id = '74000000-0000-4000-8000-000000000002'
	),
	5,
	'authenticated users can read their own exact nutrient measurements'
);

reset role;

select * from finish();

rollback;
