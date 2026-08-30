update public.nutrient_relationship_rules rule
set
	tolerance = greatest(rule.tolerance, 0.1),
	provenance = rule.provenance || jsonb_build_object(
		'normalizationTolerance', 0.1,
		'normalizationToleranceUnit', parent_definition.default_unit_name,
		'normalizationToleranceReason',
		'Prevents source measurement and normalization precision from creating an impossible parent-child nutrient warning.'
	),
	updated_at = now()
from public.nutrient_definitions parent_definition,
	public.nutrient_definitions child_definition
where rule.parent_nutrient_id = parent_definition.nutrient_id
	and rule.child_nutrient_id = child_definition.nutrient_id
	and rule.relationship = 'child_must_not_exceed_parent'
	and upper(parent_definition.default_unit_name) = 'G'
	and upper(child_definition.default_unit_name) = 'G';

with corrected_user_list_food as (
	select
		item.id,
		jsonb_set(
			item.food #- array['fieldProvenance', 'nutrient:1235'],
			'{foodNutrients}',
			coalesce(
				(
					select jsonb_agg(nutrient.value order by nutrient.ordinality)
					from jsonb_array_elements(item.food -> 'foodNutrients')
						with ordinality nutrient(value, ordinality)
					where (nutrient.value ->> 'nutrientId')::bigint <> 1235
				),
				'[]'::jsonb
			),
			false
		) as food_without_invalid_added_sugars
	from public.user_food_list_items item
	where coalesce(item.food ->> 'barcode', item.food ->> 'gtinUpc') = '00058449771807'
		and exists (
			select 1
			from jsonb_array_elements(item.food -> 'foodNutrients') total_sugars(value)
			join jsonb_array_elements(item.food -> 'foodNutrients') added_sugars(value)
				on (added_sugars.value ->> 'nutrientId')::bigint = 1235
			where (total_sugars.value ->> 'nutrientId')::bigint = 2000
				and (added_sugars.value ->> 'value')::numeric
					> (total_sugars.value ->> 'value')::numeric + 0.1
		)
)
update public.user_food_list_items item
set
	food = case
		when jsonb_typeof(correction.food_without_invalid_added_sugars -> 'reportedNutrientIds') = 'array'
		then jsonb_set(
			correction.food_without_invalid_added_sugars,
			'{reportedNutrientIds}',
			coalesce(
				(
					select jsonb_agg(nutrient_id.value order by nutrient_id.ordinality)
					from jsonb_array_elements(
						correction.food_without_invalid_added_sugars -> 'reportedNutrientIds'
					) with ordinality nutrient_id(value, ordinality)
					where (nutrient_id.value #>> '{}')::bigint <> 1235
				),
				'[]'::jsonb
			),
			false
		)
		else correction.food_without_invalid_added_sugars
	end,
	updated_at = now()
from corrected_user_list_food correction
where item.id = correction.id;

create or replace function private.canonical_food_nutrient_snapshot_issue(
	p_food jsonb
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_issue text;
begin
	if jsonb_typeof(p_food -> 'foodNutrients') <> 'array' then
		return 'missing_nutrients';
	end if;
	if jsonb_array_length(p_food -> 'foodNutrients') = 0 then
		return null;
	end if;

	if jsonb_array_length(p_food -> 'foodNutrients') > 300 then
		return 'too_many_nutrients';
	end if;

	if exists (
		select 1
		from jsonb_array_elements(p_food -> 'foodNutrients') item(value)
		where jsonb_typeof(item.value) <> 'object'
			or jsonb_typeof(item.value -> 'nutrientId') <> 'number'
			or jsonb_typeof(item.value -> 'value') <> 'number'
			or (item.value ->> 'nutrientId')::numeric <= 0
			or mod((item.value ->> 'nutrientId')::numeric, 1) <> 0
			or (item.value ->> 'value')::numeric < 0
			or nullif(btrim(item.value ->> 'nutrientName'), '') is null
			or nullif(btrim(item.value ->> 'unitName'), '') is null
	) then
		return 'invalid_nutrient_value';
	end if;

	select 'duplicate_nutrient:' || nutrient.nutrient_id::text
	into v_issue
	from (
		select (item.value ->> 'nutrientId')::bigint as nutrient_id
		from jsonb_array_elements(p_food -> 'foodNutrients') item(value)
	) nutrient
	group by nutrient.nutrient_id
	having count(*) > 1
	order by nutrient.nutrient_id
	limit 1;
	if v_issue is not null then
		return v_issue;
	end if;

	select 'unknown_nutrient:' || nutrient.nutrient_id::text
	into v_issue
	from (
		select (item.value ->> 'nutrientId')::bigint as nutrient_id
		from jsonb_array_elements(p_food -> 'foodNutrients') item(value)
	) nutrient
	left join public.nutrient_definitions definition
		on definition.nutrient_id = nutrient.nutrient_id
	where definition.nutrient_id is null
	order by nutrient.nutrient_id
	limit 1;
	if v_issue is not null then
		return v_issue;
	end if;

	select 'unit_mismatch:' || nutrient.nutrient_id::text
	into v_issue
	from (
		select
			(item.value ->> 'nutrientId')::bigint as nutrient_id,
			upper(btrim(item.value ->> 'unitName')) as unit_name
		from jsonb_array_elements(p_food -> 'foodNutrients') item(value)
	) nutrient
	join public.nutrient_definitions definition
		on definition.nutrient_id = nutrient.nutrient_id
	where nutrient.unit_name <> upper(definition.default_unit_name)
	order by nutrient.nutrient_id
	limit 1;
	if v_issue is not null then
		return v_issue;
	end if;

	with nutrient_values as (
		select
			(item.value ->> 'nutrientId')::bigint as nutrient_id,
			(item.value ->> 'value')::numeric as amount_per_100g
		from jsonb_array_elements(p_food -> 'foodNutrients') item(value)
	)
	select rule.issue_code || ':' || rule.id
	into v_issue
	from public.nutrient_relationship_rules rule
	left join nutrient_values parent_value
		on parent_value.nutrient_id = rule.parent_nutrient_id
	join nutrient_values child_value
		on child_value.nutrient_id = rule.child_nutrient_id
	where rule.enabled
		and rule.relationship = 'child_must_not_exceed_parent'
		and (
			(rule.requires_parent and parent_value.nutrient_id is null)
			or child_value.amount_per_100g
				> parent_value.amount_per_100g + rule.tolerance
		)
	order by rule.sort_order, rule.id
	limit 1;

	return v_issue;
end;
$$;

create or replace function private.enforce_active_shared_product_nutrients()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_issue text;
begin
	if new.status <> 'active' then
		return new;
	end if;

	v_issue := private.canonical_food_nutrient_snapshot_issue(new.food);
	if v_issue is not null then
		raise exception using
			errCode = '23514',
			message = 'Active shared product nutrition is not internally coherent: '
				|| new.barcode || ':' || v_issue,
			detail = v_issue;
	end if;

	return new;
end;
$$;

drop trigger if exists enforce_active_shared_product_nutrients
	on public.shared_products;
create trigger enforce_active_shared_product_nutrients
	before insert or update of food, status on public.shared_products
	for each row execute function private.enforce_active_shared_product_nutrients();

do $$
declare
	v_invalid_products text;
begin
	select string_agg(
		product.barcode || ' ('
			|| private.canonical_food_nutrient_snapshot_issue(product.food) || ')',
		', '
		order by product.barcode
	)
	into v_invalid_products
	from public.shared_products product
	where product.status = 'active'
		and private.canonical_food_nutrient_snapshot_issue(product.food) is not null;

	if v_invalid_products is not null then
		raise exception 'Active shared products failed canonical nutrient validation: %',
		v_invalid_products;
	end if;
end;
$$;

revoke all on function private.canonical_food_nutrient_snapshot_issue(jsonb)
	from public, anon, authenticated;
revoke all on function private.enforce_active_shared_product_nutrients()
	from public, anon, authenticated;

comment on function private.canonical_food_nutrient_snapshot_issue(jsonb) is
	'Returns the first structural, identity, unit, or DB-backed relationship issue in a canonical food nutrient snapshot.';
comment on function private.enforce_active_shared_product_nutrients() is
	'Prevents structurally invalid or internally incoherent nutrition from becoming an active shared catalog product.';
