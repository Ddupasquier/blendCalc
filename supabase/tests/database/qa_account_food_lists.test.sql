begin;

select plan(32);

select is(
	(select count(*) from auth.users where email like 'qa-%@blendcalc.local'),
	7::bigint,
	'the isolated database contains all seven QA personas'
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
	)
	and exists (
		select 1 from auth.users user_row
		join public.app_role_assignments role on role.user_id = user_row.id
		where user_row.email = 'qa-developer@blendcalc.local' and role.role = 'developer'
	),
	'moderator, admin, and developer personas receive their elevated roles'
);

select ok(
	not exists (
		with expected(email, fridge_count, shopping_count) as (
			values
				('qa-user@blendcalc.local', 60, 40),
				('qa-preferences@blendcalc.local', 4, 3),
				('qa-empty@blendcalc.local', 0, 0),
				('qa-onboarding@blendcalc.local', 10, 0),
				('qa-moderator@blendcalc.local', 3, 3),
				('qa-admin@blendcalc.local', 3, 3),
				('qa-developer@blendcalc.local', 3, 3)
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
		left join public.shared_products product on product.id = item.shared_product_id
		where user_row.email like 'qa-%@blendcalc.local'
			and (
				item.shared_product_id is null
				or product.status <> 'active'
				or item.source_key <> case product.source
					when 'community-reviewed' then 'shared-catalog'
					else product.source
				end
				or item.trust_status <> case
					when product.confidence in (
						'source-verified',
						'corroborated',
						'moderator-reviewed'
					) then product.confidence
					else 'unverified'
				end
			)
	),
	'all QA list ingredients retain catalog identity without upgrading imported evidence'
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
			and (
				(
					jsonb_typeof(item.food -> 'foodServings') = 'array'
					and jsonb_array_length(item.food -> 'foodServings') > 0
					and not exists (
						select 1 from public.food_servings serving
						where serving.user_food_list_item_id = item.id
					)
				)
				or (
					coalesce(jsonb_array_length(
						case
							when jsonb_typeof(item.food -> 'foodServings') = 'array'
								then item.food -> 'foodServings'
							else '[]'::jsonb
						end
					), 0) = 0
					and exists (
						select 1 from public.food_servings serving
						where serving.user_food_list_item_id = item.id
					)
				)
			)
	),
	'normalized list servings exactly match source-backed serving availability'
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
			or product.source = 'usda'
	),
		107::bigint,
	'the local catalog contains all focused and source-shaped QA foods'
);

select is(
	(
		select count(distinct item.shared_product_id)
		from public.user_food_list_items item
		join auth.users user_row on user_row.id = item.user_id
		where user_row.email = 'qa-user@blendcalc.local'
	),
	100::bigint,
	'the populated persona has one hundred distinct catalog products across its lists'
);

select is(
	(select count(*) from public.shared_products where source = 'usda' and status = 'active'),
	83::bigint,
	'the local catalog includes eighty-three real USDA branded-product snapshots'
);

select ok(
	not exists (
		select 1
		from public.shared_products product
		where product.status = 'active'
			and (
				product.source_reference like 'local-qa-%'
				or product.source_reference like 'local-qa:%'
				or product.source = 'usda'
			)
			and not public.is_valid_gtin(product.barcode)
	),
	'every active local QA catalog barcode is a valid GTIN'
);

select is(
	(select count(*) from public.blendcalc_api_v1_product_readiness where publishable),
	107::bigint,
	'every local QA catalog product is searchable through blendCalc API v1'
);

select ok(
	not exists (
		select 1
		from public.shared_products product
		where product.source = 'usda'
			and (
				product.confidence <> 'imported'
				or product.canonical_provenance ->> 'source' <> 'usda'
				or product.canonical_provenance ->> 'verificationMethod' <> 'exact-barcode'
				or not exists (
					select 1
					from public.shared_product_observations observation
					where observation.id = (product.canonical_provenance ->> 'observationId')::uuid
						and observation.source = 'usda'
						and observation.source_license = 'CC0-1.0'
				)
			)
	),
	'USDA QA products retain exact-barcode evidence and CC0 source attribution'
);

select ok(
	not exists (
		select 1
		from public.shared_products product
		where product.source = 'usda'
			and (
				select count(distinct nutrient.nutrient_id)
				from public.food_nutrients nutrient
				where nutrient.shared_product_id = product.id
					and nutrient.nutrient_id in (1008, 1004, 1005, 1003, 1093)
			) <> 5
	),
	'every USDA QA product retains all five reported core nutrient values'
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
		where (product.source_reference like 'local-qa-%' or product.source_reference like 'local-qa:%' or product.source = 'usda')
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

select ok(
	exists (
		select 1
		from public.shared_products product
		join public.shared_product_observations observation
			on observation.id = (product.canonical_provenance ->> 'observationId')::uuid
		where product.barcode = '00021130493609'
			and product.product_name = 'Roasted Onion & Garlic Pasta Sauce'
			and product.brand_owner = 'Safeway, Inc.'
			and observation.source = 'usda'
			and observation.source_reference = '2032704'
			and observation.source_license = 'CC0-1.0'
	),
	'the pasta-sauce fixture retains its exact USDA FDC observation'
);

select ok(
	exists (
		select 1
		from public.shared_products product
		where product.barcode = '00021130493609'
			and (
				select count(*)
				from public.food_nutrients nutrient
				where nutrient.shared_product_id = product.id
					and nutrient.source = 'usda'
					and nutrient.source_reference = '2032704'
			) = 15
			and exists (
				select 1
				from public.food_nutrients nutrient
				where nutrient.shared_product_id = product.id
					and nutrient.nutrient_id = 1079
					and nutrient.amount_per_100g = 1.6
			)
	),
	'the pasta-sauce fixture retains all fifteen USDA nutrients and exact fiber math'
);

select ok(
	exists (
		select 1
		from public.shared_products product
		join public.food_servings serving on serving.shared_product_id = product.id
		where product.barcode = '00021130493609'
			and serving.gram_weight = 125
			and serving.amount = 0.5
			and serving.unit_key = 'cup'
			and serving.origin = 'package-label'
			and serving.source = 'usda'
			and serving.source_reference = '2032704'
	),
	'the pasta-sauce package serving remains source-backed by USDA'
);

select ok(
	exists (
		select 1
		from public.shared_products product
		join public.food_image_assets image on image.shared_product_id = product.id
		where product.barcode = '00021130493609'
			and image.source = 'open-food-facts'
			and image.license_name = 'CC BY-SA 3.0'
			and image.attribution_text = 'Open Food Facts contributors'
	),
	'the pasta-sauce image retains separate Open Food Facts attribution'
);

select ok(
	not exists (
		select 1
		from public.shared_products product
		join public.shared_product_field_provenance provenance
			on provenance.shared_product_id = product.id
		where product.barcode = '00021130493609'
			and provenance.selected
			and provenance.field_path in ('allergens', 'traces', 'dietaryTags', 'labels')
	),
	'the pasta-sauce fixture does not fabricate unsupported USDA safety or diet fields'
);

select * from finish();

rollback;
