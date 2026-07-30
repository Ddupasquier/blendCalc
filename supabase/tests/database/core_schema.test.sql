begin;

select plan(33);

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
