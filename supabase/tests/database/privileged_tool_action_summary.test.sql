begin;

select plan(16);

select has_function(
	'public',
	'get_privileged_tool_action_summary',
	array[]::text[],
	'privileged Profile action summary exists'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.get_privileged_tool_action_summary()',
		'execute'
	),
	'authenticated sessions can reach the guarded action summary'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.get_privileged_tool_action_summary()',
		'execute'
	),
	'anonymous clients cannot read privileged action counts'
);

select ok(
	not has_function_privilege(
		'service_role',
		'public.get_privileged_tool_action_summary()',
		'execute'
	),
	'the service role cannot bypass the user-scoped summary'
);

create temporary table expected_privileged_action_counts as
select
	(
		select count(*)
		from public.shared_product_submissions submission
		where submission.status = 'pending'
	) as product_submissions,
	(
		select count(*)
		from public.shared_product_conflicts conflict
		where conflict.status = 'open'
	) + (
		select count(*)
		from public.catalog_provider_change_reviews review
		where review.status = 'pending'
	) + (
		select count(*)
		from public.official_food_safety_alert_matches alert_match
		where alert_match.status = 'needs_review'
	) as catalog_review,
	(
		select count(*)
		from public.food_compatibility_feedback feedback
		where feedback.status = 'pending'
	) as food_warnings,
	(
		select count(*)
		from (
			select report.reported_profile_user_id, report.avatar_path
			from public.profile_image_reports report
			where report.status = 'pending'
			group by report.reported_profile_user_id, report.avatar_path
		) exact_images
	) as profile_images,
	(
		select count(*)
		from (
			select occurrence.subject_type, occurrence.subject_key
			from public.catalog_health_issue_occurrences occurrence
			join public.app_issue_codes issue
				on issue.code = occurrence.issue_code
			where occurrence.status = 'open'
				and issue.enabled
				and issue.responsible_group = 'data_operations'
			group by occurrence.subject_type, occurrence.subject_key
		) actionable_subjects
	) as data_operations;

grant select on expected_privileged_action_counts to authenticated;

insert into auth.users (id, aud, role, email)
values
	('7a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'privileged-summary-moderator@blendcalc.local'),
	('7a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'privileged-summary-admin@blendcalc.local');

insert into public.app_role_assignments (user_id, role)
values
	('7a000000-0000-4000-8000-000000000001', 'moderator'),
	('7a000000-0000-4000-8000-000000000002', 'admin');

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'7a000000-0000-4000-8000-000000000001',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"7a000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"moderator","aal":"aal1"}',
	true
);

select throws_ok(
	$$select public.get_privileged_tool_action_summary()$$,
	'42501',
	'MFA-verified privileged-tool access is required.',
	'privileged action counts require AAL2'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"7a000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"moderator","aal":"aal2"}',
	true
);

select lives_ok(
	$$select public.get_privileged_tool_action_summary()$$,
	'MFA-verified moderators can read their permitted action counts'
);

select is(
	(public.get_privileged_tool_action_summary() ->> 'pendingProductSubmissions')::bigint,
	(select product_submissions from expected_privileged_action_counts),
	'product submissions use an exact pending count'
);

select is(
	(public.get_privileged_tool_action_summary() ->> 'pendingCatalogReviewItems')::bigint,
	(select catalog_review from expected_privileged_action_counts),
	'catalog review combines every exact decision queue count'
);

select is(
	(public.get_privileged_tool_action_summary() ->> 'pendingFoodWarningReports')::bigint,
	(select food_warnings from expected_privileged_action_counts),
	'food warnings use an exact pending count'
);

select is(
	(public.get_privileged_tool_action_summary() ->> 'pendingProfileImageReviews')::bigint,
	(select profile_images from expected_privileged_action_counts),
	'profile-image reports are deduplicated by exact reported image'
);

select is(
	(public.get_privileged_tool_action_summary() ->> 'pendingCatalogDataOperations')::bigint,
	0::bigint,
	'moderators receive no data-operations action count'
);

select is(
	(public.get_privileged_tool_action_summary() ->> 'totalActionableItems')::bigint,
	(
		select product_submissions + catalog_review + food_warnings + profile_images
		from expected_privileged_action_counts
	),
	'moderator aggregate sums only permitted genuine action queues'
);

select set_config(
	'request.jwt.claim.sub',
	'7a000000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"7a000000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select is(
	(public.get_privileged_tool_action_summary() ->> 'pendingCatalogDataOperations')::bigint,
	(select data_operations from expected_privileged_action_counts),
	'data operations counts distinct actionable subjects exactly once'
);

select is(
	(public.get_privileged_tool_action_summary() ->> 'totalActionableItems')::bigint,
	(
		select
			product_submissions
			+ catalog_review
			+ food_warnings
			+ profile_images
			+ data_operations
		from expected_privileged_action_counts
	),
	'admin aggregate includes every permitted genuine action queue'
);

select ok(
	not public.get_privileged_tool_action_summary() ? 'pendingAccountAccess',
	'search-only Account access is not represented as an action count'
);

reset role;
delete from public.app_role_assignments
where user_id = '7a000000-0000-4000-8000-000000000002';
set local role authenticated;

select throws_ok(
	$$select public.get_privileged_tool_action_summary()$$,
	'42501',
	'MFA-verified privileged-tool access is required.',
	'a stale elevated JWT cannot bypass the live role assignment'
);

select * from finish();

rollback;
