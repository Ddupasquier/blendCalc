begin;

create or replace function public.consume_request_rate_limits(p_limits jsonb)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_limit jsonb;
	v_result record;
	v_allowed boolean := true;
	v_remaining integer := 10000;
	v_retry_after_seconds integer := 0;
begin
	if p_limits is null
		or jsonb_typeof(p_limits) <> 'array'
		or jsonb_array_length(p_limits) not between 1 and 12
	then
		raise exception 'Invalid layered rate-limit configuration.' using errcode = '22023';
	end if;

	for v_limit in select value from jsonb_array_elements(p_limits)
	loop
		select * into v_result
		from public.consume_request_rate_limit(
			v_limit->>'scope',
			v_limit->>'subject_hash',
			(v_limit->>'limit')::integer,
			(v_limit->>'window_seconds')::integer
		);
		v_allowed := v_allowed and v_result.allowed;
		v_remaining := least(v_remaining, v_result.remaining);
		v_retry_after_seconds := greatest(v_retry_after_seconds, v_result.retry_after_seconds);
	end loop;

	return query select v_allowed, v_remaining, v_retry_after_seconds;
end;
$$;

revoke all on function public.consume_request_rate_limits(jsonb) from public, anon, authenticated;
grant execute on function public.consume_request_rate_limits(jsonb) to service_role;

comment on function public.consume_request_rate_limits(jsonb) is
	'Atomically consumes a bounded set of private endpoint, account, client, API-key, burst, and sustained request quotas in one database call. Service role only.';

commit;
