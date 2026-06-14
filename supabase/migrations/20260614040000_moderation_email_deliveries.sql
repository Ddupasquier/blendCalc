create table public.moderation_email_deliveries (
	id uuid primary key default gen_random_uuid(),
	moderation_action_id uuid not null unique
		references public.moderation_actions(id) on delete cascade,
	target_user_id uuid not null references auth.users(id) on delete cascade,
	recipient_email_hash text not null check (recipient_email_hash ~ '^[a-f0-9]{64}$'),
	template text not null check (template in ('account_blocked')),
	provider text not null default 'resend' check (provider in ('resend')),
	status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
	provider_message_id text,
	error_code text,
	error_message text,
	created_at timestamptz not null default now(),
	attempted_at timestamptz,
	sent_at timestamptz,
	check (status <> 'sent' or (provider_message_id is not null and sent_at is not null)),
	check (status <> 'failed' or error_message is not null)
);

create index moderation_email_deliveries_target_user_id_idx
	on public.moderation_email_deliveries (target_user_id, created_at desc);

create index moderation_email_deliveries_failed_idx
	on public.moderation_email_deliveries (created_at desc)
	where status = 'failed';

alter table public.moderation_email_deliveries enable row level security;
revoke all on table public.moderation_email_deliveries from anon, authenticated;
