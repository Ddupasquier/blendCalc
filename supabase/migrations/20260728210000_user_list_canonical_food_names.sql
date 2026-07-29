update public.user_food_list_items item
set food = jsonb_set(
	item.food,
	'{canonicalDescription}',
	to_jsonb(btrim(product.food ->> 'description')),
	true
)
from public.shared_products product
where product.id = item.shared_product_id
	and nullif(btrim(product.food ->> 'description'), '') is not null;

update public.user_food_list_items item
set food = jsonb_set(
	item.food,
	'{canonicalDescription}',
	to_jsonb(btrim(record.description)),
	true
)
from public.generic_food_records record
where record.application_food_id = item.fdc_id
	and nullif(btrim(item.food ->> 'canonicalDescription'), '') is null;

update public.user_food_list_items item
set food = jsonb_set(
	item.food,
	'{canonicalDescription}',
	to_jsonb(btrim(custom_food.food ->> 'description')),
	true
)
from public.custom_foods custom_food
where custom_food.user_id = item.user_id
	and custom_food.fdc_id = item.fdc_id
	and nullif(btrim(custom_food.food ->> 'description'), '') is not null
	and nullif(btrim(item.food ->> 'canonicalDescription'), '') is null;

update public.user_food_list_items
set food = jsonb_set(
	food,
	'{canonicalDescription}',
	to_jsonb(btrim(food ->> 'description')),
	true
)
where nullif(btrim(food ->> 'canonicalDescription'), '') is null
	and food ->> 'nameProvenance' is distinct from 'user'
	and nullif(btrim(food ->> 'description'), '') is not null;

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
	v_canonical_description text;
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

	v_canonical_description := btrim(coalesce(
		v_item.food ->> 'canonicalDescription',
		v_item.food ->> 'description',
		''
	));

	update public.user_food_list_items
	set food = jsonb_set(
		jsonb_set(
			jsonb_set(food, '{description}', to_jsonb(v_description), true),
			'{canonicalDescription}',
			to_jsonb(v_canonical_description),
			true
		),
		'{nameProvenance}',
		'"user"'::jsonb,
		true
	)
	where id = v_item.id;
	return 'renamed';
end;
$$;

comment on function public.rename_user_food_list_item(text, bigint, text) is
	'Assigns a personal list name while preserving the canonical food name used by nutrition details.';
