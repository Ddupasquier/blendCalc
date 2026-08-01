begin;

select plan(18);

select has_table(
	'public',
	'food_compatibility_policy_preference_term_mappings',
	'reviewed preference terminology mappings are versioned in the database'
);

select has_table(
	'public',
	'food_preference_mapping_requests',
	'unmatched saved preferences have a privacy-safe review queue'
);

select has_column(
	'public',
	'user_compatibility_rules',
	'resolution_status',
	'user compatibility rules expose their resolution status'
);

select has_column(
	'public',
	'user_compatibility_rules',
	'preference_term_mapping_id',
	'resolved rules retain their reviewed mapping evidence'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.food_compatibility_policy_preference_term_mappings',
		'INSERT'
	),
	'authenticated clients cannot create reviewed preference mappings'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.user_compatibility_rules',
		'INSERT'
	),
	'authenticated clients cannot fabricate resolved compatibility rules'
);

create temporary table preference_resolution_test_ids (
	user_id uuid not null,
	active_policy_id uuid not null,
	draft_policy_id uuid,
	ingredient_term_id uuid,
	mapping_id uuid
);

insert into preference_resolution_test_ids (user_id, active_policy_id)
select
	user_row.id,
	public.active_food_compatibility_policy_version_id()
from auth.users user_row
where user_row.email = 'qa-user@blendcalc.local';

insert into public.user_food_preferences (
	user_id,
	allergens,
	dietary_restrictions,
	sensitive_acknowledged_at
)
select
	user_id,
	array['Milk', 'Banana sensitivity', 'Unknown fixture'],
	'{}'::text[],
	now()
from preference_resolution_test_ids
on conflict (user_id) do update set
	allergens = excluded.allergens,
	dietary_restrictions = excluded.dietary_restrictions,
	sensitive_acknowledged_at = excluded.sensitive_acknowledged_at;

select is(
	(
		select resolution_status
		from public.user_compatibility_rules
		where user_id = (select user_id from preference_resolution_test_ids)
			and normalized_value = 'milk'
	),
	'resolved',
	'an exact reviewed preference tag resolves directly'
);

select is(
	(
		select resolution_method
		from public.user_compatibility_rules
		where user_id = (select user_id from preference_resolution_test_ids)
			and normalized_value = 'milk'
	),
	'direct_tag',
	'a direct tag match retains its resolution method'
);

select is(
	(
		select resolution_status
		from public.user_compatibility_rules
		where user_id = (select user_id from preference_resolution_test_ids)
			and normalized_value = 'banana sensitivity'
	),
	'unresolved',
	'an unmatched custom preference remains explicitly unresolved'
);

select is(
	(
		select count(*)::integer
		from public.food_preference_mapping_requests
		where status = 'pending'
			and normalized_value in ('banana sensitivity', 'unknown fixture')
	),
	2,
	'unmatched terms enter the review queue without being treated as warnings'
);

with inserted_term as (
	insert into public.ingredient_terms (
		canonical_key,
		display_name,
		default_language_code,
		review_status,
		source_reference,
		reviewed_at
	)
	values (
		'banana-allergen-fixture',
		'Banana allergen fixture',
		'en',
		'reviewed',
		'qa:canonical-preference-resolution',
		'2026-07-31T16:00:00Z'::timestamptz
	)
	returning id
)
update preference_resolution_test_ids
set ingredient_term_id = inserted_term.id
from inserted_term;

update preference_resolution_test_ids
set draft_policy_id = public.create_food_compatibility_policy_draft(
		(
			select max(version_number) + 1
			from public.food_compatibility_policy_versions
		),
		'Canonical food preference resolution regression fixture.',
		'[{
			"authority":"Regression fixture",
			"url":"https://example.com/canonical-food-preference-resolution"
		}]'::jsonb,
		'2026-07-31T16:00:00Z'::timestamptz,
		'2026-07-31T16:00:00Z'::timestamptz
	);

insert into public.compatibility_tags (slug, label, category)
values ('banana-fixture', 'Banana fixture', 'allergen');

insert into public.food_compatibility_policy_ingredient_aliases (
	policy_version_id,
	ingredient_term_id,
	alias,
	language_code,
	alias_type,
	review_status,
	source_reference,
	reviewed_at
)
select
	draft_policy_id,
	ingredient_term_id,
	'Banana sensitivity',
	'en',
	'common',
	'reviewed',
	'qa:canonical-preference-resolution',
	'2026-07-31T16:00:00Z'::timestamptz
from preference_resolution_test_ids;

with inserted_mapping as (
	insert into public.food_compatibility_policy_preference_term_mappings (
		policy_version_id,
		ingredient_term_id,
		preference_tag_id,
		preference_rule_type,
		source_reference,
		reviewed_at
	)
	select
		ids.draft_policy_id,
		ids.ingredient_term_id,
		tag.id,
		'allergen',
		'qa:canonical-preference-resolution',
		'2026-07-31T16:00:00Z'::timestamptz
	from preference_resolution_test_ids ids
	join public.compatibility_tags tag on tag.slug = 'banana-fixture'
	returning id
)
update preference_resolution_test_ids
set mapping_id = inserted_mapping.id
from inserted_mapping;

select is(
	(
		select resolution_status
		from public.user_compatibility_rules
		where user_id = (select user_id from preference_resolution_test_ids)
			and normalized_value = 'banana sensitivity'
	),
	'unresolved',
	'a draft mapping does not change active user checks'
);

select lives_ok(
	format(
		'select public.activate_food_compatibility_policy_version(%L::uuid)',
		(select draft_policy_id from preference_resolution_test_ids)
	),
	'activating the reviewed mapping refreshes saved preferences'
);

select is(
	(
		select resolution_status
		from public.user_compatibility_rules
		where user_id = (select user_id from preference_resolution_test_ids)
			and normalized_value = 'banana sensitivity'
	),
	'resolved',
	'an activated reviewed alias becomes eligible for automated checks'
);

select is(
	(
		select resolution_method
		from public.user_compatibility_rules
		where user_id = (select user_id from preference_resolution_test_ids)
			and normalized_value = 'banana sensitivity'
	),
	'ingredient_alias',
	'the resolved custom term retains exact alias evidence'
);

select is(
	(
		select allergens[2]
		from public.user_food_preferences
		where user_id = (select user_id from preference_resolution_test_ids)
	),
	'Banana sensitivity',
	'activation resolves a term without rewriting the user wording'
);

select is(
	(
		select resolution_status
		from public.user_compatibility_rules
		where user_id = (select user_id from preference_resolution_test_ids)
			and normalized_value = 'unknown fixture'
	),
	'unresolved',
	'unmatched values remain unresolved after another mapping activates'
);

select ok(
	(
		select jsonb_array_length(preference_mapping_snapshot) = 1
			and bundle_content_hash ~ '^[a-f0-9]{64}$'
		from public.food_compatibility_policy_versions
		where id = (select draft_policy_id from preference_resolution_test_ids)
	),
	'activated policy history includes the reviewed mapping snapshot and hash'
);

select throws_ok(
	format(
		'update public.food_compatibility_policy_preference_term_mappings set source_reference = %L where id = %L::uuid',
		'changed',
		(select mapping_id from preference_resolution_test_ids)
	),
	'Compatibility policy rows are immutable after activation.',
	'activated preference mappings cannot be edited in place'
);

select * from finish();

rollback;
