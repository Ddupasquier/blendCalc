alter table public.custom_foods
	add column if not exists category_option_id text
		references public.custom_food_category_options(id) on delete restrict;

create index if not exists custom_foods_category_option_idx
	on public.custom_foods (category_option_id)
	where category_option_id is not null;

create or replace function public.is_valid_gtin(p_value text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
	v_length integer := length(p_value);
	v_index integer;
	v_sum integer := 0;
	v_expected_check_digit integer;
begin
	if p_value !~ '^[0-9]+$' or v_length not in (8, 12, 13, 14) then
		return false;
	end if;

	for v_index in 1..(v_length - 1) loop
		v_sum := v_sum
			+ substring(p_value from v_index for 1)::integer
				* case
					when mod(v_length - 1 - v_index, 2) = 0 then 3
					else 1
				end;
	end loop;

	v_expected_check_digit := mod(10 - mod(v_sum, 10), 10);
	return substring(p_value from v_length for 1)::integer = v_expected_check_digit;
end;
$$;

create or replace function public.prepare_custom_food_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_food jsonb := new.food;
	v_description text;
	v_brand_owner text;
	v_name_key text;
	v_raw_barcode text;
	v_barcode_digits text;
	v_category_option_id text;
	v_category_values text[] := '{}'::text[];
	v_serving_weight numeric;
	v_nutrient jsonb;
	v_nutrient_id bigint;
	v_nutrient_value numeric;
	v_seen_nutrient_ids bigint[] := '{}'::bigint[];
	v_missing_requirement text;
	v_relationship_message text;
begin
	if new.user_id is null then
		raise exception 'A custom food owner is required.' using errcode = '23502';
	end if;

	if v_food is null or jsonb_typeof(v_food) <> 'object' then
		raise exception 'Food must be a JSON object.' using errcode = '22023';
	end if;

	if jsonb_typeof(v_food -> 'fdcId') <> 'number'
		or (v_food ->> 'fdcId') !~ '^-?[0-9]+$'
		or (v_food ->> 'fdcId')::bigint <> new.fdc_id then
		raise exception 'Food identity does not match the saved custom-food identity.'
			using errcode = '22023';
	end if;

	v_description := btrim(coalesce(v_food ->> 'description', ''));
	if v_description = '' then
		raise exception 'A food name is required.' using errcode = '22023';
	end if;
	if length(v_description) > 120 then
		raise exception 'Food name must be 120 characters or fewer.' using errcode = '22023';
	end if;

	v_brand_owner := btrim(coalesce(v_food ->> 'brandOwner', ''));
	if length(v_brand_owner) > 120 then
		raise exception 'Brand must be 120 characters or fewer.' using errcode = '22023';
	end if;

	if jsonb_typeof(v_food -> 'customFood') <> 'boolean'
		or (v_food ->> 'customFood')::boolean is not true then
		raise exception 'Only custom foods can be saved through this path.' using errcode = '22023';
	end if;

	if jsonb_typeof(v_food -> 'customServingWeightGrams') <> 'number' then
		raise exception 'Serving weight must be a number greater than zero.' using errcode = '22023';
	end if;
	v_serving_weight := (v_food ->> 'customServingWeightGrams')::numeric;
	if v_serving_weight <= 0 then
		raise exception 'Serving weight must be greater than zero.' using errcode = '22023';
	end if;

	if v_food ? 'categories' then
		if jsonb_typeof(v_food -> 'categories') <> 'array' then
			raise exception 'Food categories must be an array.' using errcode = '22023';
		end if;

		select coalesce(array_agg(category.value order by category.source_order), '{}'::text[])
		into v_category_values
		from jsonb_array_elements_text(v_food -> 'categories')
			with ordinality as category(value, source_order)
		where btrim(category.value) <> '';
	end if;

	v_category_option_id := nullif(btrim(v_food ->> 'categoryOptionId'), '');
	if v_category_option_id is not null then
		if not exists (
			select 1
			from public.custom_food_category_options option
			where option.id = v_category_option_id
				and option.enabled
		) then
			raise exception 'Select an available food category.' using errcode = '22023';
		end if;
	else
		select option.id
		into v_category_option_id
		from unnest(v_category_values) with ordinality as category(value, source_order)
		join public.custom_food_category_options option
			on option.normalized_value = public.normalize_food_category_value(category.value)
			and option.enabled
		order by category.source_order
		limit 1;

		if v_category_option_id is null then
			select resolved.category_option_id
			into v_category_option_id
			from public.resolve_custom_food_category_option(v_category_values) resolved
			limit 1;
		end if;
	end if;

	if v_category_option_id is null then
		raise exception 'Select a category for this ingredient.' using errcode = '22023';
	end if;

	if jsonb_typeof(v_food -> 'foodNutrients') <> 'array'
		or jsonb_array_length(v_food -> 'foodNutrients') = 0 then
		raise exception 'At least one nutrition value is required.' using errcode = '22023';
	end if;

	for v_nutrient in
		select nutrient.value
		from jsonb_array_elements(v_food -> 'foodNutrients') nutrient(value)
	loop
		if jsonb_typeof(v_nutrient) <> 'object'
			or jsonb_typeof(v_nutrient -> 'nutrientId') <> 'number'
			or (v_nutrient ->> 'nutrientId') !~ '^[0-9]+$' then
			raise exception 'Every nutrition value needs a valid nutrient identity.'
				using errcode = '22023';
		end if;

		if jsonb_typeof(v_nutrient -> 'value') <> 'number' then
			raise exception 'Every nutrient amount must be a number.' using errcode = '22023';
		end if;

		v_nutrient_id := (v_nutrient ->> 'nutrientId')::bigint;
		v_nutrient_value := (v_nutrient ->> 'value')::numeric;
		if v_nutrient_value < 0 then
			raise exception 'Nutrient amounts cannot be negative.' using errcode = '22023';
		end if;

		if v_nutrient_id = any(v_seen_nutrient_ids) then
			raise exception 'A nutrient can only appear once.' using errcode = '22023';
		end if;
		v_seen_nutrient_ids := array_append(v_seen_nutrient_ids, v_nutrient_id);

		if not exists (
			select 1
			from public.nutrient_definitions definition
			where definition.nutrient_id = v_nutrient_id
		) then
			raise exception 'Nutrient % is not in the active nutrient catalog.', v_nutrient_id
				using errcode = '22023';
		end if;
	end loop;

	select required_nutrient.requirement_key
	into v_missing_requirement
	from public.nutrient_manual_entry_required_nutrients required_nutrient
	where required_nutrient.enabled
		and not (required_nutrient.nutrient_id = any(v_seen_nutrient_ids))
	order by required_nutrient.field_sort_order, required_nutrient.nutrient_id
	limit 1;

	if v_missing_requirement is not null then
		raise exception 'Required nutrition value is missing: %.', v_missing_requirement
		using errcode = '22023';
	end if;

	with nutrient_values as (
		select
			(nutrient.value ->> 'nutrientId')::bigint as nutrient_id,
			(nutrient.value ->> 'value')::numeric as amount
		from jsonb_array_elements(v_food -> 'foodNutrients') nutrient(value)
	)
	select rule.message
	into v_relationship_message
	from public.nutrient_relationship_rules rule
	join nutrient_values child
		on child.nutrient_id = rule.child_nutrient_id
	left join nutrient_values parent
		on parent.nutrient_id = rule.parent_nutrient_id
	where rule.enabled
		and rule.severity = 'error'
		and child.amount > 0
		and (
			(parent.nutrient_id is null and rule.requires_parent)
			or (
				parent.nutrient_id is not null
				and rule.relationship = 'child_must_not_exceed_parent'
				and child.amount > parent.amount + rule.tolerance
			)
		)
	order by rule.sort_order, rule.id
	limit 1;

	if v_relationship_message is not null then
		raise exception '%', v_relationship_message using errcode = '22023';
	end if;

	v_raw_barcode := nullif(btrim(coalesce(v_food ->> 'barcode', v_food ->> 'gtinUpc', '')), '');
	if v_raw_barcode is not null then
		if v_raw_barcode !~ '^[0-9]+$' or not public.is_valid_gtin(v_raw_barcode) then
			raise exception 'Enter a valid 8, 12, 13, or 14 digit UPC/EAN barcode.'
				using errcode = '22023';
		end if;
		v_barcode_digits := lpad(v_raw_barcode, 14, '0');
		v_food := jsonb_set(v_food, '{barcode}', to_jsonb(v_barcode_digits), true);
	else
		v_barcode_digits := null;
	end if;

	v_name_key := lower(regexp_replace(v_description, '\s+', ' ', 'g'));
	v_food := jsonb_set(v_food, '{description}', to_jsonb(v_description), true);
	v_food := jsonb_set(v_food, '{categoryOptionId}', to_jsonb(v_category_option_id), true);
	if v_brand_owner <> '' then
		v_food := jsonb_set(v_food, '{brandOwner}', to_jsonb(v_brand_owner), true);
	end if;

	new.food := v_food;
	new.name_key := v_name_key;
	new.barcode := v_barcode_digits;
	new.category_option_id := v_category_option_id;
	return new;
end;
$$;

update public.custom_foods custom_food
set category_option_id = coalesce(
	(
		select option.id
		from public.custom_food_category_options option
		where option.id = nullif(btrim(custom_food.food ->> 'categoryOptionId'), '')
			and option.enabled
		limit 1
	),
	(
		select option.id
		from jsonb_array_elements_text(
			case
				when jsonb_typeof(custom_food.food -> 'categories') = 'array'
					then custom_food.food -> 'categories'
				else '[]'::jsonb
			end
		) with ordinality as category(value, source_order)
		join public.custom_food_category_options option
			on option.normalized_value = public.normalize_food_category_value(category.value)
			and option.enabled
		order by category.source_order
		limit 1
	)
)
where custom_food.category_option_id is null;

drop trigger if exists prepare_custom_food_record on public.custom_foods;

create trigger prepare_custom_food_record
	before insert or update of fdc_id, food
	on public.custom_foods
	for each row execute function public.prepare_custom_food_record();

create or replace function public.save_custom_food(
	p_fdc_id bigint,
	p_food jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_user_id uuid := auth.uid();
	v_constraint_name text;
begin
	if v_user_id is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	insert into public.custom_foods (user_id, fdc_id, food)
	values (v_user_id, p_fdc_id, p_food)
	on conflict (user_id, fdc_id) do update
	set food = excluded.food;

	return 'saved';
exception
	when unique_violation then
		get stacked diagnostics v_constraint_name = constraint_name;
		if v_constraint_name = 'custom_foods_user_barcode_unique' then
			return 'duplicate-barcode';
		end if;
		if v_constraint_name = 'custom_foods_user_name_key_unique' then
			return 'duplicate-name';
		end if;
		raise;
end;
$$;

create or replace function public.save_custom_foods(p_foods jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_food jsonb;
	v_result text;
begin
	if auth.uid() is null then
		raise exception 'Authentication is required.' using errcode = '42501';
	end if;

	if p_foods is null or jsonb_typeof(p_foods) <> 'array' then
		raise exception 'Custom foods must be a JSON array.' using errcode = '22023';
	end if;

	for v_food in select food.value from jsonb_array_elements(p_foods) food(value)
	loop
		if jsonb_typeof(v_food) <> 'object'
			or jsonb_typeof(v_food -> 'fdcId') <> 'number'
			or (v_food ->> 'fdcId') !~ '^-?[0-9]+$' then
			raise exception 'Every custom food needs a valid identity.' using errcode = '22023';
		end if;

		v_result := public.save_custom_food((v_food ->> 'fdcId')::bigint, v_food);
		if v_result <> 'saved' then
			raise exception 'Custom food batch contains a % conflict.', v_result
				using errcode = '23505';
		end if;
	end loop;

	return true;
end;
$$;

drop policy if exists "Users can create their custom foods" on public.custom_foods;
drop policy if exists "Users can update their custom foods" on public.custom_foods;

revoke insert, update on table public.custom_foods from authenticated;

revoke all on function public.is_valid_gtin(text) from public, anon, authenticated;
revoke all on function public.prepare_custom_food_record() from public, anon, authenticated;
revoke all on function public.save_custom_food(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.save_custom_foods(jsonb) from public, anon, authenticated;

grant execute on function public.save_custom_food(bigint, jsonb) to authenticated;
grant execute on function public.save_custom_foods(jsonb) to authenticated;
