create table if not exists public.product_submission_blocks (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	reason text not null default 'too_many_rejected_submissions'
		check (reason in ('too_many_rejected_submissions')),
	rejection_count integer not null check (rejection_count > 0),
	window_started_at timestamptz not null,
	window_ended_at timestamptz not null,
	blocked_until timestamptz not null,
	source_submission_id uuid references public.shared_product_submissions(id) on delete set null,
	created_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	notes text
);

create index if not exists product_submission_blocks_user_blocked_until_idx
	on public.product_submission_blocks (user_id, blocked_until desc);

create index if not exists shared_product_submissions_rejected_by_user_reviewed_idx
	on public.shared_product_submissions (submitted_by, reviewed_at desc)
	where status = 'rejected' and reviewed_at is not null;

alter table public.product_submission_blocks enable row level security;
alter table public.product_submission_blocks force row level security;

drop policy if exists "Users can read their product submission blocks"
	on public.product_submission_blocks;

create policy "Users can read their product submission blocks"
	on public.product_submission_blocks
	for select
	to authenticated
	using (user_id = (select auth.uid()));

revoke all on table public.product_submission_blocks from public, anon, authenticated;
grant select on table public.product_submission_blocks to authenticated;
