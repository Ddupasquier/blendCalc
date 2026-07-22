create or replace function public.move_user_food_list_items(
	p_source_list_type text,
	p_target_list_type text,
	p_fdc_ids bigint[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_requested_count integer;
	v_available_count integer;
	v_moved_count integer;
	v_moved_at bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;
	if p_source_list_type not in ('fridge', 'shopping')
		or p_target_list_type not in ('fridge', 'shopping')
		or p_source_list_type = p_target_list_type then
		raise exception 'A valid source and different target list are required.' using errcode = '22023';
	end if;
	if p_fdc_ids is null
		or cardinality(p_fdc_ids) = 0
		or array_position(p_fdc_ids, null) is not null then
		raise exception 'At least one valid food identity is required.' using errcode = '22023';
	end if;

	select count(*)
	into v_requested_count
	from (select distinct unnest(p_fdc_ids) as fdc_id) requested;

	perform item.id
	from public.user_food_list_items item
	where item.user_id = v_user_id
		and item.list_type = p_source_list_type
		and item.fdc_id = any(p_fdc_ids)
	for update;

	select count(*)
	into v_available_count
	from public.user_food_list_items item
	where item.user_id = v_user_id
		and item.list_type = p_source_list_type
		and item.fdc_id = any(p_fdc_ids);

	if v_available_count <> v_requested_count then
		raise exception 'One or more selected ingredients are no longer in the source list.' using errcode = 'P0002';
	end if;

	update public.user_food_list_items item
	set list_type = p_target_list_type,
		food = jsonb_set(item.food, '{listAddedAt}', to_jsonb(v_moved_at), true)
	where item.user_id = v_user_id
		and item.list_type = p_source_list_type
		and item.fdc_id = any(p_fdc_ids);

	get diagnostics v_moved_count = row_count;
	return v_moved_count;
end;
$$;

revoke all on function public.move_user_food_list_items(text, text, bigint[]) from public, anon, authenticated;
grant execute on function public.move_user_food_list_items(text, text, bigint[]) to authenticated, service_role;
