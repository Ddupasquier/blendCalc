create table public.user_tutorial_preferences (
	user_id uuid primary key references auth.users(id) on delete cascade,
	tutorial_version integer not null default 1 check (tutorial_version > 0),
	do_not_show_again boolean not null default false,
	remind_after timestamptz,
	last_seen_at timestamptz not null default now(),
	completed_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create trigger set_user_tutorial_preferences_updated_at
	before update on public.user_tutorial_preferences
	for each row execute function public.set_updated_at();

alter table public.user_tutorial_preferences enable row level security;

create policy "Users can read their tutorial preferences"
	on public.user_tutorial_preferences
	for select
	to authenticated
	using (user_id = (select auth.uid()));

create policy "Users can create their tutorial preferences"
	on public.user_tutorial_preferences
	for insert
	to authenticated
	with check (user_id = (select auth.uid()));

create policy "Users can update their tutorial preferences"
	on public.user_tutorial_preferences
	for update
	to authenticated
	using (user_id = (select auth.uid()))
	with check (user_id = (select auth.uid()));

revoke all on table public.user_tutorial_preferences from anon;
grant select, insert, update on table public.user_tutorial_preferences to authenticated;
