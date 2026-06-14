update public.profiles
set display_name = username
where display_name is null
	and username is not null;

drop index if exists public.profiles_username_unique_idx;

alter table public.profiles
	drop column username;
