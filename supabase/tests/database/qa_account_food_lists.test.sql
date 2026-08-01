begin;

select plan(8);

select is(
	(
		select count(*)
		from public.user_food_list_items item
		join auth.users user_row on user_row.id = item.user_id
		where user_row.email in (
			'qa-user@blendcalc.local',
			'qa-moderator@blendcalc.local',
			'qa-admin@blendcalc.local'
		)
	),
	15::bigint,
	'each local QA account receives five ingredient-list fixtures'
);

select ok(
	not exists (
		select user_row.id
		from auth.users user_row
		left join public.user_food_list_items item on item.user_id = user_row.id
		where user_row.email in (
			'qa-user@blendcalc.local',
			'qa-moderator@blendcalc.local',
			'qa-admin@blendcalc.local'
		)
		group by user_row.id
		having count(item.id) <> 5
	),
	'every local QA account has the complete ingredient fixture set'
);

select ok(
	not exists (
		select user_row.id
		from auth.users user_row
		left join public.user_food_list_items item
			on item.user_id = user_row.id
			and item.list_type = 'fridge'
		where user_row.email in (
			'qa-user@blendcalc.local',
			'qa-moderator@blendcalc.local',
			'qa-admin@blendcalc.local'
		)
		group by user_row.id
		having count(item.id) <> 3
	),
	'every local QA account starts with three Fridge ingredients'
);

select ok(
	not exists (
		select user_row.id
		from auth.users user_row
		left join public.user_food_list_items item
			on item.user_id = user_row.id
			and item.list_type = 'shopping'
		where user_row.email in (
			'qa-user@blendcalc.local',
			'qa-moderator@blendcalc.local',
			'qa-admin@blendcalc.local'
		)
		group by user_row.id
		having count(item.id) <> 2
	),
	'every local QA account starts with two Shopping List ingredients'
);

select ok(
	not exists (
		select 1
		from auth.users user_row
		cross join (
			values
				('00021130462506'),
				('00021130493609'),
				('08801005523455'),
				('00869759000149'),
				('00011110904416')
		) expected(barcode)
		where user_row.email in (
			'qa-user@blendcalc.local',
			'qa-moderator@blendcalc.local',
			'qa-admin@blendcalc.local'
		)
			and not exists (
				select 1
				from public.user_food_list_items item
				where item.user_id = user_row.id
					and public.food_normalized_barcode(item.food) = expected.barcode
			)
	),
	'every local QA account receives every expected barcode fixture'
);

select ok(
	not exists (
		select 1
		from public.user_food_list_items item
		join auth.users user_row on user_row.id = item.user_id
		where user_row.email in (
			'qa-user@blendcalc.local',
			'qa-moderator@blendcalc.local',
			'qa-admin@blendcalc.local'
		)
			and (
				item.shared_product_id is null
				or item.source_key <> 'shared-catalog'
				or item.trust_status <> 'moderator-reviewed'
			)
	),
	'local QA account ingredients retain approved shared-catalog state'
);

select ok(
	not exists (
		select 1
		from public.user_food_list_items item
		join auth.users user_row on user_row.id = item.user_id
		where user_row.email in (
			'qa-user@blendcalc.local',
			'qa-moderator@blendcalc.local',
			'qa-admin@blendcalc.local'
		)
			and not exists (
				select 1
				from public.food_nutrients nutrient
				where nutrient.user_food_list_item_id = item.id
			)
	),
	'local QA account ingredients receive normalized nutrients'
);

select ok(
	not exists (
		select 1
		from public.user_food_list_items item
		join auth.users user_row on user_row.id = item.user_id
		where user_row.email in (
			'qa-user@blendcalc.local',
			'qa-moderator@blendcalc.local',
			'qa-admin@blendcalc.local'
		)
			and (
				(
					public.food_normalized_barcode(item.food) = '00011110904416'
					and exists (
						select 1
						from public.food_servings serving
						where serving.user_food_list_item_id = item.id
					)
				)
				or (
					public.food_normalized_barcode(item.food) <> '00011110904416'
					and not exists (
						select 1
						from public.food_servings serving
						where serving.user_food_list_item_id = item.id
					)
				)
			)
	),
	'local QA account ingredients preserve reported-serving and no-serving cases'
);

select * from finish();

rollback;
