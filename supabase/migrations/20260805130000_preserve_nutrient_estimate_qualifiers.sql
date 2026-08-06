alter table public.food_nutrients
	drop constraint if exists food_nutrients_value_origin_check,
	drop constraint if exists food_nutrients_value_status_check,
	drop constraint if exists food_nutrients_value_status_origin_check;

alter table public.food_nutrients
	add column if not exists value_qualifier text,
	add constraint food_nutrients_value_origin_check check (
		value_origin in ('reported', 'estimated', 'derived')
	),
	add constraint food_nutrients_value_status_check check (
		value_status in (
			'reported',
			'reported-zero',
			'estimated',
			'derived',
			'trace',
			'present-unquantified',
			'missing',
			'invalid',
			'unknown'
		)
	),
	add constraint food_nutrients_value_status_origin_check check (
		(value_status = 'reported-zero' and value_origin = 'reported' and amount_per_100g = 0)
		or (value_status = 'reported' and value_origin = 'reported')
		or (value_status = 'estimated' and value_origin = 'estimated')
		or (value_status = 'derived' and value_origin = 'derived')
		or value_status in ('trace', 'present-unquantified', 'missing', 'invalid', 'unknown')
	),
	add constraint food_nutrients_value_qualifier_check check (
		value_qualifier is null or value_qualifier = 'source-estimate'
	),
	add constraint food_nutrients_estimate_qualifier_check check (
		(value_status = 'estimated' and value_qualifier = 'source-estimate')
		or (value_status <> 'estimated' and value_qualifier is null)
	);

create or replace function private.apply_food_nutrient_uncertainty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_food jsonb;
	v_nutrient jsonb;
	v_explicit_status text;
	v_mapping_status text;
	v_value_qualifier text;
begin
	if new.user_food_list_item_id is not null then
		select food into v_food from public.user_food_list_items where id = new.user_food_list_item_id;
	elsif new.custom_food_id is not null then
		select food into v_food from public.custom_foods where id = new.custom_food_id;
	elsif new.shared_product_submission_id is not null then
		select food into v_food from public.shared_product_submissions where id = new.shared_product_submission_id;
	elsif new.shared_product_id is not null then
		select food into v_food from public.shared_products where id = new.shared_product_id;
	elsif new.shared_product_revision_id is not null then
		select food into v_food from public.shared_product_revisions where id = new.shared_product_revision_id;
	elsif new.shared_product_observation_id is not null then
		select normalized_food into v_food from public.shared_product_observations where id = new.shared_product_observation_id;
	end if;

	if jsonb_typeof(v_food -> 'foodNutrients') = 'array' then
		select nutrient.value into v_nutrient
		from jsonb_array_elements(v_food -> 'foodNutrients') nutrient(value)
		where jsonb_typeof(nutrient.value) = 'object'
			and jsonb_typeof(nutrient.value -> 'nutrientId') = 'number'
			and (nutrient.value ->> 'nutrientId')::bigint = new.nutrient_id
		limit 1;
	end if;

	v_value_qualifier := nullif(btrim(v_nutrient ->> 'valueQualifier'), '');
	v_explicit_status := nullif(btrim(v_nutrient ->> 'valueStatus'), '');
	new.value_status := case
		when v_value_qualifier = 'source-estimate' then 'estimated'
		when v_explicit_status in ('reported', 'reported-zero', 'estimated', 'derived', 'trace', 'present-unquantified', 'missing', 'invalid', 'unknown') then v_explicit_status
		when new.value_origin = 'estimated' then 'estimated'
		when new.value_origin = 'derived' then 'derived'
		when new.value_origin = 'reported' and new.amount_per_100g = 0 then 'reported-zero'
		when new.value_origin = 'reported' then 'reported'
		else 'unknown'
	end;
	new.value_origin := case
		when new.value_status = 'estimated' then 'estimated'
		when new.value_status = 'derived' then 'derived'
		else 'reported'
	end;
	new.value_qualifier := case
		when new.value_status = 'estimated' then 'source-estimate'
		else null
	end;

	if new.value_status = 'reported-zero' and new.amount_per_100g <> 0 then
		new.value_status := 'reported';
	end if;

	new.standard_error := case
		when jsonb_typeof(v_nutrient -> 'standardError') = 'number'
			and (v_nutrient ->> 'standardError')::numeric >= 0
			then (v_nutrient ->> 'standardError')::numeric
		else null
	end;
	new.source_nutrient_key := nullif(btrim(v_nutrient ->> 'sourceNutrientKey'), '');
	new.source_nutrient_code := nullif(btrim(v_nutrient ->> 'sourceNutrientCode'), '');
	v_mapping_status := nullif(btrim(v_nutrient ->> 'mappingStatus'), '');
	new.mapping_status := case
		when v_mapping_status in ('canonical', 'unmapped', 'excluded', 'unknown') then v_mapping_status
		else 'unknown'
	end;
	new.mapping_method := nullif(btrim(v_nutrient ->> 'mappingMethod'), '');
	new.mapping_review_reference := nullif(btrim(v_nutrient ->> 'mappingReviewReference'), '');
	new.derivation_method := nullif(btrim(v_nutrient ->> 'derivationMethod'), '');
	return new;
end;
$$;

update public.food_nutrients
set amount_per_100g = amount_per_100g;

comment on column public.food_nutrients.value_qualifier is
	'Exact provider qualifier for an accepted numeric nutrient value. source-estimate prevents estimated values from being presented as reported measurements.';
