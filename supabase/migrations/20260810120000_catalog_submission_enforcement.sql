create table public.user_catalog_submission_enforcement (
	user_id uuid primary key references auth.users(id) on delete cascade,
	moderator_rejection_count integer not null default 0
		check (moderator_rejection_count >= 0),
	sharing_suspended_until timestamptz,
	latest_rejected_submission_id uuid
		references public.shared_product_submissions(id) on delete set null,
	latest_rejected_by uuid references auth.users(id) on delete set null,
	latest_rejected_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint user_catalog_submission_enforcement_suspension_count_check check (
		sharing_suspended_until is null or moderator_rejection_count > 50
	)
);

create index user_catalog_submission_enforcement_suspended_until_idx
	on public.user_catalog_submission_enforcement (sharing_suspended_until desc)
	where sharing_suspended_until is not null;

create trigger set_user_catalog_submission_enforcement_updated_at
	before update on public.user_catalog_submission_enforcement
	for each row execute function public.set_updated_at();

alter table public.user_catalog_submission_enforcement enable row level security;
alter table public.user_catalog_submission_enforcement force row level security;

create policy "Users can read their catalog submission enforcement"
	on public.user_catalog_submission_enforcement
	for select
	to authenticated
	using (user_id = (select auth.uid()));

revoke all on table public.user_catalog_submission_enforcement
	from public, anon, authenticated;
grant select on table public.user_catalog_submission_enforcement to authenticated;
grant select, insert, update, delete
	on table public.user_catalog_submission_enforcement
	to service_role;

comment on table public.user_catalog_submission_enforcement is
	'Current per-user public catalog submission enforcement state. Moderator rejections are cumulative; automated declines do not count.';

with rejection_summary as (
	select
		submission.submitted_by as user_id,
		count(*)::integer as moderator_rejection_count,
		min(coalesce(submission.reviewed_at, submission.updated_at, submission.created_at))
			as first_rejected_at,
		max(coalesce(submission.reviewed_at, submission.updated_at, submission.created_at))
			as latest_rejected_at
	from public.shared_product_submissions submission
	where submission.status = 'rejected'
	group by submission.submitted_by
), latest_rejection as (
	select distinct on (submission.submitted_by)
		submission.submitted_by as user_id,
		submission.id as latest_rejected_submission_id,
		submission.reviewed_by as latest_rejected_by
	from public.shared_product_submissions submission
	where submission.status = 'rejected'
	order by
		submission.submitted_by,
		coalesce(submission.reviewed_at, submission.updated_at, submission.created_at) desc,
		submission.id desc
)
insert into public.user_catalog_submission_enforcement (
	user_id,
	moderator_rejection_count,
	sharing_suspended_until,
	latest_rejected_submission_id,
	latest_rejected_by,
	latest_rejected_at
)
select
	summary.user_id,
	summary.moderator_rejection_count,
	case
		when summary.moderator_rejection_count > 50
			and summary.latest_rejected_at + interval '6 months' > now()
		then summary.latest_rejected_at + interval '6 months'
		else null
	end,
	latest.latest_rejected_submission_id,
	latest.latest_rejected_by,
	summary.latest_rejected_at
from rejection_summary summary
join latest_rejection latest using (user_id)
on conflict (user_id) do update
set
	moderator_rejection_count = excluded.moderator_rejection_count,
	sharing_suspended_until = excluded.sharing_suspended_until,
	latest_rejected_submission_id = excluded.latest_rejected_submission_id,
	latest_rejected_by = excluded.latest_rejected_by,
	latest_rejected_at = excluded.latest_rejected_at,
	updated_at = now();

insert into public.product_submission_blocks (
	user_id,
	reason,
	rejection_count,
	window_started_at,
	window_ended_at,
	blocked_until,
	source_submission_id,
	created_by,
	notes
)
select
	enforcement.user_id,
	'too_many_rejected_submissions',
	enforcement.moderator_rejection_count,
	coalesce(
		(
			select min(coalesce(submission.reviewed_at, submission.updated_at, submission.created_at))
			from public.shared_product_submissions submission
			where submission.submitted_by = enforcement.user_id
				and submission.status = 'rejected'
		),
		enforcement.latest_rejected_at,
		now()
	),
	coalesce(enforcement.latest_rejected_at, now()),
	enforcement.sharing_suspended_until,
	enforcement.latest_rejected_submission_id,
	enforcement.latest_rejected_by,
	'Public catalog sharing suspended after more than 50 moderator-rejected submissions.'
from public.user_catalog_submission_enforcement enforcement
where enforcement.sharing_suspended_until > now()
	and not exists (
		select 1
		from public.product_submission_blocks existing_block
		where existing_block.user_id = enforcement.user_id
			and existing_block.rejection_count > 50
			and existing_block.blocked_until >= enforcement.sharing_suspended_until
	);

create or replace function private.record_moderator_catalog_submission_rejection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_enforcement public.user_catalog_submission_enforcement%rowtype;
	v_rejected_at timestamptz := coalesce(new.reviewed_at, now());
	v_first_rejected_at timestamptz;
begin
	insert into public.user_catalog_submission_enforcement (
		user_id,
		moderator_rejection_count,
		latest_rejected_submission_id,
		latest_rejected_by,
		latest_rejected_at
	)
	values (
		new.submitted_by,
		1,
		new.id,
		new.reviewed_by,
		v_rejected_at
	)
	on conflict (user_id) do update
	set
		moderator_rejection_count =
			public.user_catalog_submission_enforcement.moderator_rejection_count + 1,
		latest_rejected_submission_id = excluded.latest_rejected_submission_id,
		latest_rejected_by = excluded.latest_rejected_by,
		latest_rejected_at = excluded.latest_rejected_at,
		updated_at = now()
	returning * into v_enforcement;

	if v_enforcement.moderator_rejection_count > 50
		and (
			v_enforcement.sharing_suspended_until is null
			or v_enforcement.sharing_suspended_until <= v_rejected_at
		)
	then
		update public.user_catalog_submission_enforcement
		set sharing_suspended_until = v_rejected_at + interval '6 months'
		where user_id = new.submitted_by
		returning * into v_enforcement;

		select min(coalesce(submission.reviewed_at, submission.updated_at, submission.created_at))
		into v_first_rejected_at
		from public.shared_product_submissions submission
		where submission.submitted_by = new.submitted_by
			and submission.status = 'rejected';

		insert into public.product_submission_blocks (
			user_id,
			reason,
			rejection_count,
			window_started_at,
			window_ended_at,
			blocked_until,
			source_submission_id,
			created_by,
			notes
		)
		values (
			new.submitted_by,
			'too_many_rejected_submissions',
			v_enforcement.moderator_rejection_count,
			coalesce(v_first_rejected_at, v_rejected_at),
			v_rejected_at,
			v_enforcement.sharing_suspended_until,
			new.id,
			new.reviewed_by,
			'Public catalog sharing suspended after more than 50 moderator-rejected submissions.'
		);
	end if;

	return new;
end;
$$;

revoke all on function private.record_moderator_catalog_submission_rejection()
	from public, anon, authenticated;

create trigger record_moderator_catalog_submission_rejection
	after update of status on public.shared_product_submissions
	for each row
	when (old.status is distinct from new.status and new.status = 'rejected')
	execute function private.record_moderator_catalog_submission_rejection();
