create table public.profiles (
	user_id uuid primary key references auth.users(id) on delete cascade,
	username text,
	display_name text,
	bio text,
	avatar_path text,
	avatar_alt_text text,
	avatar_moderation_status text not null default 'none'
		check (avatar_moderation_status in ('none', 'self_attested', 'approved', 'rejected')),
	avatar_policy_acknowledged_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (username is null or username ~ '^[A-Za-z0-9_]{3,30}$'),
	check (display_name is null or char_length(display_name) between 1 and 80),
	check (bio is null or char_length(bio) <= 300),
	check (avatar_alt_text is null or char_length(avatar_alt_text) <= 160)
);

create unique index profiles_username_unique_idx
	on public.profiles (lower(username))
	where username is not null;

create trigger set_profiles_updated_at
	before update on public.profiles
	for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Users can read their profile"
	on public.profiles
	for select
	to authenticated
	using (user_id = (select auth.uid()));

create policy "Users can create their profile"
	on public.profiles
	for insert
	to authenticated
	with check (user_id = (select auth.uid()));

create policy "Users can update their profile"
	on public.profiles
	for update
	to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

create policy "Users can delete their profile"
	on public.profiles
	for delete
	to authenticated
	using (user_id = (select auth.uid()));

revoke all on table public.profiles from anon;
grant select, insert, update, delete on table public.profiles to authenticated;

insert into storage.buckets (
	id,
	name,
	public,
	file_size_limit,
	allowed_mime_types
)
values (
	'profile-avatars',
	'profile-avatars',
	false,
	5242880,
	array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their avatar files"
	on storage.objects
	for select
	to authenticated
	using (
		bucket_id = 'profile-avatars'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

create policy "Users can upload their avatar files"
	on storage.objects
	for insert
	to authenticated
	with check (
		bucket_id = 'profile-avatars'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

create policy "Users can update their avatar files"
	on storage.objects
	for update
	to authenticated
	using (
		bucket_id = 'profile-avatars'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	)
	with check (
		bucket_id = 'profile-avatars'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);

create policy "Users can delete their avatar files"
	on storage.objects
	for delete
	to authenticated
	using (
		bucket_id = 'profile-avatars'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);
