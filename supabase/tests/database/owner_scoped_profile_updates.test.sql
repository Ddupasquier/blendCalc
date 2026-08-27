begin;

select plan(21);

select has_function('public', 'save_current_user_profile_details', 'profile detail saves have a narrow owner-scoped function');
select has_function('public', 'save_current_user_appearance_theme', 'appearance saves have a narrow owner-scoped function');
select has_function('public', 'save_current_user_playful_message_preference', 'playful-message saves have a narrow owner-scoped function');
select has_function('public', 'save_current_user_profile_image', 'profile image activation has a narrow owner-scoped function');
select has_function('public', 'save_current_user_profile_image_description', 'profile image descriptions have a narrow owner-scoped function');
select has_function('public', 'clear_current_user_profile_image', 'profile image removal has a narrow owner-scoped function');

select ok(
	has_function_privilege('authenticated', 'public.save_current_user_profile_details(text,text)', 'EXECUTE')
		and has_function_privilege('authenticated', 'public.save_current_user_appearance_theme(text)', 'EXECUTE')
		and has_function_privilege('authenticated', 'public.save_current_user_playful_message_preference(boolean)', 'EXECUTE')
		and has_function_privilege('authenticated', 'public.save_current_user_profile_image(text,text,text)', 'EXECUTE')
		and has_function_privilege('authenticated', 'public.save_current_user_profile_image_description(text,text)', 'EXECUTE')
		and has_function_privilege('authenticated', 'public.clear_current_user_profile_image(text)', 'EXECUTE')
		and not has_function_privilege('anon', 'public.save_current_user_profile_details(text,text)', 'EXECUTE'),
	'authenticated accounts receive only the intentional owner-scoped profile functions'
);

insert into auth.users (id, aud, role, email)
values
	('77000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'profile-owner-one@blendcalc.local'),
	('77000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'profile-owner-two@blendcalc.local');

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"77000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user"}',
	true
);

select lives_ok(
	$$ select public.save_current_user_profile_details('Profile Owner', 'Short profile bio') $$,
	'an authenticated account can save its own validated profile details'
);
select is(
	(select display_name from public.profiles where user_id = auth.uid()),
	'Profile Owner',
	'profile details update only the authenticated account'
);
select throws_ok(
	$$ select public.save_current_user_profile_details('Profile Owner', repeat('x', 151)) $$,
	'22023',
	'Bio must contain 150 characters or fewer.',
	'the owner-scoped function enforces the application bio limit'
);
select lives_ok(
	$$ select public.save_current_user_appearance_theme('dark') $$,
	'an authenticated account can save its own validated appearance theme'
);
select is(
	(select appearance_theme from public.profiles where user_id = auth.uid()),
	'dark',
	'the appearance function changes only the intended preference'
);
select is(
	public.save_current_user_playful_message_preference(false),
	false,
	'the playful-message function returns the saved preference'
);
select is(
	(select cheeky_messages_enabled from public.profiles where user_id = auth.uid()),
	false,
	'the playful-message preference persists for the authenticated account'
);

reset role;
insert into public.profile_image_policy_acceptances (
	user_id,
	avatar_path,
	file_sha256,
	policy_version,
	policy_items
)
values (
	'77000000-0000-4000-8000-000000000001',
	'77000000-0000-4000-8000-000000000001/avatar.webp',
	repeat('a', 64),
	'2026-06-14',
	'["No explicit content"]'::jsonb
);
set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"77000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user"}',
	true
);

select lives_ok(
	$$ select public.save_current_user_profile_image(
		'77000000-0000-4000-8000-000000000001/avatar.webp',
		'Original description',
		'2026-06-14'
	) $$,
	'a policy-backed image can become the authenticated account current avatar'
);
select is(
	(select avatar_path from public.profiles where user_id = auth.uid()),
	'77000000-0000-4000-8000-000000000001/avatar.webp',
	'profile image activation stores the exact accepted path'
);
select is(
	public.save_current_user_profile_image_description(
		'77000000-0000-4000-8000-000000000001/avatar.webp',
		'Updated description'
	),
	true,
	'the owner can update the current image description without replacing the image'
);
select is(
	(select avatar_alt_text from public.profiles where user_id = auth.uid()),
	'Updated description',
	'the current image description persists'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"77000000-0000-4000-8000-000000000002","role":"authenticated","app_role":"user"}',
	true
);
select is(
	public.clear_current_user_profile_image(
		'77000000-0000-4000-8000-000000000001/avatar.webp'
	),
	false,
	'another authenticated account cannot clear the owner image'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"77000000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user"}',
	true
);
select is(
	public.clear_current_user_profile_image(
		'77000000-0000-4000-8000-000000000001/avatar.webp'
	),
	true,
	'the owner can clear the exact current image'
);
select is(
	(select avatar_path from public.profiles where user_id = auth.uid()),
	null,
	'clearing an image removes its profile metadata'
);

select * from finish();

rollback;
