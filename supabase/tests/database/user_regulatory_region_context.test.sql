begin;

select plan(9);

select has_column(
	'public',
	'user_food_preferences',
	'regulatory_region_code',
	'food preferences store an optional regulatory region code'
);

select has_column(
	'public',
	'user_food_preferences',
	'regulatory_region_source',
	'food preferences record how the region was selected'
);

select has_trigger(
	'public',
	'user_food_preferences',
	'validate_user_food_preference_regulatory_region',
	'region selections are validated at the database boundary'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'user_food_preferences_regulatory_region_code_check'
	),
	'region codes have a bounded format'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'user_food_preferences_regulatory_region_source_check'
	),
	'region selection sources are bounded'
);

select ok(
	exists (
		select 1
		from pg_constraint
		where conname = 'user_food_preferences_regulatory_region_pair_check'
	),
	'region codes and their selection source remain paired'
);

select is(
	(
		select count(distinct profile.region_code)
		from public.food_allergen_regulatory_profiles profile
		where profile.policy_version_id =
			public.active_food_compatibility_policy_version_id()
			and profile.active
	),
	5::bigint,
	'the active policy exposes all five reviewed regional profiles'
);

create temporary table regulatory_region_fixture (
	regulatory_region_code text,
	regulatory_region_source text
);

create trigger validate_regulatory_region_fixture
	before insert or update of regulatory_region_code, regulatory_region_source
	on regulatory_region_fixture
	for each row execute function
		public.validate_user_food_preference_regulatory_region();

select lives_ok(
	$$
		insert into regulatory_region_fixture (
			regulatory_region_code,
			regulatory_region_source
		)
		select profile.region_code, 'account'
		from public.food_allergen_regulatory_profiles profile
		where profile.policy_version_id =
			public.active_food_compatibility_policy_version_id()
			and profile.active
	$$,
	'every active version-bound regional profile passes validation'
);

select throws_ok(
	$$
		insert into regulatory_region_fixture values ('ZZ', 'account')
	$$,
	'23514',
	'The selected regulatory region is not supported by the active food compatibility policy.',
	'unsupported regions are rejected without pretending a profile was checked'
);

select * from finish();

rollback;
