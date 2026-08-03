begin;

select plan(12);

insert into auth.users (id, aud, role, email)
values (
	'73000000-0000-4000-8000-000000000001',
	'authenticated',
	'authenticated',
	'authoritative-custom-food@blendcalc.local'
);

create function pg_temp.qa_custom_food(
	p_fdc_id bigint,
	p_description text,
	p_carbohydrates numeric,
	p_sugars numeric
)
returns jsonb
language sql
stable
set search_path = ''
as $$
	select jsonb_build_object(
		'fdcId', p_fdc_id,
		'description', p_description,
		'customFood', true,
		'customServingWeightGrams', 100,
		'categoryOptionId', category.id,
		'categories', jsonb_build_array(category.label),
		'foodNutrients', jsonb_build_array(
			jsonb_build_object('nutrientId', 1008, 'value', 52),
			jsonb_build_object('nutrientId', 1004, 'value', 0),
			jsonb_build_object('nutrientId', 1005, 'value', p_carbohydrates),
			jsonb_build_object('nutrientId', 1003, 'value', 0),
			jsonb_build_object('nutrientId', 1093, 'value', 0),
			jsonb_build_object('nutrientId', 2000, 'value', p_sugars)
		)
	)
	from public.custom_food_category_options category
	where category.enabled
	order by category.id
	limit 1
$$;

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user"}',
	true
);

select is(
	public.save_custom_food(
		-730001,
		pg_temp.qa_custom_food(-730001, 'Backend QA Apple', 14, 0)
	),
	'saved',
	'a valid custom food saves through the authoritative function'
);

select is(
	(
		select count(*)::integer
		from public.custom_foods food
		where food.user_id = auth.uid()
			and food.name_key = 'backend qa apple'
	),
	1,
	'the custom food is stored exactly once'
);

select ok(
	(
		select food.category_option_id is not null
			and food.category_option_id = food.food ->> 'categoryOptionId'
		from public.custom_foods food
		where food.user_id = auth.uid()
			and food.fdc_id = -730001
	),
	'the selected canonical category is retained in the row and food payload'
);

select ok(
	(
		select count(*) = 3
		from public.custom_foods food
		cross join lateral jsonb_array_elements(food.food -> 'foodNutrients') nutrient
		where food.user_id = auth.uid()
			and food.fdc_id = -730001
			and (nutrient ->> 'nutrientId')::bigint in (1003, 1004, 1093)
			and (nutrient ->> 'value')::numeric = 0
	),
	'explicitly reported zero protein, fat, and sodium values remain zero'
);

select is(
	public.save_custom_food(
		-730002,
		pg_temp.qa_custom_food(-730002, '  BACKEND   qa apple  ', 14, 0)
	),
	'duplicate-name',
	'case and repeated whitespace cannot create a duplicate custom food'
);

select is(
	(
		select count(*)::integer
		from public.custom_foods food
		where food.user_id = auth.uid()
			and food.name_key = 'backend qa apple'
	),
	1,
	'the normalized duplicate attempt leaves one stored row'
);

select throws_ok(
	$$
		select public.save_custom_food(
			-730003,
			pg_temp.qa_custom_food(-730003, 'Backend QA Sugar Rule', 5, 8)
		)
	$$,
	'22023',
	'NUTRIENT_CHILD_EXCEEDS_PARENT',
	'the database rejects total sugars above total carbohydrates with the stable issue code'
);

select is(
	(
		select count(*)::integer
		from public.custom_foods food
		where food.user_id = auth.uid()
			and food.fdc_id = -730003
	),
	0,
	'the rejected nutrition relationship creates no custom-food row'
);

select is(
	public.save_custom_food(
		-730003,
		pg_temp.qa_custom_food(-730003, 'Backend QA Sugar Rule', 5, 4)
	),
	'saved',
	'the corrected total-sugars value saves successfully'
);

select is(
	(
		select count(*)::integer
		from public.custom_foods food
		where food.user_id = auth.uid()
			and food.fdc_id = -730003
	),
	1,
	'the corrected custom food is stored exactly once'
);

select is(
	public.save_custom_food(
		-730004,
		pg_temp.qa_custom_food(-730004, 'QA Serving Test', 0, 0)
			|| jsonb_build_object(
				'customServingWeightGrams', 32,
				'customServingLabel', '2 tbsp',
				'hasSourceServing', true,
				'fieldProvenance', jsonb_build_object(
					'serving', jsonb_build_object(
						'source', 'user-label',
						'confidence', 'user-reported'
					)
				),
				'foodServings', jsonb_build_array(
					jsonb_build_object(
						'label', '2 tbsp',
						'gramWeight', 32,
						'amount', 2,
						'unitKey', 'tbsp',
						'isPrimary', true,
						'origin', 'user-entered',
						'gramWeightMethod', 'user-reported',
						'source', 'user-label',
						'confidence', 'user-reported'
					)
				)
			)
	),
	'saved',
	'an explicit user weight and volume pair saves successfully'
);

select ok(
	(
		select serving.label = '2 tbsp'
			and serving.gram_weight = 32
			and serving.amount = 2
			and serving.unit_key = 'tbsp'
			and serving.is_primary
			and serving.origin = 'user-entered'
			and serving.gram_weight_method = 'user-reported'
			and serving.source = 'user-label'
			and serving.confidence = 'user-reported'
		from public.custom_foods food
		join public.food_servings serving on serving.custom_food_id = food.id
		where food.user_id = auth.uid()
			and food.fdc_id = -730004
	),
	'the normalized serving projection retains exact user-entered lineage'
);

reset role;

select * from finish();

rollback;
