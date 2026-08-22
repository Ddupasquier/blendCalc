update public.profiles
set bio = left(bio, 150)
where char_length(bio) > 150;

alter table public.profiles
	drop constraint if exists profiles_bio_check;

alter table public.profiles
	add constraint profiles_bio_check
	check (bio is null or char_length(bio) <= 150);

comment on column public.profiles.bio is
	'Optional user-written profile biography limited to 150 characters.';
