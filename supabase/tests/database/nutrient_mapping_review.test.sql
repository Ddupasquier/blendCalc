begin;

select plan(24);

select ok(
	has_function_privilege(
		'authenticated',
		'public.get_nutrient_mapping_review_workspace(uuid)',
		'execute'
	),
	'authenticated sessions can reach the guarded nutrient mapping workspace'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.review_nutrient_source_mapping(uuid,text,bigint,text,text)',
		'execute'
	),
	'authenticated sessions can reach the guarded nutrient mapping decision'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.get_nutrient_mapping_review_workspace(uuid)',
		'execute'
	),
	'anonymous sessions cannot open nutrient mapping work'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.nutrient_mapping_review_decisions',
		'select'
	),
	'authenticated clients cannot read nutrient mapping decisions directly'
);

select ok(
	has_table_privilege(
		'service_role',
		'public.nutrient_mapping_review_decisions',
		'select'
	),
	'trusted server workflows can read nutrient mapping decisions'
);

insert into auth.users (id, aud, role, email)
values
	('72400000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'mapping-user@blendcalc.local'),
	('72400000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'mapping-admin@blendcalc.local');

insert into public.app_role_assignments (user_id, role)
values ('72400000-0000-4000-8000-000000000002', 'admin');

insert into public.nutrient_source_mappings (
	source_key,
	source_nutrient_key,
	source_unit_name,
	source_nutrient_name,
	nutrient_id,
	priority,
	mapping_method,
	confidence,
	enabled,
	observation_count,
	provenance,
	review_status,
	review_reference,
	reviewed_at
)
values
	(
		'open-food-facts',
		'qa-ambiguous-protein',
		'G',
		'Possible protein',
		1003,
		100,
		'api_taxonomy_match',
		0.75,
		false,
		3,
		'{"reason":"The provider label resembles protein but lacks an exact reviewed key."}'::jsonb,
		'pending_review',
		null,
		null
	),
	(
		'open-food-facts',
		'qa-ambiguous-fiber',
		'G',
		'Possible fiber',
		1079,
		100,
		'api_observation_match',
		0.6,
		false,
		2,
		'{"reason":"Observed values resemble fiber but the provider key is not reviewed."}'::jsonb,
		'pending_review',
		null,
		null
	);

create temporary table nutrient_mapping_review_test_state (
	key text primary key,
	value uuid not null
);

insert into nutrient_mapping_review_test_state (key, value)
select 'approve', mapping.id
from public.nutrient_source_mappings mapping
where mapping.source_key = 'open-food-facts'
	and mapping.source_nutrient_key = 'qa-ambiguous-protein'
	and mapping.source_unit_name = 'G';

insert into nutrient_mapping_review_test_state (key, value)
select 'exclude', mapping.id
from public.nutrient_source_mappings mapping
where mapping.source_key = 'open-food-facts'
	and mapping.source_nutrient_key = 'qa-ambiguous-fiber'
	and mapping.source_unit_name = 'G';

select ok(
	exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		join nutrient_mapping_review_test_state state
			on state.key = 'approve' and occurrence.subject_key = state.value::text
		where occurrence.issue_code = 'NUTRIENT_MAPPING_GAP'
	),
	'pending mappings appear as open catalog-health work'
);

grant select on table nutrient_mapping_review_test_state to authenticated;

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'72400000-0000-4000-8000-000000000001',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"72400000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.get_nutrient_mapping_review_workspace((
		select state.value from nutrient_mapping_review_test_state state where state.key = 'approve'
	))$$,
	'42501',
	'MFA-verified nutrient mapping access is required.',
	'normal users cannot open nutrient mapping work'
);

select throws_ok(
	$$select public.review_nutrient_source_mapping(
		(select state.value from nutrient_mapping_review_test_state state where state.key = 'approve'),
		'approved',
		1003,
		'Reviewed against the provider nutrient reference.',
		'https://example.test/provider-nutrient-reference'
	)$$,
	'42501',
	'MFA-verified nutrient mapping access is required.',
	'normal users cannot decide nutrient mappings'
);

select set_config(
	'request.jwt.claim.sub',
	'72400000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"72400000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal1"}',
	true
);

select throws_ok(
	$$select public.get_nutrient_mapping_review_workspace((
		select state.value from nutrient_mapping_review_test_state state where state.key = 'approve'
	))$$,
	'42501',
	'MFA-verified nutrient mapping access is required.',
	'admins must verify MFA before opening nutrient mapping work'
);

select throws_ok(
	$$select public.review_nutrient_source_mapping(
		(select state.value from nutrient_mapping_review_test_state state where state.key = 'approve'),
		'approved',
		1003,
		'Reviewed against the provider nutrient reference.',
		'https://example.test/provider-nutrient-reference'
	)$$,
	'42501',
	'MFA-verified nutrient mapping access is required.',
	'admins must verify MFA before deciding nutrient mappings'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72400000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select lives_ok(
	$$select public.get_nutrient_mapping_review_workspace((
		select state.value from nutrient_mapping_review_test_state state where state.key = 'approve'
	))$$,
	'MFA-verified admins can open nutrient mapping work'
);

select is(
	(
		select public.get_nutrient_mapping_review_workspace(state.value)
			-> 'mapping' ->> 'reviewStatus'
		from nutrient_mapping_review_test_state state
		where state.key = 'approve'
	),
	'pending_review',
	'the workspace identifies an unresolved candidate'
);

select ok(
	(
		select public.get_nutrient_mapping_review_workspace(state.value)
			-> 'compatibleNutrients' @> '[{"nutrientId":1003,"defaultUnitName":"G"}]'::jsonb
		from nutrient_mapping_review_test_state state
		where state.key = 'approve'
	),
	'the workspace offers nutrients with a reviewed compatible unit path'
);

select ok(
	(
		select public.get_catalog_data_operations_health(30, 20)
			-> 'issues' -> 'nutrientMappings'
			@> jsonb_build_array(jsonb_build_object('mappingId', state.value))
		from nutrient_mapping_review_test_state state
		where state.key = 'approve'
	),
	'the operations dashboard links pending work by stable mapping ID'
);

select throws_ok(
	$$select public.review_nutrient_source_mapping(
		(select state.value from nutrient_mapping_review_test_state state where state.key = 'approve'),
		'approved',
		1003,
		'Reviewed against the provider nutrient reference.',
		null
	)$$,
	'P0001',
	'Approval requires a nutrient and an evidence reference.',
	'approval cannot omit its evidence reference'
);

select throws_ok(
	$$select public.review_nutrient_source_mapping(
		(select state.value from nutrient_mapping_review_test_state state where state.key = 'approve'),
		'approved',
		1008,
		'Reviewed against the provider nutrient reference.',
		'https://example.test/provider-nutrient-reference'
	)$$,
	'P0001',
	'The source unit has no reviewed conversion for that nutrient.',
	'approval cannot invent a unit conversion'
);

create temporary table nutrient_mapping_review_test_results (
	key text primary key,
	payload jsonb not null
);
grant all on table nutrient_mapping_review_test_results to authenticated;

insert into nutrient_mapping_review_test_results (key, payload)
select
	'approved',
	public.review_nutrient_source_mapping(
		state.value,
		'approved',
		1003,
		'The provider documentation identifies this exact key as protein measured in grams.',
		'https://example.test/provider-nutrient-reference'
	)
from nutrient_mapping_review_test_state state
where state.key = 'approve';

select is(
	(
		select result.payload ->> 'reviewStatus'
		from nutrient_mapping_review_test_results result
		where result.key = 'approved'
	),
	'approved',
	'an evidence-backed decision approves the mapping'
);

reset role;

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings mapping
		join nutrient_mapping_review_test_state state
			on state.key = 'approve' and mapping.id = state.value
		where mapping.nutrient_id = 1003
			and mapping.mapping_method = 'moderator_verified'
			and mapping.review_status = 'approved'
			and mapping.enabled
	),
	'the approved mapping becomes authoritative and enabled'
);

select ok(
	exists (
		select 1
		from public.nutrient_mapping_review_decisions decision
		join nutrient_mapping_review_test_state state
			on state.key = 'approve' and decision.mapping_id = state.value
		where decision.outcome = 'approved'
			and decision.selected_nutrient_id = 1003
			and decision.reviewed_by = '72400000-0000-4000-8000-000000000002'
	),
	'the approval records immutable evidence and ownership'
);

select ok(
	not exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		join nutrient_mapping_review_test_state state
			on state.key = 'approve' and occurrence.subject_key = state.value::text
	),
	'resolved mappings leave the catalog-health queue'
);

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'72400000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"72400000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.review_nutrient_source_mapping(
		(select state.value from nutrient_mapping_review_test_state state where state.key = 'approve'),
		'approved',
		1003,
		'Reviewing a resolved mapping again must fail.',
		'https://example.test/provider-nutrient-reference'
	)$$,
	'P0001',
	'This nutrient mapping is no longer waiting for review.',
	'resolved work cannot receive a second decision'
);

insert into nutrient_mapping_review_test_results (key, payload)
select
	'excluded',
	public.review_nutrient_source_mapping(
		state.value,
		'excluded',
		null,
		'The provider field is not a canonical nutrient and must remain unavailable.',
		null
	)
from nutrient_mapping_review_test_state state
where state.key = 'exclude';

select is(
	(
		select result.payload ->> 'reviewStatus'
		from nutrient_mapping_review_test_results result
		where result.key = 'excluded'
	),
	'rejected',
	'an excluded candidate is marked rejected'
);

reset role;

select ok(
	exists (
		select 1
		from public.nutrient_source_mappings mapping
		join nutrient_mapping_review_test_state state
			on state.key = 'exclude' and mapping.id = state.value
		where mapping.review_status = 'rejected'
			and not mapping.enabled
	)
	and exists (
		select 1
		from public.nutrient_mapping_review_decisions decision
		join nutrient_mapping_review_test_state state
			on state.key = 'exclude' and decision.mapping_id = state.value
		where decision.outcome = 'excluded'
			and decision.selected_nutrient_id is null
	),
	'exclusion disables the candidate and preserves its decision'
);

select ok(
	not exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		join nutrient_mapping_review_test_state state
			on state.key = 'exclude' and occurrence.subject_key = state.value::text
	)
	and not exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		join public.nutrient_source_mappings mapping
			on occurrence.subject_key = mapping.id::text
		where mapping.review_status = 'approved'
			and occurrence.issue_code = 'NUTRIENT_MAPPING_GAP'
	),
	'excluded and exact approved mappings do not create unresolved work'
);

select * from finish();

rollback;
