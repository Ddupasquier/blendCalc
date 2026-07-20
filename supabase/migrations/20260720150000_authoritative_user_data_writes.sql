create or replace function public.place_user_food_list_item(
	p_list_type text,
	p_fdc_id bigint,
	p_food jsonb,
	p_allow_move boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_identity_key text;
	v_existing_item public.user_food_list_items%rowtype;
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;
	if p_list_type not in ('fridge', 'shopping') then
		raise exception 'Unsupported food list type.' using errcode = '22023';
	end if;
	if p_food is null or jsonb_typeof(p_food) <> 'object' then
		raise exception 'Food must be a JSON object.' using errcode = '22023';
	end if;

	v_identity_key := public.food_list_item_identity_key(p_fdc_id, p_food);

	insert into public.user_food_list_items (user_id, list_type, fdc_id, food)
	values (v_user_id, p_list_type, p_fdc_id, p_food)
	on conflict (user_id, food_identity_key) do nothing;

	if found then
		return 'added';
	end if;

	select *
	into v_existing_item
	from public.user_food_list_items
	where user_id = v_user_id
		and food_identity_key = v_identity_key
	for update;

	if v_existing_item.list_type = p_list_type then
		update public.user_food_list_items
		set fdc_id = p_fdc_id, food = p_food
		where id = v_existing_item.id;
		return 'duplicate';
	end if;

	if not p_allow_move then
		return 'move-required:' || v_existing_item.list_type;
	end if;

	update public.user_food_list_items
	set list_type = p_list_type, fdc_id = p_fdc_id, food = p_food
	where id = v_existing_item.id;
	return 'moved';
end;
$$;

create or replace function public.place_user_food_list_items(
	p_list_type text,
	p_foods jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_food jsonb;
	v_result text;
	v_added_count integer := 0;
begin
	if auth.uid() is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;
	if p_list_type not in ('fridge', 'shopping') then
		raise exception 'Unsupported food list type.' using errcode = '22023';
	end if;
	if p_foods is null or jsonb_typeof(p_foods) <> 'array' then
		raise exception 'Foods must be a JSON array.' using errcode = '22023';
	end if;

	for v_food in select food.value from jsonb_array_elements(p_foods) food(value)
	loop
		if jsonb_typeof(v_food) <> 'object'
			or (v_food ->> 'fdcId') is null
			or (v_food ->> 'fdcId') !~ '^-?[0-9]+$' then
			raise exception 'Every food needs a valid identity.' using errcode = '22023';
		end if;

		v_result := public.place_user_food_list_item(
			p_list_type,
			(v_food ->> 'fdcId')::bigint,
			v_food,
			false
		);
		if v_result = 'added' then
			v_added_count := v_added_count + 1;
		end if;
	end loop;

	return case when v_added_count > 0 then 'added' else 'duplicate' end;
end;
$$;

create or replace function public.rename_user_food_list_item(
	p_list_type text,
	p_fdc_id bigint,
	p_description text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_description text := regexp_replace(btrim(coalesce(p_description, '')), '\s+', ' ', 'g');
	v_item public.user_food_list_items%rowtype;
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;
	if p_list_type not in ('fridge', 'shopping') then
		raise exception 'Unsupported food list type.' using errcode = '22023';
	end if;
	if v_description = '' then
		return 'invalid';
	end if;

	select *
	into v_item
	from public.user_food_list_items
	where user_id = v_user_id
		and list_type = p_list_type
		and fdc_id = p_fdc_id
	for update;

	if not found then
		return 'missing';
	end if;
	if lower(btrim(v_item.food ->> 'description')) = lower(v_description) then
		return 'unchanged';
	end if;
	if exists (
		select 1
		from public.user_food_list_items candidate
		where candidate.user_id = v_user_id
			and candidate.list_type = p_list_type
			and candidate.id <> v_item.id
			and lower(btrim(candidate.food ->> 'description')) = lower(v_description)
	) then
		return 'duplicate';
	end if;

	update public.user_food_list_items
	set food = jsonb_set(
		jsonb_set(food, '{description}', to_jsonb(v_description), true),
		'{nameProvenance}',
		'"user"'::jsonb,
		true
	)
	where id = v_item.id;
	return 'renamed';
end;
$$;

create or replace function public.remove_user_food_list_item(
	p_list_type text,
	p_fdc_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
	if auth.uid() is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;
	if p_list_type not in ('fridge', 'shopping') then
		raise exception 'Unsupported food list type.' using errcode = '22023';
	end if;

	delete from public.user_food_list_items
	where user_id = auth.uid()
		and list_type = p_list_type
		and fdc_id = p_fdc_id;
	return found;
end;
$$;

create or replace function public.save_saved_drink(
	p_id uuid,
	p_name text,
	p_drink jsonb,
	p_created_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_name text := btrim(coalesce(p_name, ''));
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;
	if v_name = '' then
		raise exception 'A saved drink name is required.' using errcode = '22023';
	end if;
	if p_drink is null or jsonb_typeof(p_drink) <> 'object' then
		raise exception 'Saved drink data must be a JSON object.' using errcode = '22023';
	end if;

	insert into public.saved_drinks (id, user_id, name, drink, created_at)
	values (p_id, v_user_id, v_name, p_drink, coalesce(p_created_at, now()))
	on conflict (id) do update
	set name = excluded.name, drink = excluded.drink
	where public.saved_drinks.user_id = v_user_id;

	if not found then
		raise exception 'Saved drink ownership does not match.' using errcode = '42501';
	end if;
	return 'saved';
exception
	when unique_violation then
		return 'duplicate';
end;
$$;

create or replace function public.delete_saved_drink(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
	if auth.uid() is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;
	delete from public.saved_drinks where id = p_id and user_id = auth.uid();
	return found;
end;
$$;

create or replace function public.save_mix_preferences(
	p_nutrient_goals jsonb default null,
	p_mix_state jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;
	if p_nutrient_goals is not null and jsonb_typeof(p_nutrient_goals) <> 'object' then
		raise exception 'Nutrient goals must be a JSON object.' using errcode = '22023';
	end if;
	if p_mix_state is not null and jsonb_typeof(p_mix_state) <> 'object' then
		raise exception 'Mix state must be a JSON object.' using errcode = '22023';
	end if;

	insert into public.mix_preferences (user_id, nutrient_goals, mix_state)
	values (
		v_user_id,
		coalesce(p_nutrient_goals, '{}'::jsonb),
		coalesce(p_mix_state, '{}'::jsonb)
	)
	on conflict (user_id) do update
	set
		nutrient_goals = coalesce(p_nutrient_goals, public.mix_preferences.nutrient_goals),
		mix_state = coalesce(p_mix_state, public.mix_preferences.mix_state);
	return true;
end;
$$;

revoke insert, update, delete on table public.user_food_list_items from authenticated;
revoke insert, update, delete on table public.saved_drinks from authenticated;
revoke insert, update, delete on table public.mix_preferences from authenticated;

revoke all on function public.place_user_food_list_item(text, bigint, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.place_user_food_list_items(text, jsonb) from public, anon, authenticated;
revoke all on function public.rename_user_food_list_item(text, bigint, text) from public, anon, authenticated;
revoke all on function public.remove_user_food_list_item(text, bigint) from public, anon, authenticated;
revoke all on function public.save_saved_drink(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.delete_saved_drink(uuid) from public, anon, authenticated;
revoke all on function public.save_mix_preferences(jsonb, jsonb) from public, anon, authenticated;

grant execute on function public.place_user_food_list_item(text, bigint, jsonb, boolean) to authenticated, service_role;
grant execute on function public.place_user_food_list_items(text, jsonb) to authenticated, service_role;
grant execute on function public.rename_user_food_list_item(text, bigint, text) to authenticated, service_role;
grant execute on function public.remove_user_food_list_item(text, bigint) to authenticated, service_role;
grant execute on function public.save_saved_drink(uuid, text, jsonb, timestamptz) to authenticated, service_role;
grant execute on function public.delete_saved_drink(uuid) to authenticated, service_role;
grant execute on function public.save_mix_preferences(jsonb, jsonb) to authenticated, service_role;
