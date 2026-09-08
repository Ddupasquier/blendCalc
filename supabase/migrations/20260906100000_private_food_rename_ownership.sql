with private_name_candidates as (
	select
		custom_food.id as custom_food_id,
		btrim(item.food ->> 'description') as description,
		lower(regexp_replace(btrim(item.food ->> 'description'), '\s+', ' ', 'g')) as name_key
	from public.user_food_list_items item
	join public.custom_foods custom_food
		on custom_food.user_id = item.user_id
		and custom_food.fdc_id = item.fdc_id
	where item.shared_product_id is null
		and item.shared_product_submission_id is null
		and item.trust_status = 'user-private'
		and coalesce((item.food ->> 'customFood')::boolean, false)
		and nullif(btrim(item.food ->> 'description'), '') is not null
),
unambiguous_private_names as (
	select candidate.*
	from private_name_candidates candidate
	where not exists (
		select 1
		from public.custom_foods conflicting_food
		join public.custom_foods renamed_food
			on renamed_food.id = candidate.custom_food_id
		where conflicting_food.user_id = renamed_food.user_id
			and conflicting_food.id <> candidate.custom_food_id
			and conflicting_food.name_key = candidate.name_key
	)
)
update public.custom_foods custom_food
set food = jsonb_set(
	jsonb_set(
		jsonb_set(
			custom_food.food,
			'{description}',
			to_jsonb(candidate.description),
			true
		),
		'{canonicalDescription}',
		to_jsonb(candidate.description),
		true
	),
	'{nameProvenance}',
	'"user"'::jsonb,
	true
)
from unambiguous_private_names candidate
where custom_food.id = candidate.custom_food_id
	and (
		custom_food.food ->> 'description' is distinct from candidate.description
		or custom_food.food ->> 'canonicalDescription' is distinct from candidate.description
		or custom_food.food ->> 'nameProvenance' is distinct from 'user'
	);

update public.user_food_list_items item
set food = jsonb_set(
	jsonb_set(
		item.food,
		'{canonicalDescription}',
		to_jsonb(btrim(item.food ->> 'description')),
		true
	),
	'{nameProvenance}',
	'"user"'::jsonb,
	true
)
where item.shared_product_id is null
	and item.shared_product_submission_id is null
	and item.trust_status = 'user-private'
	and coalesce((item.food ->> 'customFood')::boolean, false)
	and nullif(btrim(item.food ->> 'description'), '') is not null;

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
	v_name_key text := lower(regexp_replace(btrim(coalesce(p_description, '')), '\s+', ' ', 'g'));
	v_item public.user_food_list_items%rowtype;
	v_private_custom_food_id uuid;
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

	select custom_food.id
	into v_private_custom_food_id
	from public.custom_foods custom_food
	where custom_food.user_id = v_user_id
		and custom_food.fdc_id = p_fdc_id
		and v_item.shared_product_id is null
		and v_item.shared_product_submission_id is null
		and v_item.trust_status = 'user-private'
		and coalesce((v_item.food ->> 'customFood')::boolean, false)
	for update;

	if v_private_custom_food_id is not null and exists (
		select 1
		from public.custom_foods candidate
		where candidate.user_id = v_user_id
			and candidate.id <> v_private_custom_food_id
			and candidate.name_key = v_name_key
	) then
		return 'duplicate';
	end if;

	if v_private_custom_food_id is not null then
		update public.custom_foods
		set food = jsonb_set(
			jsonb_set(
				jsonb_set(food, '{description}', to_jsonb(v_description), true),
				'{canonicalDescription}',
				to_jsonb(v_description),
				true
			),
			'{nameProvenance}',
			'"user"'::jsonb,
			true
		)
		where id = v_private_custom_food_id;

		v_canonical_description := v_description;
	else
		v_canonical_description := btrim(coalesce(
			v_item.food ->> 'canonicalDescription',
			v_item.food ->> 'description',
			''
		));
	end if;

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
	'Renames a private custom food everywhere it appears while preserving canonical source names for catalog-backed foods.';
