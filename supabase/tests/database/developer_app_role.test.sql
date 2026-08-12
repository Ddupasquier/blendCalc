begin;

select plan(7);

select ok(
	'developer' = any(enum_range(null::public.app_role)::text[]),
	'the application role enum contains developer'
);

select is(
	(
		select count(*)::integer
		from public.app_role_permissions permission
		where permission.role = 'developer'
	),
	(
		select count(*)::integer
		from public.app_role_permissions permission
		where permission.role = 'admin'
	),
	'developer capabilities are explicitly mapped to the current admin capability set'
);

insert into auth.users (id, aud, role, email)
values (
	'73000000-0000-4000-8000-000000000001',
	'authenticated',
	'authenticated',
	'rbac-developer@blendcalc.local'
);

set local role service_role;

select ok(
	public.set_app_user_role(
		'73000000-0000-4000-8000-000000000001',
		'developer',
		null,
		'pg_tap_developer_role',
		'Developer role regression test.'
	),
	'the trusted role operation assigns developer atomically'
);

reset role;

select is(
	(
		select assignment.role::text
		from public.app_role_assignments assignment
		where assignment.user_id = '73000000-0000-4000-8000-000000000001'
	),
	'developer',
	'the developer assignment is stored in the role authority'
);

select is(
	public.custom_access_token_hook(
		'{"user_id":"73000000-0000-4000-8000-000000000001","claims":{"role":"authenticated"}}'::jsonb
	) #>> '{claims,app_role}',
	'developer',
	'new tokens receive the signed developer claim'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"developer","aal":"aal2"}',
	true
);

select ok(
	public.authorize_app_permission('moderation.roles.manage'),
	'the MFA-verified developer claim receives its explicitly mapped role-management capability'
);

select lives_ok(
	$$select public.get_moderator_data_health(1, 1)$$,
	'the current developer assignment passes the independent data-health role check'
);

select * from finish();

rollback;
