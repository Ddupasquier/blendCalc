begin;

select plan(37);

select has_type('public', 'app_role', 'application roles use a database enum');
select has_type('public', 'app_permission', 'application permissions use a database enum');
select has_table('public', 'app_role_permissions', 'role permissions are database-backed');

select ok(
	(select relrowsecurity from pg_class where oid = 'public.app_role_permissions'::regclass),
	'role permissions have RLS enabled'
);

select ok(
	not has_table_privilege('authenticated', 'public.app_role_permissions', 'select'),
	'ordinary authenticated clients cannot enumerate role permissions directly'
);

select ok(
	not has_table_privilege('authenticated', 'public.app_role_assignments', 'insert')
		and not has_table_privilege('authenticated', 'public.app_role_assignments', 'update')
		and not has_table_privilege('authenticated', 'public.app_role_assignments', 'delete'),
	'ordinary authenticated clients cannot assign roles'
);

select ok(
	not has_table_privilege('service_role', 'public.app_role_assignments', 'insert')
		and not has_table_privilege('service_role', 'public.app_role_assignments', 'update')
		and not has_table_privilege('service_role', 'public.app_role_assignments', 'delete')
		and not has_table_privilege('service_role', 'public.app_role_assignments', 'truncate')
		and not has_table_privilege('service_role', 'public.app_role_assignments', 'references')
		and not has_table_privilege('service_role', 'public.app_role_assignments', 'trigger'),
	'the service role must use the atomic role-change function'
);

select has_function(
	'public',
	'custom_access_token_hook',
	array['jsonb'],
	'the custom access-token role hook exists'
);

select function_returns(
	'public',
	'custom_access_token_hook',
	array['jsonb'],
	'jsonb',
	'the role hook returns the Auth hook payload'
);

select is(
	(
		select prosecdef
		from pg_proc
		where oid = 'public.custom_access_token_hook(jsonb)'::regprocedure
	),
	true,
	'the role hook runs with controlled definer privileges'
);

select is(
	(
		select provolatile
		from pg_proc
		where oid = 'public.custom_access_token_hook(jsonb)'::regprocedure
	),
	's'::"char",
	'the role hook is stable for one token-issuance statement'
);

select ok(
	has_function_privilege(
		'supabase_auth_admin',
		'public.custom_access_token_hook(jsonb)',
		'execute'
	),
	'Supabase Auth can execute the role hook'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.custom_access_token_hook(jsonb)',
		'execute'
	)
		and not has_function_privilege(
			'authenticated',
			'public.custom_access_token_hook(jsonb)',
			'execute'
		)
		and not has_function_privilege(
			'service_role',
			'public.custom_access_token_hook(jsonb)',
			'execute'
		),
	'non-Auth API roles cannot execute the role hook'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.authorize_app_permission(public.app_permission)',
		'execute'
	),
	'authenticated RLS policies can evaluate application permissions'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.authorize_app_permission(public.app_permission)',
		'execute'
	),
	'anonymous clients cannot evaluate application permissions'
);

select ok(
	has_function_privilege(
		'service_role',
		'public.set_app_user_role(uuid,public.app_role,uuid,text,text)',
		'execute'
	),
	'the trusted server role can execute atomic role changes'
);

select ok(
	not has_function_privilege(
		'authenticated',
		'public.set_app_user_role(uuid,public.app_role,uuid,text,text)',
		'execute'
	),
	'authenticated clients cannot execute role changes'
);

insert into auth.users (id, aud, role, email)
values
	(
		'72000000-0000-4000-8000-000000000001',
		'authenticated',
		'authenticated',
		'rbac-user@blendcalc.local'
	),
	(
		'72000000-0000-4000-8000-000000000002',
		'authenticated',
		'authenticated',
		'rbac-moderator@blendcalc.local'
	),
	(
		'72000000-0000-4000-8000-000000000003',
		'authenticated',
		'authenticated',
		'rbac-admin@blendcalc.local'
	);

insert into public.app_role_assignments (user_id, role)
values
	('72000000-0000-4000-8000-000000000002', 'moderator'),
	('72000000-0000-4000-8000-000000000003', 'admin');

select is(
	public.custom_access_token_hook(
		'{"user_id":"72000000-0000-4000-8000-000000000001","claims":{"role":"authenticated","app_role":"admin"}}'::jsonb
	) #>> '{claims,app_role}',
	'user',
	'a normal user receives only the non-elevated user claim'
);

select is(
	public.custom_access_token_hook(
		'{"user_id":"72000000-0000-4000-8000-000000000002","claims":{"role":"authenticated"}}'::jsonb
	) #>> '{claims,app_role}',
	'moderator',
	'a moderator receives the moderator application claim'
);

select is(
	public.custom_access_token_hook(
		'{"user_id":"72000000-0000-4000-8000-000000000003","claims":{"role":"authenticated"}}'::jsonb
	) #>> '{claims,app_role}',
	'admin',
	'an administrator receives the admin application claim'
);

select is(
	public.custom_access_token_hook(
		'{"user_id":"72000000-0000-4000-8000-000000000002","claims":{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002"}}'::jsonb
	) #>> '{claims,sub}',
	'72000000-0000-4000-8000-000000000002',
	'the role hook preserves required Auth claims'
);

update public.app_role_assignments
set role = 'admin'
where user_id = '72000000-0000-4000-8000-000000000002';

select is(
	public.custom_access_token_hook(
		'{"user_id":"72000000-0000-4000-8000-000000000002","claims":{"role":"authenticated"}}'::jsonb
	) #>> '{claims,app_role}',
	'admin',
	'the next issued token reflects a changed application role'
);

delete from public.app_role_assignments
where user_id = '72000000-0000-4000-8000-000000000002';

select is(
	public.custom_access_token_hook(
		'{"user_id":"72000000-0000-4000-8000-000000000002","claims":{"role":"authenticated","app_role":"moderator"}}'::jsonb
	) #>> '{claims,app_role}',
	'user',
	'the next issued token removes a revoked elevated role'
);

select is(
	public.custom_access_token_hook(
		'{"user_id":"not-a-uuid","claims":{"role":"authenticated","app_role":"admin"}}'::jsonb
	) #>> '{claims,app_role}',
	'user',
	'malformed hook input fails closed as a normal user'
);

select ok(
	not has_table_privilege(
		'supabase_auth_admin',
		'public.app_role_assignments',
		'select'
	),
	'the Auth service does not receive direct role-assignment table access'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user"}',
	true
);

select ok(
	not public.authorize_app_permission('moderation.access'),
	'normal users do not receive moderation access'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"owner"}',
	true
);

select ok(
	not public.authorize_app_permission('moderation.access'),
	'an unsupported signed application role fails closed'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated","app_role":"moderator"}',
	true
);

select ok(
	not public.authorize_app_permission('moderation.catalog.review'),
	'elevated roles cannot use protected permissions before MFA verification'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated","app_role":"moderator","aal":"aal2"}',
	true
);

select ok(
	public.authorize_app_permission('moderation.catalog.review'),
	'MFA-verified moderators can review catalog submissions'
);

select ok(
	not public.authorize_app_permission('moderation.roles.manage'),
	'moderators cannot manage application roles'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72000000-0000-4000-8000-000000000003","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select ok(
	public.authorize_app_permission('moderation.roles.manage'),
	'MFA-verified admins can manage application roles'
);

reset role;

set local role service_role;

select ok(
	public.set_app_user_role(
		'72000000-0000-4000-8000-000000000001',
		'moderator',
		null,
		'pg_tap_role_grant',
		'RBAC migration regression test.'
	),
	'the service role can grant an elevated role atomically'
);

select ok(
	not public.set_app_user_role(
		'72000000-0000-4000-8000-000000000001',
		'moderator',
		null,
		'pg_tap_role_grant',
		'RBAC migration regression test.'
	),
	'an identical role assignment is an idempotent no-op'
);

reset role;

select is(
	(
		select assignment.role::text
		from public.app_role_assignments assignment
		where assignment.user_id = '72000000-0000-4000-8000-000000000001'
	),
	'moderator',
	'the atomic role change stores the assignment'
);

select is(
	(
		select count(*)::integer
		from public.moderation_actions action
		where action.target_user_id = '72000000-0000-4000-8000-000000000001'
			and action.action = 'role_granted'
			and action.reason_code = 'pg_tap_role_grant'
	),
	1,
	'the atomic role change records exactly one audit action'
);

select ok(
	not has_table_privilege('service_role', 'public.app_role_permissions', 'insert')
		and not has_table_privilege('service_role', 'public.app_role_permissions', 'update')
		and not has_table_privilege('service_role', 'public.app_role_permissions', 'delete'),
	'role-permission policy changes require a reviewed migration'
);

select throws_ok(
	$$
		select public.set_app_user_role(
			'72000000-0000-4000-8000-000000000099',
			'moderator',
			null,
			'pg_tap_missing_user',
			null
		)
	$$,
	'22023',
	'Target Auth user does not exist.',
	'role changes reject missing Auth users'
);

select * from finish();

rollback;
