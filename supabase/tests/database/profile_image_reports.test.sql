begin;

select plan(15);

select has_table(
	'public',
	'profile_image_reports',
	'profile-image reports have a dedicated moderation table'
);

select columns_are(
	'public',
	'profile_image_reports',
	array[
		'id',
		'reported_profile_user_id',
		'avatar_path',
		'reported_by',
		'reason_code',
		'details',
		'status',
		'reviewed_by',
		'reviewed_at',
		'review_note',
		'created_at',
		'updated_at'
	],
	'reports preserve the exact image, concern, lifecycle, and review evidence'
);

select is(
	(select relrowsecurity from pg_class where oid = 'public.profile_image_reports'::regclass),
	true,
	'profile-image reports have row-level security enabled'
);

select is(
	(select relforcerowsecurity from pg_class where oid = 'public.profile_image_reports'::regclass),
	true,
	'profile-image report row-level security is forced'
);

select ok(
	not has_table_privilege('authenticated', 'public.profile_image_reports', 'SELECT')
		and not has_table_privilege('authenticated', 'public.profile_image_reports', 'INSERT')
		and not has_table_privilege('authenticated', 'public.profile_image_reports', 'UPDATE'),
	'ordinary browser clients cannot inspect or mutate private reports directly'
);

select ok(
	has_table_privilege('service_role', 'public.profile_image_reports', 'SELECT')
		and has_table_privilege('service_role', 'public.profile_image_reports', 'INSERT')
		and has_table_privilege('service_role', 'public.profile_image_reports', 'UPDATE'),
	'trusted server workflows can create and review reports'
);

select has_function(
	'public',
	'get_pending_profile_image_review_count',
	'profile-image review counts are grouped by exact image in the database'
);

select ok(
	has_function_privilege(
		'service_role',
		'public.get_pending_profile_image_review_count()',
		'EXECUTE'
	)
		and not has_function_privilege(
			'authenticated',
			'public.get_pending_profile_image_review_count()',
			'EXECUTE'
		),
	'only trusted server workflows can read the private review count'
);

insert into auth.users (id, aud, role, email)
values
	(
		'76000000-0000-4000-8000-000000000001',
		'authenticated',
		'authenticated',
		'profile-image-owner@blendcalc.local'
	),
	(
		'76000000-0000-4000-8000-000000000002',
		'authenticated',
		'authenticated',
		'profile-image-reporter@blendcalc.local'
	),
	(
		'76000000-0000-4000-8000-000000000003',
		'authenticated',
		'authenticated',
		'profile-image-moderator@blendcalc.local'
	);

update public.profiles
set
	display_name = 'Profile Image Owner',
	avatar_path = '76000000-0000-4000-8000-000000000001/avatar.webp',
	avatar_alt_text = 'Profile image fixture',
	avatar_moderation_status = 'self_attested'
where user_id = '76000000-0000-4000-8000-000000000001';

insert into public.profile_image_reports (
	reported_profile_user_id,
	avatar_path,
	reported_by,
	reason_code,
	details
)
values (
	'76000000-0000-4000-8000-000000000001',
	'76000000-0000-4000-8000-000000000001/avatar.webp',
	'76000000-0000-4000-8000-000000000002',
	'impersonation',
	'This image appears to belong to someone else.'
);

select is(
	(
		select status
		from public.profile_image_reports
		where reported_by = '76000000-0000-4000-8000-000000000002'
	),
	'pending',
	'a valid report enters the pending queue'
);

select throws_ok(
	$$
		insert into public.profile_image_reports (
			reported_profile_user_id,
			avatar_path,
			reported_by,
			reason_code
		)
		values (
			'76000000-0000-4000-8000-000000000001',
			'76000000-0000-4000-8000-000000000001/avatar.webp',
			'76000000-0000-4000-8000-000000000001',
			'other'
		)
	$$,
	23514,
	null,
	'a user cannot report their own profile image'
);

select throws_ok(
	$$
		insert into public.profile_image_reports (
			reported_profile_user_id,
			avatar_path,
			reported_by,
			reason_code
		)
		values (
			'76000000-0000-4000-8000-000000000001',
			'76000000-0000-4000-8000-000000000001/not-current.webp',
			'76000000-0000-4000-8000-000000000003',
			'other'
		)
	$$,
	'P0001',
	'Profile image report must reference the current profile image.',
	'a report cannot target a stale or invented image path'
);

update public.profiles
set
	avatar_path = '76000000-0000-4000-8000-000000000001/replacement.webp',
	avatar_moderation_status = 'self_attested'
where user_id = '76000000-0000-4000-8000-000000000001';

select is(
	(
		select status
		from public.profile_image_reports
		where reported_by = '76000000-0000-4000-8000-000000000002'
	),
	'superseded',
	'replacing the reported image closes its pending reports without reviewing the new image'
);

select throws_ok(
	$$
		update public.profile_image_reports
		set status = 'removed'
		where reported_by = '76000000-0000-4000-8000-000000000002'
	$$,
	23514,
	null,
	'a final moderation outcome requires reviewer evidence'
);

select trigger_is(
	'public',
	'profile_image_reports',
	'validate_profile_image_report_before_insert',
	'public',
	'validate_profile_image_report',
	'report inserts validate the exact current image'
);

select trigger_is(
	'public',
	'profiles',
	'supersede_replaced_profile_image_reports_after_update',
	'public',
	'supersede_replaced_profile_image_reports',
	'profile-image replacement closes stale report work'
);

select * from finish();

rollback;
