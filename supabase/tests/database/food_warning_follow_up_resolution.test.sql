begin;

select plan(17);

create temporary table food_warning_follow_up_test_baseline as
select count(*)::bigint as pending_count
from (
	select correction.id
	from public.catalog_correction_origins correction
	where correction.origin_type = 'food_warning_report'
		and correction.status in ('waiting_for_correction', 'linked')
	union all
	select review_case.id
	from public.food_warning_policy_review_cases review_case
	where review_case.status in ('open', 'deferred')
) pending_follow_up;

grant select on food_warning_follow_up_test_baseline to authenticated;

select ok(
	has_function_privilege(
		'authenticated',
		'public.resolve_food_warning_policy_review_case(uuid,text,text)',
		'execute'
	),
	'authenticated sessions can reach the guarded follow-up workflow'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.resolve_food_warning_policy_review_case(uuid,text,text)',
		'execute'
	),
	'anonymous clients cannot resolve food-warning follow-ups'
);

insert into auth.users (id, aud, role, email)
values
	('72400000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'follow-up-resolution-user@blendcalc.local'),
	('72400000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'follow-up-resolution-moderator@blendcalc.local'),
	('72400000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'follow-up-resolution-admin@blendcalc.local');

insert into public.app_role_assignments (user_id, role)
values
	('72400000-0000-4000-8000-000000000002', 'moderator'),
	('72400000-0000-4000-8000-000000000003', 'admin');

insert into public.food_compatibility_feedback (
	id,
	reported_by,
	policy_version_id,
	shared_product_id,
	shared_product_revision_id,
	source_key,
	source_id,
	barcode,
	food_description,
	feedback_type,
	preference_type,
	preference_value,
	preference_tag_id,
	fact_snapshot,
	report_reason,
	report_fingerprint,
	status,
	resolution_action,
	follow_up_status,
	reviewed_by,
	reviewed_at,
	review_note
)
select
	feedback_id,
	'72400000-0000-4000-8000-000000000001',
	public.active_food_compatibility_policy_version_id(),
	product.id,
	revision.id,
	'shared-catalog',
	product.id::text,
	product.barcode,
	product.product_name,
	'missing_warning',
	'allergen',
	tag.slug,
	tag.id,
	'{}'::jsonb,
	'missing_warning',
	fingerprint,
	'confirmed',
	resolution_action,
	'open',
	'72400000-0000-4000-8000-000000000002',
	now(),
	'The report requires a separate evidence review.'
from (
	values
		('72400000-0000-4000-8000-000000000010'::uuid, repeat('b', 64), 'rule_review'),
		('72400000-0000-4000-8000-000000000011'::uuid, repeat('c', 64), 'source_correction')
) fixture(feedback_id, fingerprint, resolution_action)
cross join lateral (
	select candidate.*
	from public.shared_products candidate
	where candidate.id = '84000000-0000-4000-8000-000000000681'
) product
cross join lateral (
	select candidate.id
	from public.shared_product_revisions candidate
	where candidate.shared_product_id = product.id
	order by candidate.revision_number desc
	limit 1
) revision
cross join lateral (
	select candidate.id, candidate.slug
	from public.compatibility_tags candidate
	where candidate.slug = 'milk'
) tag;

insert into public.food_warning_policy_review_cases (
	id,
	feedback_id,
	case_type,
	responsible_group,
	shared_product_id,
	source_key,
	opened_by
)
values
	(
		'72400000-0000-4000-8000-000000000020',
		'72400000-0000-4000-8000-000000000010',
		'rule_review',
		'food_policy_review',
		'84000000-0000-4000-8000-000000000681',
		'shared-catalog',
		'72400000-0000-4000-8000-000000000002'
	),
	(
		'72400000-0000-4000-8000-000000000021',
		'72400000-0000-4000-8000-000000000011',
		'source_correction',
		'data_operations',
		'84000000-0000-4000-8000-000000000681',
		'shared-catalog',
		'72400000-0000-4000-8000-000000000002'
	);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72400000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.resolve_food_warning_policy_review_case(
		'72400000-0000-4000-8000-000000000020',
		'resolved',
		'Reviewed policy evidence supports the current behavior.'
	)$$,
	'42501',
	'MFA-verified food-warning review access is required.',
	'ordinary users cannot finish warning follow-ups'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72400000-0000-4000-8000-000000000002","role":"authenticated","app_role":"moderator","aal":"aal2"}',
	true
);

select is(
	(
		public.resolve_food_warning_policy_review_case(
			'72400000-0000-4000-8000-000000000020',
			'resolved',
			'Reviewed policy evidence supports the current behavior.'
		) ->> 'reviewed'
	)::boolean,
	true,
	'a warning reviewer can resolve a policy-owned follow-up'
);

reset role;
select is(
	(select status from public.food_warning_policy_review_cases where id = '72400000-0000-4000-8000-000000000020'),
	'resolved',
	'resolving records a terminal case state'
);

select is(
	(select resolution_note from public.food_warning_policy_review_cases where id = '72400000-0000-4000-8000-000000000020'),
	'Reviewed policy evidence supports the current behavior.',
	'the terminal case preserves the exact private evidence note'
);

select is(
	(select follow_up_status from public.food_compatibility_feedback where id = '72400000-0000-4000-8000-000000000010'),
	'completed',
	'resolving completes the originating report follow-up'
);

select is(
	(public.get_privileged_tool_action_summary() ->> 'pendingFoodWarningFollowUps')::bigint,
	(select pending_count + 1 from food_warning_follow_up_test_baseline),
	'the privileged launcher count keeps the remaining source follow-up visible'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72400000-0000-4000-8000-000000000002","role":"authenticated","app_role":"moderator","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.resolve_food_warning_policy_review_case(
		'72400000-0000-4000-8000-000000000021',
		'deferred',
		'Provider evidence is still required.'
	)$$,
	'42501',
	'MFA-verified data-operations repair access is required.',
	'a warning-only reviewer cannot finish a data-operations source case'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72400000-0000-4000-8000-000000000003","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select is(
	(
		public.resolve_food_warning_policy_review_case(
			'72400000-0000-4000-8000-000000000021',
			'deferred',
			'Provider evidence is still required.'
		) ->> 'followUpCompleted'
	)::boolean,
	false,
	'an authorized operator can defer a source case without completing it'
);

reset role;
select is(
	(select status from public.food_warning_policy_review_cases where id = '72400000-0000-4000-8000-000000000021'),
	'deferred',
	'deferred work remains in its explicit nonterminal state'
);

select is(
	(select follow_up_status from public.food_compatibility_feedback where id = '72400000-0000-4000-8000-000000000011'),
	'open',
	'deferred work keeps the originating report follow-up open'
);

select is(
	(public.get_privileged_tool_action_summary() ->> 'pendingFoodWarningFollowUps')::bigint,
	(select pending_count + 1 from food_warning_follow_up_test_baseline),
	'deferred follow-up work remains in the privileged launcher count'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72400000-0000-4000-8000-000000000003","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select is(
	(
		public.resolve_food_warning_policy_review_case(
			'72400000-0000-4000-8000-000000000021',
			'dismissed',
			'Reviewed source evidence proves no mapping change is required.'
		) ->> 'followUpCompleted'
	)::boolean,
	true,
	'an authorized operator can dismiss a source case from reviewed evidence'
);

select is(
	(
		public.resolve_food_warning_policy_review_case(
			'72400000-0000-4000-8000-000000000021',
			'dismissed',
			'Duplicate late request.'
		) ->> 'reviewed'
	)::boolean,
	false,
	'a completed case cannot be decided twice'
);

reset role;
select is(
	(select follow_up_status from public.food_compatibility_feedback where id = '72400000-0000-4000-8000-000000000011'),
	'completed',
	'a dismissed source case completes the originating report follow-up'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72400000-0000-4000-8000-000000000003","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select is(
	(public.get_privileged_tool_action_summary() ->> 'pendingFoodWarningFollowUps')::bigint,
	(select pending_count from food_warning_follow_up_test_baseline),
	'terminal follow-ups disappear from the privileged launcher count'
);

select * from finish();

rollback;
