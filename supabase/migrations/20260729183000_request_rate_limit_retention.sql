begin;

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

	if right(p_subject_hash, 1) = '0' then
		delete from public.request_rate_limits
		where ctid in (
			select ctid
			from public.request_rate_limits
			where expires_at < v_now - interval '1 day'
			order by expires_at
			limit 1000
		);
	end if;

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

comment on function public.consume_request_rate_limit(text, text, integer, integer) is
	'Atomically consumes one private server-side request quota unit and opportunistically prunes expired counters. Service role only.';

commit;
