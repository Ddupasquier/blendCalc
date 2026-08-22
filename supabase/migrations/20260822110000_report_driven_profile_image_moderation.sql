create table public.profile_image_reports (
	id uuid primary key default gen_random_uuid(),
	reported_profile_user_id uuid not null references public.profiles(user_id) on delete cascade,
	avatar_path text not null,
	reported_by uuid not null references auth.users(id) on delete cascade,
	reason_code text not null check (
		reason_code in (
			'explicit_content',
			'graphic_violence',
			'hate_or_harassment',
			'impersonation',
			'other'
		)
	),
	details text check (details is null or char_length(details) <= 1000),
	status text not null default 'pending' check (
		status in ('pending', 'dismissed', 'removed', 'superseded')
	),
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz,
	review_note text check (review_note is null or char_length(review_note) <= 2000),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (reported_by <> reported_profile_user_id),
	check (
		(status = 'pending' and reviewed_by is null and reviewed_at is null)
		or status = 'superseded'
		or (status in ('dismissed', 'removed') and reviewed_by is not null and reviewed_at is not null)
	),
	unique (reported_by, reported_profile_user_id, avatar_path)
);

create index profile_image_reports_pending_created_at_idx
	on public.profile_image_reports (created_at, id)
	where status = 'pending';

create index profile_image_reports_profile_history_idx
	on public.profile_image_reports (reported_profile_user_id, created_at desc);

create trigger set_profile_image_reports_updated_at
	before update on public.profile_image_reports
	for each row execute function public.set_updated_at();

create or replace function public.validate_profile_image_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	current_avatar_path text;
begin
	select profile.avatar_path
	into current_avatar_path
	from public.profiles profile
	where profile.user_id = new.reported_profile_user_id
	for update;

	if current_avatar_path is null or current_avatar_path <> new.avatar_path then
		raise exception 'Profile image report must reference the current profile image.';
	end if;

	return new;
end;
$$;

create trigger validate_profile_image_report_before_insert
	before insert on public.profile_image_reports
	for each row execute function public.validate_profile_image_report();

create or replace function public.supersede_replaced_profile_image_reports()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if old.avatar_path is distinct from new.avatar_path
		and old.avatar_path is not null
		and new.avatar_moderation_status <> 'rejected'
	then
		update public.profile_image_reports
		set status = 'superseded'
		where reported_profile_user_id = old.user_id
			and avatar_path = old.avatar_path
			and status = 'pending';
	end if;

	return new;
end;
$$;

create trigger supersede_replaced_profile_image_reports_after_update
	after update of avatar_path on public.profiles
	for each row execute function public.supersede_replaced_profile_image_reports();

alter table public.profile_image_reports enable row level security;
alter table public.profile_image_reports force row level security;

create or replace function public.get_pending_profile_image_review_count()
returns bigint
language sql
stable
set search_path = ''
as $$
	select count(*)
	from (
		select 1
		from public.profile_image_reports report
		where report.status = 'pending'
		group by report.reported_profile_user_id, report.avatar_path
	) pending_images;
$$;

revoke all on table public.profile_image_reports from anon, authenticated;
grant all on table public.profile_image_reports to service_role;

revoke all on function public.get_pending_profile_image_review_count() from public, anon, authenticated;
grant execute on function public.get_pending_profile_image_review_count() to service_role;

revoke all on function public.validate_profile_image_report() from public, anon, authenticated;
revoke all on function public.supersede_replaced_profile_image_reports() from public, anon, authenticated;

comment on table public.profile_image_reports is
	'Private reports about an exact current profile image. Self-attested uploads remain usable and enter moderation only after another account reports that image.';

comment on column public.profile_image_reports.avatar_path is
	'The exact private Storage object that was visible when the report was created; replacing the image supersedes pending reports for this path.';
