create or replace function public.food_list_item_identity_key(
	p_fdc_id bigint,
	p_food jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
	select case
		when regexp_replace(
			coalesce(
				nullif(p_food ->> 'barcode', ''),
				nullif(p_food ->> 'gtinUpc', ''),
				''
			),
			'[^0-9]',
			'',
			'g'
		) <> '' then
			'barcode:' || case
				when length(regexp_replace(
					coalesce(
						nullif(p_food ->> 'barcode', ''),
						nullif(p_food ->> 'gtinUpc', ''),
						''
					),
					'[^0-9]',
					'',
					'g'
				)) >= 14 then regexp_replace(
					coalesce(
						nullif(p_food ->> 'barcode', ''),
						nullif(p_food ->> 'gtinUpc', ''),
						''
					),
					'[^0-9]',
					'',
					'g'
				)
				else lpad(regexp_replace(
					coalesce(
						nullif(p_food ->> 'barcode', ''),
						nullif(p_food ->> 'gtinUpc', ''),
						''
					),
					'[^0-9]',
					'',
					'g'
				), 14, '0')
			end
		else 'fdc:' || p_fdc_id::text
	end;
$$;

alter table public.user_food_list_items
	add column if not exists food_identity_key text
	generated always as (
		public.food_list_item_identity_key(fdc_id, food)
	) stored;

with ranked_items as (
	select
		id,
		row_number() over (
			partition by user_id, food_identity_key
			order by updated_at desc, created_at desc, id desc
		) as duplicate_rank
	from public.user_food_list_items
)
delete from public.user_food_list_items item
using ranked_items ranked
where item.id = ranked.id
	and ranked.duplicate_rank > 1;

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'user_food_list_items_user_identity_key'
			and conrelid = 'public.user_food_list_items'::regclass
	) then
		alter table public.user_food_list_items
			add constraint user_food_list_items_user_identity_key
			unique (user_id, food_identity_key);
	end if;
end
$$;

create or replace function public.place_user_food_list_item(
	p_list_type text,
	p_fdc_id bigint,
	p_food jsonb,
	p_allow_move boolean default false
)
returns text
language plpgsql
security invoker
set search_path = public
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

	insert into public.user_food_list_items (
		user_id,
		list_type,
		fdc_id,
		food
	)
	values (
		v_user_id,
		p_list_type,
		p_fdc_id,
		p_food
	)
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
		set
			fdc_id = p_fdc_id,
			food = p_food
		where id = v_existing_item.id;
		return 'duplicate';
	end if;

	if not p_allow_move then
		return 'move-required:' || v_existing_item.list_type;
	end if;

	update public.user_food_list_items
	set
		list_type = p_list_type,
		fdc_id = p_fdc_id,
		food = p_food
	where id = v_existing_item.id;

	return 'moved';
end;
$$;

revoke all on function public.food_list_item_identity_key(bigint, jsonb) from public;
revoke all on function public.place_user_food_list_item(text, bigint, jsonb, boolean) from public;
revoke all on function public.place_user_food_list_item(text, bigint, jsonb, boolean) from anon;
grant execute on function public.food_list_item_identity_key(bigint, jsonb) to authenticated;
grant execute on function public.food_list_item_identity_key(bigint, jsonb) to service_role;
grant execute on function public.place_user_food_list_item(text, bigint, jsonb, boolean) to authenticated;
grant execute on function public.place_user_food_list_item(text, bigint, jsonb, boolean) to service_role;
