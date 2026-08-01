begin;

select plan(21);

select is(
	(select count(*) from auth.users where email like 'qa-%@blendcalc.local'),
	6::bigint,
	'the isolated database contains all six QA personas'
);

select ok(
	exists (
		select 1 from auth.users user_row
		join public.app_role_assignments role on role.user_id = user_row.id
		where user_row.email = 'qa-moderator@blendcalc.local' and role.role = 'moderator'
	)
	and exists (
		select 1 from auth.users user_row
		join public.app_role_assignments role on role.user_id = user_row.id
		where user_row.email = 'qa-admin@blendcalc.local' and role.role = 'admin'
	),
	'moderator and admin personas receive their elevated roles'
);

select ok(
	not exists (
		with expected(email, fridge_count, shopping_count) as (
			values
				('qa-user@blendcalc.local', 15, 4),
				('qa-preferences@blendcalc.local', 4, 3),
				('qa-empty@blendcalc.local', 0, 0),
				('qa-onboarding@blendcalc.local', 10, 0),
				('qa-moderator@blendcalc.local', 3, 3),
				('qa-admin@blendcalc.local', 3, 3)
		)
		select expected.email
		from expected
		join auth.users user_row on user_row.email = expected.email
		left join public.user_food_list_items item on item.user_id = user_row.id
		group by expected.email, expected.fridge_count, expected.shopping_count
		having count(item.id) filter (where item.list_type = 'fridge') <> expected.fridge_count
			or count(item.id) filter (where item.list_type = 'shopping') <> expected.shopping_count
	),
	'each persona has its purpose-built Fridge and Shopping List state'
);

select ok(
	not exists (
		select 1
		from public.user_food_list_items item
		join auth.users user_row on user_row.id = item.user_id
		where user_row.email like 'qa-%@blendcalc.local'
			and (
				item.shared_product_id is null
				or item.source_key <> 'shared-catalog'
				or item.trust_status <> 'moderator-reviewed'
			)
	),
	'all QA list ingredients retain approved shared-catalog identity'
);

select ok(
	not exists (
		select 1
		from public.user_food_list_items item
		join auth.users user_row on user_row.id = item.user_id
		where user_row.email like 'qa-%@blendcalc.local'
			and not exists (
				select 1 from public.food_nutrients nutrient
				where nutrient.user_food_list_item_id = item.id
			)
	),
	'all QA list ingredients have normalized nutrient rows'
);

select ok(
	not exists (
		select 1
		from public.user_food_list_items item
		join auth.users user_row on user_row.id = item.user_id
		where user_row.email like 'qa-%@blendcalc.local'
			and public.food_normalized_barcode(item.food) <> '00011110904416'
			and not exists (
				select 1 from public.food_servings serving
				where serving.user_food_list_item_id = item.id
			)
	),
	'all reported-serving fixtures hydrate normalized serving rows'
);

select ok(
	not exists (
		select 1
		from public.user_food_list_items item
		join auth.users user_row on user_row.id = item.user_id
		where user_row.email like 'qa-%@blendcalc.local'
			and public.food_normalized_barcode(item.food) = '00011110904416'
			and exists (
				select 1 from public.food_servings serving
				where serving.user_food_list_item_id = item.id
			)
	),
	'the explicit no-serving fixture remains free of fabricated serving rows'
);

select is(
	(
		select count(*) from public.saved_drinks drink
		join auth.users user_row on user_row.id = drink.user_id
		where user_row.email = 'qa-user@blendcalc.local'
	),
	4::bigint,
	'the populated persona has four Saved mixes'
);

select ok(
	not exists (
		select expected.name
		from (values
			('QA Morning Green'),
			('QA Berry Repeat'),
			('QA Export Berry Mix'),
			('QA Server Load')
		) expected(name)
		where not exists (
			select 1 from public.saved_drinks drink
			join auth.users user_row on user_row.id = drink.user_id
			where user_row.email = 'qa-user@blendcalc.local'
				and drink.name = expected.name
		)
	),
	'the populated persona includes every named Saved QA fixture'
);

select is(
	(
		select jsonb_array_length(drink.drink -> 'foods')
		from public.saved_drinks drink
		join auth.users user_row on user_row.id = drink.user_id
		where user_row.email = 'qa-user@blendcalc.local'
			and drink.name = 'QA Morning Green'
	),
	10,
	'QA Morning Green exercises the more-than-eight ingredient collapse'
);

select ok(
	exists (
		select 1 from public.mix_preferences mix
		join auth.users user_row on user_row.id = mix.user_id
		where user_row.email = 'qa-user@blendcalc.local'
			and jsonb_array_length(mix.mix_state -> 'selectedFoodIds') = 10
	)
	and exists (
		select 1 from public.mix_preferences mix
		join auth.users user_row on user_row.id = mix.user_id
		where user_row.email = 'qa-onboarding@blendcalc.local'
			and jsonb_array_length(mix.mix_state -> 'selectedFoodIds') = 10
	),
	'populated and onboarding personas begin with a usable active Mix'
);

select ok(
	not exists (
		select 1
		from auth.users user_row
		left join public.user_food_list_items item on item.user_id = user_row.id
		left join public.saved_drinks drink on drink.user_id = user_row.id
		left join public.mix_preferences mix on mix.user_id = user_row.id
		where user_row.email = 'qa-empty@blendcalc.local'
			and (item.id is not null or drink.id is not null or mix.user_id is not null)
	),
	'the empty persona stays empty across Ingredients, Saved, and Mix'
);

select ok(
	exists (
		select 1 from public.user_food_preferences preference
		join auth.users user_row on user_row.id = preference.user_id
		where user_row.email = 'qa-preferences@blendcalc.local'
			and preference.allergens @> array['peanut', 'shellfish']::text[]
			and preference.dietary_restrictions @> array['vegan', 'gluten-free']::text[]
			and preference.regulatory_region_code = 'US'
	),
	'the warning persona has deterministic allergen, dietary, and region preferences'
);

select is(
	(
		select count(*) from public.user_compatibility_rules rule
		join auth.users user_row on user_row.id = rule.user_id
		where user_row.email = 'qa-preferences@blendcalc.local'
	),
	4::bigint,
	'the warning persona resolves all four preference rules'
);

select ok(
	exists (
		select 1 from public.user_tutorial_preferences tutorial
		join auth.users user_row on user_row.id = tutorial.user_id
		where user_row.email = 'qa-onboarding@blendcalc.local'
			and not tutorial.do_not_show_again
			and tutorial.completed_at is null
	)
	and not exists (
		select 1 from public.user_tutorial_preferences tutorial
		join auth.users user_row on user_row.id = tutorial.user_id
		where user_row.email like 'qa-%@blendcalc.local'
			and user_row.email <> 'qa-onboarding@blendcalc.local'
			and (not tutorial.do_not_show_again or tutorial.completed_at is null)
	),
	'only the onboarding persona begins with the guided tour pending'
);

select is(
	(
		select count(*) from public.shared_product_submissions
		where id in (
			'83000000-0000-4000-8000-000000000001',
			'83000000-0000-4000-8000-000000000002'
		) and status = 'pending'
	),
	2::bigint,
	'the moderation queue contains both deterministic review fixtures'
);

select ok(
	exists (
		select 1 from public.shared_product_submissions
		where id = '83000000-0000-4000-8000-000000000001'
			and evidence_complete
			and (select count(*) from jsonb_object_keys(evidence_paths)) = 3
	)
	and exists (
		select 1 from public.shared_product_submissions
		where id = '83000000-0000-4000-8000-000000000002'
			and not evidence_complete
			and evidence_paths = '{}'::jsonb
	),
	'moderation fixtures cover complete and missing evidence states'
);

select is(
	(
		select count(*) from public.shared_products product
		where product.source_reference like 'local-qa-%'
			or product.source_reference like 'local-qa:%'
	),
	21::bigint,
	'the local catalog contains all packaged and generic QA foods'
);

select ok(
	exists (
		select 1 from public.shared_products product
		where product.product_name = 'Strawberries, Raw'
			and not exists (
				select 1 from public.user_food_list_items item
				join auth.users user_row on user_row.id = item.user_id
				where user_row.email = 'qa-user@blendcalc.local'
					and item.shared_product_id = product.id
			)
	),
	'Strawberries are searchable but remain unsaved for the populated persona'
);

select ok(
	not exists (
		select 1 from public.shared_products product
		where (product.source_reference like 'local-qa-%' or product.source_reference like 'local-qa:%')
			and not exists (
				select 1 from public.food_nutrients nutrient
				where nutrient.shared_product_id = product.id
			)
	),
	'every local catalog product has normalized nutrient data'
);

select ok(
	exists (
		select 1 from public.shared_products product
		join public.food_servings serving on serving.shared_product_id = product.id
		where product.product_name = 'Banana, Raw'
			and serving.label = '1 medium banana (118 g)'
			and serving.gram_weight = 118
			and serving.amount is null
			and serving.unit_key is null
	),
	'discrete serving labels retain exact weight without inventing conversion units'
);

select * from finish();

rollback;
