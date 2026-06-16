create or replace function public.default_profile_display_name(p_user_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
	with generated_name as (
		select
			(('x' || substr(md5(p_user_id::text), 1, 15))::bit(60)::bigint)::text as hash_digits
	)
	select
		'User' || left(
			hash_digits || repeat('0', 14),
			14
		)
	from generated_name;
$$;

create or replace function public.set_default_profile_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.display_name is null or btrim(new.display_name) = '' then
		new.display_name := public.default_profile_display_name(new.user_id);
	end if;

	return new;
end;
$$;

create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.profiles (user_id, display_name)
	values (new.id, public.default_profile_display_name(new.id))
	on conflict (user_id) do update
	set display_name = excluded.display_name
	where public.profiles.display_name is null
		or btrim(public.profiles.display_name) = '';

	return new;
end;
$$;

drop trigger if exists set_profiles_default_display_name on public.profiles;
create trigger set_profiles_default_display_name
	before insert or update of display_name on public.profiles
	for each row execute function public.set_default_profile_display_name();

drop trigger if exists create_profile_for_new_auth_user on auth.users;
create trigger create_profile_for_new_auth_user
	after insert on auth.users
	for each row execute function public.create_profile_for_new_auth_user();

insert into public.profiles (user_id, display_name)
select
	auth_users.id,
	public.default_profile_display_name(auth_users.id)
from auth.users as auth_users
on conflict (user_id) do update
set
	display_name = public.default_profile_display_name(excluded.user_id),
	updated_at = now()
where public.profiles.display_name is null
	or btrim(public.profiles.display_name) = '';

alter table public.profiles
	alter column display_name set not null;

alter table public.profiles
	drop constraint if exists profiles_display_name_not_blank;

alter table public.profiles
	add constraint profiles_display_name_not_blank
	check (btrim(display_name) <> '');

revoke all on function public.default_profile_display_name(uuid) from public, anon, authenticated;
revoke all on function public.set_default_profile_display_name() from public, anon, authenticated;
revoke all on function public.create_profile_for_new_auth_user() from public, anon, authenticated;
