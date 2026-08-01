begin;

select plan(19);

select has_table(
	'public',
	'food_compatibility_policy_match_rules',
	'policy-versioned extraction rules exist'
);

select has_table(
	'public',
	'food_compatibility_policy_conflicts',
	'policy-versioned conflict rules exist'
);

select has_table(
	'public',
	'food_compatibility_policy_exemptions',
	'policy-versioned exemptions exist'
);

select ok(
	exists (
		select 1
		from public.food_compatibility_policy_match_rules rule
		where rule.policy_version_id =
			public.active_food_compatibility_policy_version_id()
	),
	'the active policy has extraction rules'
);

select ok(
	exists (
		select 1
		from public.food_compatibility_policy_conflicts conflict
		where conflict.policy_version_id =
			public.active_food_compatibility_policy_version_id()
	),
	'the active policy has conflict rules'
);

select throws_ok(
	$$
		update public.food_compatibility_policy_match_rules
		set priority = priority + 1
		where id = (
			select id
			from public.food_compatibility_policy_match_rules
			limit 1
		)
	$$,
	'Compatibility policy rows are immutable after activation.',
	'active extraction rules cannot be edited in place'
);

create temporary table policy_test_ids (
	active_policy_id uuid not null,
	draft_policy_id uuid not null,
	draft_version_number integer not null
);

insert into policy_test_ids (
	active_policy_id,
	draft_policy_id,
	draft_version_number
)
select
	public.active_food_compatibility_policy_version_id(),
	public.create_food_compatibility_policy_draft(
		version.next_version_number,
		'Policy activation regression fixture.',
		'[{"authority":"Regression fixture","url":"https://example.com/policy"}]'::jsonb,
		'2026-07-31T13:00:00Z'::timestamptz,
		'2026-07-31T13:00:00Z'::timestamptz
	),
	version.next_version_number
from (
	select max(version_number) + 1 as next_version_number
	from public.food_compatibility_policy_versions
) version;

select is(
	(
		select count(*)
		from public.food_compatibility_policy_match_rules
		where policy_version_id = (select draft_policy_id from policy_test_ids)
	),
	(
		select count(*)
		from public.food_compatibility_policy_match_rules
		where policy_version_id = (select active_policy_id from policy_test_ids)
	),
	'a draft clones every extraction rule from the active bundle'
);

select is(
	(
		select count(*)
		from public.food_compatibility_policy_conflicts
		where policy_version_id = (select draft_policy_id from policy_test_ids)
	),
	(
		select count(*)
		from public.food_compatibility_policy_conflicts
		where policy_version_id = (select active_policy_id from policy_test_ids)
	),
	'a draft clones every conflict rule from the active bundle'
);

update public.food_compatibility_policy_conflicts
set priority = priority + 1
where policy_version_id = (select draft_policy_id from policy_test_ids)
	and (preference_tag_id, fact_tag_id) = (
		select preference_tag_id, fact_tag_id
		from public.food_compatibility_policy_conflicts
		where policy_version_id = (select draft_policy_id from policy_test_ids)
		limit 1
	);

select lives_ok(
	format(
		'select public.activate_food_compatibility_policy_version(%L::uuid)',
		(select draft_policy_id from policy_test_ids)
	),
	'a complete draft activates and refreshes atomically'
);

select is(
	(
		select version_number
		from public.food_compatibility_policy_versions
		where status = 'active'
	),
	(select draft_version_number from policy_test_ids),
	'the draft becomes the sole active policy version'
);

select ok(
	not exists (
		select 1
		from public.food_compatibility_match_rules rule
		where rule.policy_version_id <> (select draft_policy_id from policy_test_ids)
	),
	'the runtime extraction-rule view exposes only the active bundle'
);

select ok(
	not exists (
		select 1
		from public.compatibility_rule_conflicts conflict
		where conflict.policy_version_id <> (select draft_policy_id from policy_test_ids)
	),
	'the runtime conflict-rule view exposes only the active bundle'
);

select ok(
	not exists (
		select 1
		from public.product_compatibility_facts fact
		where fact.policy_version_id <> (select draft_policy_id from policy_test_ids)
	),
	'activation leaves no mixed-version compatibility facts'
);

select ok(
	(
		select bundle_content_hash ~ '^[a-f0-9]{64}$'
		from public.food_compatibility_policy_versions
		where id = (select draft_policy_id from policy_test_ids)
	),
	'the activated bundle records a deterministic content hash'
);

select ok(
	(
		select jsonb_array_length(match_rule_snapshot) > 0
			and jsonb_array_length(conflict_rule_snapshot) > 0
			and jsonb_array_length(regional_profile_snapshot) > 0
		from public.food_compatibility_policy_versions
		where id = (select draft_policy_id from policy_test_ids)
	),
	'the activated version retains complete immutable snapshots'
);

select throws_ok(
	$$
		update public.food_compatibility_policy_conflicts
		set priority = priority + 1
		where policy_version_id = (select draft_policy_id from policy_test_ids)
	$$,
	'Compatibility policy rows are immutable after activation.',
	'activated conflict rules cannot be edited in place'
);

select lives_ok(
	format(
		'select public.activate_food_compatibility_policy_version(%L::uuid)',
		(select active_policy_id from policy_test_ids)
	),
	'a retired policy can be reactivated as a rollback'
);

select is(
	(
		select version_number
		from public.food_compatibility_policy_versions
		where status = 'active'
	),
	(
		select version.version_number
		from policy_test_ids ids
		join public.food_compatibility_policy_versions version
			on version.id = ids.active_policy_id
	),
	'rollback restores the prior policy version'
);

select ok(
	not exists (
		select 1
		from public.product_compatibility_facts fact
		where fact.policy_version_id <> (select active_policy_id from policy_test_ids)
	),
	'rollback restores facts without mixed policy versions'
);

rollback;
