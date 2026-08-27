begin;

create or replace function public.save_current_user_profile_details(
	p_display_name text,
	p_bio text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_display_name text := btrim(coalesce(p_display_name, ''));
	v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	if v_display_name = '' or char_length(v_display_name) > 25 then
		raise exception 'Display name must contain 1 to 25 characters.' using errcode = '22023';
	end if;

	if v_bio is not null and char_length(v_bio) > 150 then
		raise exception 'Bio must contain 150 characters or fewer.' using errcode = '22023';
	end if;

	insert into public.profiles (user_id, display_name, bio)
	values (v_user_id, v_display_name, v_bio)
	on conflict (user_id) do update
	set display_name = excluded.display_name,
		bio = excluded.bio;
end;
$$;

create or replace function public.save_current_user_appearance_theme(
	p_appearance_theme text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	if p_appearance_theme not in ('system', 'light', 'dark') then
		raise exception 'Appearance theme is invalid.' using errcode = '22023';
	end if;

	insert into public.profiles (user_id, display_name, appearance_theme)
	values (
		v_user_id,
		public.default_profile_display_name(v_user_id),
		p_appearance_theme
	)
	on conflict (user_id) do update
	set appearance_theme = excluded.appearance_theme;
end;
$$;

create or replace function public.save_current_user_playful_message_preference(
	p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	insert into public.profiles (
		user_id,
		display_name,
		cheeky_messages_enabled
	)
	values (
		v_user_id,
		public.default_profile_display_name(v_user_id),
		p_enabled
	)
	on conflict (user_id) do update
	set cheeky_messages_enabled = excluded.cheeky_messages_enabled;

	return p_enabled;
end;
$$;

create or replace function public.save_current_user_profile_image(
	p_avatar_path text,
	p_avatar_alt_text text,
	p_policy_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_avatar_alt_text text := nullif(btrim(coalesce(p_avatar_alt_text, '')), '');
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	if p_avatar_path is null
		or p_avatar_path = ''
		or split_part(p_avatar_path, '/', 1) <> v_user_id::text
	then
		raise exception 'Profile image path is invalid.' using errcode = '22023';
	end if;

	if v_avatar_alt_text is not null and char_length(v_avatar_alt_text) > 160 then
		raise exception 'Profile image description is too long.' using errcode = '22023';
	end if;

	if not exists (
		select 1
		from public.profile_image_policy_acceptances acceptance
		where acceptance.user_id = v_user_id
			and acceptance.avatar_path = p_avatar_path
			and acceptance.policy_version = p_policy_version
	) then
		raise exception 'Profile image policy acceptance is required.' using errcode = '23514';
	end if;

	insert into public.profiles (
		user_id,
		display_name,
		avatar_path,
		avatar_alt_text,
		avatar_moderation_status,
		avatar_policy_acknowledged_at
	)
	values (
		v_user_id,
		public.default_profile_display_name(v_user_id),
		p_avatar_path,
		v_avatar_alt_text,
		'self_attested',
		now()
	)
	on conflict (user_id) do update
	set avatar_path = excluded.avatar_path,
		avatar_alt_text = excluded.avatar_alt_text,
		avatar_moderation_status = excluded.avatar_moderation_status,
		avatar_policy_acknowledged_at = excluded.avatar_policy_acknowledged_at;
end;
$$;

create or replace function public.save_current_user_profile_image_description(
	p_expected_avatar_path text,
	p_avatar_alt_text text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_avatar_alt_text text := nullif(btrim(coalesce(p_avatar_alt_text, '')), '');
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	if v_avatar_alt_text is not null and char_length(v_avatar_alt_text) > 160 then
		raise exception 'Profile image description is too long.' using errcode = '22023';
	end if;

	update public.profiles
	set avatar_alt_text = v_avatar_alt_text
	where user_id = v_user_id
		and avatar_path = p_expected_avatar_path;

	return found;
end;
$$;

create or replace function public.clear_current_user_profile_image(
	p_expected_avatar_path text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	update public.profiles
	set avatar_path = null,
		avatar_alt_text = null,
		avatar_moderation_status = 'none',
		avatar_policy_acknowledged_at = null
	where user_id = v_user_id
		and avatar_path = p_expected_avatar_path;

	return found;
end;
$$;

revoke all on function public.save_current_user_profile_details(text, text)
	from public, anon;
revoke all on function public.save_current_user_appearance_theme(text)
	from public, anon;
revoke all on function public.save_current_user_playful_message_preference(boolean)
	from public, anon;
revoke all on function public.save_current_user_profile_image(text, text, text)
	from public, anon;
revoke all on function public.save_current_user_profile_image_description(text, text)
	from public, anon;
revoke all on function public.clear_current_user_profile_image(text)
	from public, anon;

grant execute on function public.save_current_user_profile_details(text, text)
	to authenticated;
grant execute on function public.save_current_user_appearance_theme(text)
	to authenticated;
grant execute on function public.save_current_user_playful_message_preference(boolean)
	to authenticated;
grant execute on function public.save_current_user_profile_image(text, text, text)
	to authenticated;
grant execute on function public.save_current_user_profile_image_description(text, text)
	to authenticated;
grant execute on function public.clear_current_user_profile_image(text)
	to authenticated;

comment on function public.save_current_user_profile_details(text, text) is
	'Allows an authenticated account to update only its display name and bio after database validation.';
comment on function public.save_current_user_appearance_theme(text) is
	'Allows an authenticated account to update only its appearance preference.';
comment on function public.save_current_user_playful_message_preference(boolean) is
	'Allows an authenticated account to update only its playful-message preference.';
comment on function public.save_current_user_profile_image(text, text, text) is
	'Activates an owner-scoped avatar only after trusted server code records matching policy acceptance evidence.';
comment on function public.save_current_user_profile_image_description(text, text) is
	'Updates the description of the authenticated account current avatar without replacing the image.';
comment on function public.clear_current_user_profile_image(text) is
	'Clears the authenticated account current avatar only when its exact expected path still matches.';

commit;
