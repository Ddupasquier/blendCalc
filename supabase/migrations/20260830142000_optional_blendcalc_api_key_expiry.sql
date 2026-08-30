create or replace function public.rotate_blendcalc_api_key(
	p_current_key_id uuid,
	p_new_key_id uuid,
	p_name text,
	p_key_prefix text,
	p_key_hash text,
	p_scopes text[],
	p_expires_at timestamptz default null,
	p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_current public.blendcalc_api_keys%rowtype;
begin
	select * into v_current
	from public.blendcalc_api_keys
	where id = p_current_key_id
		and revoked_at is null
	for update;
	if not found then raise exception 'Active API key not found.'; end if;

	insert into public.blendcalc_api_keys (
		id, client_id, name, key_prefix, key_hash, scopes, expires_at,
		rotated_from_key_id, created_by
	) values (
		p_new_key_id, v_current.client_id, p_name, p_key_prefix, p_key_hash,
		p_scopes, p_expires_at, v_current.id, p_created_by
	);

	update public.blendcalc_api_keys
	set revoked_at = now(), revocation_reason = 'rotated'
	where id = v_current.id;
	return p_new_key_id;
end;
$$;

revoke all on function public.rotate_blendcalc_api_key(
	uuid, uuid, text, text, text, text[], timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.rotate_blendcalc_api_key(
	uuid, uuid, text, text, text, text[], timestamptz, uuid
) to service_role;

comment on function public.rotate_blendcalc_api_key(
	uuid, uuid, text, text, text, text[], timestamptz, uuid
) is 'Rotates a blendCalcAPI key atomically. Omitted expiry dates remain unbounded rather than requiring a fabricated timestamp.';
