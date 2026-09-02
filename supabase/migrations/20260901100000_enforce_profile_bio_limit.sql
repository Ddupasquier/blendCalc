begin;

update public.profiles
set bio = left(bio, 150)
where bio is not null
	and char_length(bio) > 150;

alter table public.profiles
	drop constraint if exists profiles_bio_check;

alter table public.profiles
	add constraint profiles_bio_check
	check (bio is null or char_length(bio) <= 150);

commit;
