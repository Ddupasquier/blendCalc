begin;

alter default privileges for role postgres in schema public
	revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
	revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
	revoke execute on functions from public, anon, authenticated;

revoke truncate, references, trigger, maintain
	on all tables in schema public
	from anon, authenticated;

revoke insert, update, delete
	on table public.profiles
	from authenticated;

revoke insert
	on table public.profile_image_policy_acceptances
	from authenticated;

grant all
	on table public.profile_image_policy_acceptances
	to service_role;

drop policy if exists "Users can upload their avatar files"
	on storage.objects;

drop policy if exists "Users can update their avatar files"
	on storage.objects;

drop policy if exists "Users can delete their avatar files"
	on storage.objects;

drop policy if exists "Users can upload their product evidence"
	on storage.objects;

drop policy if exists "Users can delete their product evidence"
	on storage.objects;

revoke execute
	on all functions in schema public
	from public, anon;

insert into public.app_issue_codes (
	code,
	kind,
	domain,
	description
)
values
	(
		'REQUEST_TOO_LARGE',
		'error',
		'request',
		'The request body exceeds the supported size for the operation.'
	),
	(
		'RATE_LIMITED',
		'error',
		'request',
		'The request exceeded the configured volume limit for the operation.'
	)
on conflict (code) do update set
	kind = excluded.kind,
	domain = excluded.domain,
	description = excluded.description,
	enabled = true,
	updated_at = now();

do $$
declare
	v_rls_event_trigger regprocedure :=
		to_regprocedure('public.rls_auto_enable()');
begin
	if v_rls_event_trigger is not null then
		execute format(
			'revoke all on function %s from public, anon, authenticated',
			v_rls_event_trigger
		);
	end if;
end;
$$;

revoke all
	on function public.set_custom_food_search_text()
	from public, anon, authenticated;

revoke all
	on function public.set_shared_product_search_text()
	from public, anon, authenticated;

revoke all
	on function public.sync_private_manual_nutrition_completeness()
	from public, anon, authenticated;

revoke all
	on function public.sync_nutrient_manual_entry_fields()
	from public, anon, authenticated;

revoke all
	on function public.sync_nutrient_manual_entry_fields_trigger()
	from public, anon, authenticated;

revoke all
	on function public.sync_user_compatibility_rules(uuid, text[], text[])
	from public, anon, authenticated;

grant execute
	on function public.sync_nutrient_manual_entry_fields()
	to service_role;

grant execute
	on function public.sync_nutrient_manual_entry_fields_trigger()
	to service_role;

grant execute
	on function public.sync_user_compatibility_rules(uuid, text[], text[])
	to service_role;

create table public.request_rate_limits (
	scope text not null,
	subject_hash text not null,
	window_started_at timestamptz not null,
	expires_at timestamptz not null,
	request_count bigint not null,
	updated_at timestamptz not null default now(),
	primary key (scope, subject_hash),
	constraint request_rate_limits_scope_length
		check (char_length(scope) between 1 and 120),
	constraint request_rate_limits_subject_hash_format
		check (subject_hash ~ '^[0-9a-f]{64}$'),
	constraint request_rate_limits_request_count_positive
		check (request_count > 0),
	constraint request_rate_limits_window_order
		check (expires_at > window_started_at)
);

create index request_rate_limits_expiration_idx
	on public.request_rate_limits (expires_at);

alter table public.request_rate_limits enable row level security;

revoke all
	on table public.request_rate_limits
	from public, anon, authenticated;

grant select, insert, update, delete
	on table public.request_rate_limits
	to service_role;

create or replace function public.consume_request_rate_limit(
	p_scope text,
	p_subject_hash text,
	p_limit integer,
	p_window_seconds integer
)
returns table (
	allowed boolean,
	remaining integer,
	retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_now timestamptz := clock_timestamp();
	v_record public.request_rate_limits%rowtype;
begin
	if p_scope is null
		or char_length(btrim(p_scope)) not between 1 and 120
		or p_subject_hash is null
		or p_subject_hash !~ '^[0-9a-f]{64}$'
		or p_limit not between 1 and 10000
		or p_window_seconds not between 1 and 86400
	then
		raise exception 'Invalid rate-limit configuration.'
			using errcode = '22023';
	end if;

	insert into public.request_rate_limits (
		scope,
		subject_hash,
		window_started_at,
		expires_at,
		request_count,
		updated_at
	)
	values (
		btrim(p_scope),
		p_subject_hash,
		v_now,
		v_now + make_interval(secs => p_window_seconds),
		1,
		v_now
	)
	on conflict (scope, subject_hash)
	do update set
		window_started_at = case
			when public.request_rate_limits.expires_at <= v_now
				then v_now
			else public.request_rate_limits.window_started_at
		end,
		expires_at = case
			when public.request_rate_limits.expires_at <= v_now
				then v_now + make_interval(secs => p_window_seconds)
			else public.request_rate_limits.expires_at
		end,
		request_count = case
			when public.request_rate_limits.expires_at <= v_now
				then 1
			else least(
				public.request_rate_limits.request_count + 1,
				9223372036854775807
			)
		end,
		updated_at = v_now
	returning *
	into v_record;

	return query
	select
		v_record.request_count <= p_limit,
		greatest(p_limit - v_record.request_count, 0)::integer,
		case
			when v_record.request_count <= p_limit then 0
			else greatest(
				1,
				ceil(extract(epoch from (v_record.expires_at - v_now)))
			)::integer
		end;
end;
$$;

revoke all
	on function public.consume_request_rate_limit(text, text, integer, integer)
	from public, anon, authenticated;

grant execute
	on function public.consume_request_rate_limit(text, text, integer, integer)
	to service_role;

comment on table public.request_rate_limits is
	'Private fixed-window counters used by the server to limit abusive request volume.';

comment on function public.consume_request_rate_limit(text, text, integer, integer) is
	'Atomically consumes one private server-side request quota unit. Service role only.';

commit;
