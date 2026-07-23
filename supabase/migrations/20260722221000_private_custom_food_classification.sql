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
		raise exception 'A personal food owner is required.' using errcode = '23502';
	end if;

	if v_food is null or jsonb_typeof(v_food) <> 'object' then
		raise exception 'Food must be a JSON object.' using errcode = '22023';
	end if;

	if jsonb_typeof(v_food -> 'fdcId') <> 'number'
		or (v_food ->> 'fdcId') !~ '^-?[0-9]+$'
		or (v_food ->> 'fdcId')::bigint <> new.fdc_id then
		raise exception 'Food identity does not match the saved personal-food identity.'
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

	if jsonb_typeof(v_food -> 'customFood') <> 'boolean' then
		raise exception 'Personal food classification must be a boolean.'
			using errcode = '22023';
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

create or replace function public.food_trust_status(p_food jsonb)
returns text
language sql
immutable
set search_path = public
as $$
	select case
		when nullif(p_food ->> 'sharedProductSubmissionId', '') is not null
			then 'pending-review'
		when nullif(p_food ->> 'sharedProductId', '') is not null
			and lower(coalesce(p_food ->> 'sharedProductConfidence', '')) in (
				'source-verified',
				'corroborated',
				'moderator-reviewed'
			) then lower(p_food ->> 'sharedProductConfidence')
		when lower(coalesce(p_food ->> 'customFood', 'false')) = 'true'
			and public.food_source_key(p_food) in ('custom', 'unknown')
			and nullif(p_food ->> 'sharedProductId', '') is null
			and nullif(p_food ->> 'sharedProductSubmissionId', '') is null
			then 'user-private'
		else 'unverified'
	end;
$$;

create or replace function public.resolve_user_food_list_catalog_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_barcode text := public.food_normalized_barcode(new.food);
	v_shared_product_id uuid;
	v_shared_product_source text;
	v_shared_product_confidence text;
	v_pending_submission_id uuid;
	v_fallback_source text;
	v_is_private_custom boolean;
begin
	if v_barcode is not null then
		select product.id, product.source, product.confidence
		into v_shared_product_id, v_shared_product_source, v_shared_product_confidence
		from public.shared_products product
		where product.barcode = v_barcode
			and product.status = 'active'
		limit 1;

		select submission.id
		into v_pending_submission_id
		from public.shared_product_submissions submission
		where submission.submitted_by = new.user_id
			and submission.barcode = v_barcode
			and submission.status = 'pending'
		order by submission.created_at desc, submission.id desc
		limit 1;
	end if;

	v_fallback_source := public.food_source_key(new.food);
	v_is_private_custom :=
		lower(coalesce(new.food ->> 'customFood', 'false')) = 'true'
		and v_fallback_source in ('custom', 'unknown')
		and v_shared_product_id is null
		and v_pending_submission_id is null;

	new.food := jsonb_set(
		new.food,
		'{customFood}',
		to_jsonb(v_is_private_custom),
		true
	);
	new.shared_product_id := v_shared_product_id;
	new.shared_product_submission_id := v_pending_submission_id;
	new.source_key := case
		when v_shared_product_source = 'usda' then 'usda'
		when v_shared_product_source = 'open-food-facts' then 'open-food-facts'
		when v_shared_product_source = 'community-reviewed' then 'shared-catalog'
		when v_fallback_source = 'custom' and not v_is_private_custom then 'unknown'
		else v_fallback_source
	end;
	new.trust_status := case
		when v_pending_submission_id is not null then 'pending-review'
		when v_shared_product_id is not null
			and v_shared_product_confidence in (
				'source-verified',
				'corroborated',
				'moderator-reviewed'
			) then v_shared_product_confidence
		when v_is_private_custom then 'user-private'
		else 'unverified'
	end;

	return new;
end;
$$;

alter table public.custom_foods disable trigger prepare_custom_food_record;

update public.custom_foods custom_food
set food = custom_food.food || jsonb_build_object(
	'customFood', false,
	'sourceKey', case shared_product.source
		when 'usda' then 'usda'
		when 'open-food-facts' then 'open-food-facts'
		else 'shared-catalog'
	end,
	'sharedProductId', shared_product.id,
	'sharedProductConfidence', shared_product.confidence
)
from public.shared_products shared_product
where shared_product.barcode = public.food_normalized_barcode(custom_food.food)
	and shared_product.status = 'active';

update public.custom_foods custom_food
set food = custom_food.food || jsonb_build_object(
	'customFood', false,
	'sharedProductSubmissionId', submission.id
)
from public.shared_product_submissions submission
where submission.submitted_by = custom_food.user_id
	and submission.barcode = public.food_normalized_barcode(custom_food.food)
	and submission.status = 'pending'
	and nullif(custom_food.food ->> 'sharedProductId', '') is null;

update public.custom_foods
set food = jsonb_set(food, '{customFood}', 'false'::jsonb, true)
where public.food_source_key(food) not in ('custom', 'unknown');

alter table public.custom_foods enable trigger prepare_custom_food_record;

update public.user_food_list_items
set food = food;

revoke all on function public.prepare_custom_food_record() from public, anon, authenticated;
revoke all on function public.food_trust_status(jsonb) from public, anon, authenticated;
revoke all on function public.resolve_user_food_list_catalog_state()
	from public, anon, authenticated;
grant execute on function public.resolve_user_food_list_catalog_state() to service_role;
