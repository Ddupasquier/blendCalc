begin;

select plan(17);

select enum_has_labels(
	'public',
	'app_permission',
	array[
		'moderation.access',
		'moderation.accounts.manage',
		'moderation.catalog.review',
		'moderation.warnings.review',
		'moderation.data_health.read',
		'moderation.roles.manage',
		'data_operations.catalog_health.read',
		'data_operations.catalog_health.repair',
		'data_operations.nutrient_mappings.manage'
	],
	'app permissions include explicit data-operations capabilities'
);

select is(
	(
		select count(*)
		from public.app_role_permissions permission
		where permission.permission = 'data_operations.catalog_health.read'
			and permission.role in ('admin', 'developer')
	),
	2::bigint,
	'admins and developers can read data operations'
);

select is(
	(
		select count(*)
		from public.app_role_permissions permission
		where permission.permission::text like 'data_operations.%'
			and permission.role = 'moderator'
	),
	0::bigint,
	'moderators do not receive data-operations permissions'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.get_catalog_data_operations_health(integer, integer)',
		'execute'
	),
	'authenticated sessions can reach the guarded operations summary'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.get_catalog_review_work_summary(integer)',
		'execute'
	),
	'authenticated sessions can reach the guarded catalog review summary'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.get_catalog_data_operations_monitor_summary(integer)',
		'execute'
	),
	'authenticated sessions can reach the guarded operations monitor summary'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.get_catalog_data_operations_health(integer, integer)',
		'execute'
	),
	'anonymous clients cannot read data operations'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.get_catalog_data_operations_monitor_summary(integer)',
		'execute'
	),
	'anonymous clients cannot read monitor operations'
);

insert into auth.users (id, aud, role, email)
values
	('72000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'data-operations-moderator@blendcalc.local'),
	('72000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'data-operations-admin@blendcalc.local'),
	('72000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'data-operations-developer@blendcalc.local');

insert into public.app_role_assignments (user_id, role)
values
	('72000000-0000-4000-8000-000000000001', 'moderator'),
	('72000000-0000-4000-8000-000000000002', 'admin'),
	('72000000-0000-4000-8000-000000000003', 'developer');

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'72000000-0000-4000-8000-000000000001',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"moderator","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.get_catalog_data_operations_health(30, 20)$$,
	'42501',
	'MFA-verified data-operations access is required.',
	'moderators cannot read data operations'
);

select throws_ok(
	$$select public.get_catalog_data_operations_monitor_summary(20)$$,
	'42501',
	'MFA-verified data-operations access is required.',
	'moderators cannot read monitor operations'
);

select lives_ok(
	$$select public.get_catalog_review_work_summary(20)$$,
	'moderators can read catalog review work'
);

select set_config(
	'request.jwt.claim.sub',
	'72000000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal1"}',
	true
);

select throws_ok(
	$$select public.get_catalog_data_operations_health(30, 20)$$,
	'42501',
	'MFA-verified data-operations access is required.',
	'admins must verify MFA before data operations'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select lives_ok(
	$$select public.get_catalog_data_operations_health(30, 20)$$,
	'MFA-verified admins can read data operations'
);

select lives_ok(
	$$select public.get_catalog_data_operations_monitor_summary(20)$$,
	'MFA-verified admins can read monitor operations'
);

select set_config(
	'request.jwt.claim.sub',
	'72000000-0000-4000-8000-000000000003',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"72000000-0000-4000-8000-000000000003","role":"authenticated","app_role":"developer","aal":"aal2"}',
	true
);

select lives_ok(
	$$select public.get_catalog_data_operations_health(30, 20)$$,
	'MFA-verified developers can read data operations'
);

select ok(
	public.get_catalog_data_operations_health(30, 20) ? 'sources',
	'data operations returns bounded source health'
);

select ok(
	public.get_catalog_review_work_summary(20) ? 'providerChanges'
		and public.get_catalog_review_work_summary(20) ? 'safetyMatches'
		and public.get_catalog_review_work_summary(20) ? 'conflicts',
	'catalog review work returns only its actionable queue groups'
);

select * from finish();

rollback;
