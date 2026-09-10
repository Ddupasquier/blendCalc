begin;

select plan(28);

select has_table('public', 'marketing_email_topics', 'marketing email topics have a DB-owned catalog');
select has_table('public', 'user_marketing_email_preferences', 'accounts have normalized per-topic marketing preferences');
select has_table('public', 'marketing_email_preference_events', 'marketing preference changes have append-only evidence');
select has_function('public', 'save_current_user_marketing_email_preferences', 'authenticated accounts have one atomic preference save function');
select has_function('public', 'get_current_user_marketing_email_preferences', 'authenticated accounts have one effective preference read function');

select is(
	(select count(*)::integer from public.marketing_email_topics where enabled),
	3,
	'the initial catalog exposes the three approved optional email categories'
);
select hasnt_column(
	'public',
	'user_marketing_email_preferences',
	'email',
	'preferences do not duplicate Auth email addresses'
);
select hasnt_column(
	'public',
	'marketing_email_preference_events',
	'email',
	'consent history does not duplicate Auth email addresses'
);
select ok(
	has_function_privilege(
		'authenticated',
		'public.save_current_user_marketing_email_preferences(jsonb,text)',
		'EXECUTE'
	)
		and has_function_privilege(
			'authenticated',
			'public.get_current_user_marketing_email_preferences()',
			'EXECUTE'
		)
		and not has_function_privilege(
			'anon',
			'public.save_current_user_marketing_email_preferences(jsonb,text)',
			'EXECUTE'
		)
		and has_function_privilege(
			'service_role',
			'public.apply_user_marketing_email_preferences(uuid,jsonb,text,text)',
			'EXECUTE'
		),
	'only authenticated accounts can use the owner-scoped preference functions'
);

insert into auth.users (id, aud, role, email)
values
	('78000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'marketing-owner-one@blendcalc.local'),
	('78000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'marketing-owner-two@blendcalc.local');

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"78000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user"}',
	true
);

select results_eq(
	$$
		select topic_key, is_subscribed
		from public.get_current_user_marketing_email_preferences()
	$$,
	$$
		values
			('product_and_launch_updates'::text, false),
			('mvp_testing_invitations'::text, false),
			('tips_recipes_and_education'::text, false)
	$$,
	'an existing account with no saved rows is effectively unsubscribed from every topic'
);

select lives_ok(
	$$
		select *
		from public.save_current_user_marketing_email_preferences(
			'{"product_and_launch_updates":true,"mvp_testing_invitations":true,"tips_recipes_and_education":false}'::jsonb,
			'marketing-consent-2026-09-09'
		)
	$$,
	'an authenticated account can atomically save every optional category'
);
select is(
	(select count(*)::integer from public.user_marketing_email_preferences where user_id = auth.uid()),
	3,
	'the first explicit choice creates one current row per topic'
);
select is(
	(
		select count(*)::integer
		from public.user_marketing_email_preferences
		where user_id = auth.uid() and is_subscribed
	),
	2,
	'the exact mixed subscription choices persist'
);
select is(
	(select count(*)::integer from public.marketing_email_preference_events where user_id = auth.uid()),
	3,
	'the first explicit choice records one evidence event per topic'
);
select is(
	(
		select count(distinct source)::integer
		from public.marketing_email_preference_events
		where user_id = auth.uid() and source = 'profile'
	),
	1,
	'authenticated Profile changes record their source'
);

select lives_ok(
	$$
		select *
		from public.save_current_user_marketing_email_preferences(
			'{"product_and_launch_updates":true,"mvp_testing_invitations":true,"tips_recipes_and_education":false}'::jsonb,
			'marketing-consent-2026-09-09'
		)
	$$,
	'an unchanged explicit choice can be saved safely'
);
select is(
	(select count(*)::integer from public.marketing_email_preference_events where user_id = auth.uid()),
	3,
	'saving an unchanged choice does not manufacture duplicate consent events'
);

select lives_ok(
	$$
		select *
		from public.save_current_user_marketing_email_preferences(
			'{"product_and_launch_updates":false,"mvp_testing_invitations":true,"tips_recipes_and_education":false}'::jsonb,
			'marketing-consent-2026-09-09'
		)
	$$,
	'an account can opt out of one category without changing the others'
);
select is(
	(select count(*)::integer from public.marketing_email_preference_events where user_id = auth.uid()),
	4,
	'changing one topic appends exactly one new evidence event'
);
select throws_ok(
	$$
		select *
		from public.save_current_user_marketing_email_preferences(
			'{"product_and_launch_updates":true}'::jsonb,
			'marketing-consent-2026-09-09'
		)
	$$,
	'22023',
	'Marketing email preferences must include every available topic.',
	'partial saves cannot silently leave a category in an unintended state'
);
select throws_ok(
	$$
		select *
		from public.save_current_user_marketing_email_preferences(
			'{"product_and_launch_updates":true,"mvp_testing_invitations":true,"tips_recipes_and_education":false,"unknown":true}'::jsonb,
			'marketing-consent-2026-09-09'
		)
	$$,
	'22023',
	'Marketing email preferences include an unsupported topic.',
	'unknown categories are rejected'
);
select throws_ok(
	$$
		select *
		from public.save_current_user_marketing_email_preferences(
			'{"product_and_launch_updates":true,"mvp_testing_invitations":true,"tips_recipes_and_education":false}'::jsonb,
			'Invalid version'
		)
	$$,
	'22023',
	'Marketing email consent version is invalid.',
	'invalid consent-copy versions are rejected'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"78000000-0000-4000-8000-000000000002","role":"authenticated","app_role":"user"}',
	true
);
select is(
	(select count(*)::integer from public.user_marketing_email_preferences),
	0,
	'row-level security hides another account current preferences'
);
select is(
	(select count(*)::integer from public.marketing_email_preference_events),
	0,
	'row-level security hides another account consent history'
);

reset role;

insert into auth.users (id, aud, role, email, raw_user_meta_data)
values (
	'78000000-0000-4000-8000-000000000003',
	'authenticated',
	'authenticated',
	'marketing-registration-opt-in@blendcalc.local',
	'{"marketing_email_opt_in":true,"marketing_email_consent_version":"marketing-consent-2026-09-09"}'::jsonb
);
select is(
	(
		select count(*)::integer
		from public.user_marketing_email_preferences
		where user_id = '78000000-0000-4000-8000-000000000003'
			and is_subscribed
	),
	3,
	'an explicit registration opt-in subscribes the new account to every current category'
);
select is(
	(
		select count(*)::integer
		from public.marketing_email_preference_events
		where user_id = '78000000-0000-4000-8000-000000000003'
			and source = 'registration'
	),
	3,
	'registration consent records one sourced event per category'
);

insert into auth.users (id, aud, role, email)
values (
	'78000000-0000-4000-8000-000000000004',
	'authenticated',
	'authenticated',
	'marketing-default-off@blendcalc.local'
);
select is(
	(
		select count(*)::integer
		from public.user_marketing_email_preferences
		where user_id = '78000000-0000-4000-8000-000000000004'
	),
	0,
	'accounts created outside the reviewed registration choice remain unsubscribed'
);
select is(
	(
		select count(*)::integer
		from public.user_marketing_email_preferences
		where is_subscribed
	),
	4,
	'no default path creates an additional subscription'
);

select * from finish();

rollback;
