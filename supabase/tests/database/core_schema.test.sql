begin;

select plan(51);

select has_table('public', 'profiles', 'profiles table exists');
select ok(
	exists (
		select 1
		from pg_constraint
		where conrelid = 'public.profiles'::regclass
			and conname = 'profiles_bio_check'
			and position('char_length(bio) <= 300' in pg_get_constraintdef(oid)) > 0
	),
	'the legacy database contract still accepts profiles written by the deployed app'
);
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
	(select count(*) from public.nutrient_manual_entry_fields where enabled) >= 68
		and exists (
			select 1
			from public.nutrient_manual_entry_groups
			where id = 'amino-acids'
				and entry_step = 'extended'
				and enabled
		)
		and not exists (
			select expected.group_id
			from (
				values
					('advanced-carbohydrate-details', 8),
					('advanced-fat-details', 3),
					('carotenoids', 2),
					('minerals', 12),
					('amino-acids', 19),
					('other-nutrients', 1)
			) as expected(group_id, minimum_fields)
			where (
				select count(*)
				from public.nutrient_manual_entry_fields fields
				where fields.group_id = expected.group_id
					and fields.enabled
					and fields.classification_status = 'approved'
			) < expected.minimum_fields
		),
	'local QA manual entry includes the reviewed Extended nutrient catalog'
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
	(select count(*) from public.custom_food_category_options where enabled) > 1000
		and exists (
			select 1
			from public.custom_food_category_options
			where normalized_value = 'yogurts'
				and enabled
		),
	'local QA category fixtures prove search beyond the former 1,000-row cutoff'
);
select ok(
	exists (
		select 1
		from public.shared_products product
		where product.barcode = '09000000000179'
			and product.status = 'active'
			and product.search_text ilike '%green%'
			and product.search_text ilike '%tomat%'
			and product.food ->> 'fdcId' = '170456'
			and jsonb_array_length(product.food -> 'foodNutrients') >= 7
	),
	'local QA catalog includes a source-shaped multi-word partial-search fixture'
);
select ok(
	exists (
		select 1
		from public.shared_products product
		where product.barcode = '09000000000186'
			and product.product_name = 'Babyfood, Ravioli, Cheese Filled, With Tomato Sauce'
			and product.search_text ilike '%tomato%'
	)
	and exists (
		select 1
		from public.shared_products product
		where product.barcode = '09000000000193'
			and product.product_name = 'Babyfood, Dinner, Macaroni And Tomato'
			and product.search_text ilike '%tomato%'
	),
	'local QA catalog includes intentionally weaker late-name search matches'
);
select ok(
	exists (
		select 1
		from public.food_image_assets image
		join public.shared_products product on product.id = image.shared_product_id
		where product.barcode = '00021130493609'
			and image.source = 'open-food-facts'
			and image.image_role = 'front'
			and image.license_name = 'CC BY-SA 3.0'
			and image.license_url = 'https://creativecommons.org/licenses/by-sa/3.0/'
			and image.attribution_text = 'Open Food Facts contributors'
			and image.status = 'active'
	),
	'local QA pasta-sauce fixture includes source-licensed image attribution'
);
select is(
	(
		select count(*)::integer
		from public.blendcalc_api_v1_product_readiness
		where barcode in (
			'00021130462506',
			'00021130493609',
			'08801005523455',
			'00869759000149',
			'00011110904416'
		)
			and publishable
	),
	1,
	'only the fully evidenced local QA catalog fixture is publishable through blendCalc API v1'
);
select is(
	(
		select count(*)::integer
		from public.blendcalc_api_v1_product_readiness
		where publishable
	),
	1,
	'the strict publication profile withholds incomplete local QA catalog fixtures'
);
select ok(
	exists (
		select 1
		from public.blendcalc_api_v1_product_readiness
		where barcode = '00011110904416'
			and not publishable
			and reasons @> array['missing_evidence_backed_primary_serving']
	),
	'the explicit no-serving QA fixture remains canonical but is withheld from API v1'
);
select ok(
	exists (
		select 1
		from public.blendcalc_api_v1_product_readiness
		where barcode = '00021130462506'
			and not publishable
			and reasons @> array['missing_required_nutrient:1258']
	),
	'a detailed fixture with an unreported required nutrient is withheld instead of receiving an invented zero'
);
select is(
	(select count(*)::integer from public.shared_products where source = 'usda' and status = 'active'),
	83,
	'local QA includes a broad set of exact USDA branded-product snapshots'
);
select ok(
	not exists (
		select 1
		from public.shared_products product
		where product.source = 'usda'
			and not exists (
				select 1
				from public.food_nutrients nutrient
				where nutrient.shared_product_id = product.id
					and nutrient.source = 'usda'
					and nutrient.source_observation_id is not null
					and nutrient.mapping_status = 'canonical'
			)
	),
	'USDA catalog snapshots retain normalized nutrient lineage'
);
select ok(
	exists (
		select 1
		from public.shared_products product
		where product.barcode = '00867824000001'
			and product.product_name = 'Apple'
			and product.food ->> 'fdcId' = '454004'
			and product.food ->> 'sourceKey' = 'usda'
	)
	and exists (
		select 1
		from public.shared_products product
		where product.barcode = '00812624010613'
			and product.product_name = 'Shrimp'
			and product.food ->> 'fdcId' = '1899566'
	),
	'USDA QA snapshots cover distinct produce and seafood identities'
);
select ok(
	not exists (
		select 1
		from public.shared_products product
		where product.barcode in (
			'00021130462506',
			'00021130493609',
			'08801005523455',
			'00869759000149',
			'00011110904416'
		)
			and not exists (
				select 1
				from public.food_nutrients nutrient
				where nutrient.shared_product_id = product.id
					and nutrient.source = case
						when product.barcode = '00021130493609' then 'usda'
						else 'user-label'
					end
					and nutrient.source_observation_id is not null
					and nutrient.mapping_status = 'canonical'
			)
	),
	'local QA catalog fixtures retain normalized nutrient lineage'
);
select ok(
	exists (
		select 1
		from public.shared_products product
		join public.food_servings serving on serving.shared_product_id = product.id
		where product.barcode = '00021130493609'
			and serving.label = '1/2 cup (125 g)'
			and serving.gram_weight = 125
			and serving.source_observation_id is not null
	)
	and not exists (
		select 1
		from public.shared_products product
		join public.food_servings serving on serving.shared_product_id = product.id
		where product.barcode = '00011110904416'
	),
	'local QA fixtures cover exact serving and source-reported no-serving states'
);
select ok(
	exists (
		select 1
		from public.shared_products product
		where product.barcode = '08801005523455'
			and product.food ->> 'ingredients' like '%wheat flour%'
			and product.food -> 'allergens' ?& array['wheat', 'soy']
			and product.food -> 'traces' ? 'peanuts'
	),
	'local QA catalog fixtures include ingredient, allergen, and trace evidence'
);
select ok(
	has_table_privilege(
		'service_role',
		'public.custom_food_category_options',
		'SELECT'
	),
	'trusted catalog reads can resolve canonical category labels'
);
select ok(
	has_table_privilege(
		'service_role',
		'public.shared_product_observations',
		'SELECT'
	),
	'trusted catalog reads can resolve selected observation provenance'
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
select has_table(
	'public',
	'request_rate_limits',
	'private request-rate counters exist'
);
select ok(
	not exists (
		select 1
		from pg_class relation
		join pg_namespace namespace on namespace.oid = relation.relnamespace
		where namespace.nspname = 'public'
			and relation.relkind in ('r', 'p')
			and not relation.relrowsecurity
	),
	'every public table has RLS enabled'
);
select ok(
	not exists (
		select 1
		from information_schema.role_table_grants grant_row
		where grant_row.table_schema = 'public'
			and grant_row.grantee in ('anon', 'authenticated')
			and grant_row.privilege_type in (
				'TRUNCATE',
				'REFERENCES',
				'TRIGGER',
				'MAINTAIN'
			)
	),
	'Data API roles do not retain table-wide bypass privileges'
);
select ok(
	not has_function_privilege(
		'anon',
		'public.sync_nutrient_manual_entry_fields()',
		'EXECUTE'
	),
	'anonymous users cannot rebuild nutrient reference data'
);
select ok(
	not has_function_privilege(
		'authenticated',
		'public.sync_nutrient_manual_entry_fields()',
		'EXECUTE'
	),
	'authenticated users cannot rebuild nutrient reference data'
);
select ok(
	not has_function_privilege(
		'authenticated',
		'public.sync_user_compatibility_rules(uuid, text[], text[])',
		'EXECUTE'
	),
	'authenticated users cannot rewrite another user compatibility rules'
);
select ok(
	has_function_privilege(
		'service_role',
		'public.consume_request_rate_limit(text, text, integer, integer)',
		'EXECUTE'
	),
	'the service role can consume request quotas'
);
select ok(
	not exists (
		select 1
		from pg_default_acl defaults
		cross join lateral aclexplode(defaults.defaclacl) privilege
		left join pg_roles grantee on grantee.oid = privilege.grantee
		where defaults.defaclrole = 'postgres'::regrole
			and defaults.defaclnamespace = 'public'::regnamespace
			and coalesce(grantee.rolname, 'public') in (
				'public',
				'anon',
				'authenticated'
			)
			and defaults.defaclobjtype in ('r', 'S', 'f')
	),
	'new public objects are deny-by-default for Data API roles'
);
select ok(
	not has_table_privilege(
		'authenticated',
		'public.profiles',
		'INSERT, UPDATE, DELETE'
	),
	'profile writes are server-owned'
);
select ok(
	not has_table_privilege(
		'authenticated',
		'public.profile_image_policy_acceptances',
		'INSERT'
	),
	'profile image policy acceptance writes are server-owned'
);
select ok(
	has_table_privilege(
		'service_role',
		'public.profile_image_policy_acceptances',
		'INSERT'
	),
	'the service role can record profile image policy acceptance'
);
select ok(
	not exists (
		select 1
		from pg_policies
		where schemaname = 'storage'
			and tablename = 'objects'
			and cmd in ('INSERT', 'UPDATE', 'DELETE')
			and policyname in (
				'Users can upload their avatar files',
				'Users can update their avatar files',
				'Users can delete their avatar files',
				'Users can upload their product evidence',
				'Users can delete their product evidence'
			)
	),
	'user storage writes cannot bypass server image normalization'
);

select * from finish();

rollback;
