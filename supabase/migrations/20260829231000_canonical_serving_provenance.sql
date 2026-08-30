create or replace function public.normalize_food_serving_lineage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_shared_product_id uuid;
	v_observation_id uuid;
	v_observation_source text;
	v_observation_reference text;
	v_provenance_confidence text;
begin
	v_shared_product_id := new.shared_product_id;

	if v_shared_product_id is null and new.user_food_list_item_id is not null then
		select item.shared_product_id
		into v_shared_product_id
		from public.user_food_list_items item
		where item.id = new.user_food_list_item_id;
	end if;

	if v_shared_product_id is null and new.custom_food_id is not null then
		select case
			when food.food ->> 'sharedProductId'
				~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
			then (food.food ->> 'sharedProductId')::uuid
			else null
		end
		into v_shared_product_id
		from public.custom_foods food
		where food.id = new.custom_food_id;
	end if;

	v_observation_id := coalesce(
		new.source_observation_id,
		new.shared_product_observation_id
	);

	if v_observation_id is null and v_shared_product_id is not null then
		select provenance.observation_id, provenance.confidence
		into v_observation_id, v_provenance_confidence
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = v_shared_product_id
			and provenance.field_path in ('serving', 'servingWeightGrams')
			and provenance.selected
		order by case when provenance.field_path = 'serving' then 0 else 1 end
		limit 1;
	end if;

	if v_observation_id is not null then
		select observation.source, observation.source_reference
		into v_observation_source, v_observation_reference
		from public.shared_product_observations observation
		where observation.id = v_observation_id;

		if found then
			if v_provenance_confidence is null then
				select provenance.confidence
				into v_provenance_confidence
				from public.shared_product_field_provenance provenance
				where provenance.observation_id = v_observation_id
					and provenance.field_path in ('serving', 'servingWeightGrams')
					and provenance.selected
				order by case when provenance.field_path = 'serving' then 0 else 1 end
				limit 1;
			end if;

			new.source_observation_id := v_observation_id;
			new.source := v_observation_source;
			new.source_reference := v_observation_reference;
			new.confidence := coalesce(
				v_provenance_confidence,
				case
					when v_observation_source = 'user-label' then 'user-reported'
					else 'imported'
				end
			);
			return new;
		end if;
	end if;

	new.source_observation_id := null;
	if new.source = 'user-label' and new.owner_user_id is not null then
		new.confidence := 'user-reported';
	else
		new.source := 'unknown';
		new.source_reference := null;
		new.confidence := 'unknown';
	end if;
	return new;
end;
$$;

insert into public.shared_product_field_provenance (
	shared_product_id,
	observation_id,
	field_path,
	source_value,
	normalized_value,
	confidence,
	verification_method,
	selected
)
select
	weight.shared_product_id,
	weight.observation_id,
	'serving',
	jsonb_build_object(
		'label', serving.label,
		'gramWeight', serving.gram_weight,
		'amount', serving.amount,
		'unitKey', serving.unit_key
	),
	jsonb_build_object(
		'label', serving.label,
		'gramWeight', serving.gram_weight,
		'amount', serving.amount,
		'unitKey', serving.unit_key
	),
	weight.confidence,
	weight.verification_method,
	true
from public.shared_product_field_provenance weight
join lateral (
	select candidate.*
	from public.food_servings candidate
	where candidate.shared_product_id = weight.shared_product_id
		and candidate.is_primary
	order by candidate.serving_order, candidate.id
	limit 1
) serving on true
where weight.field_path = 'servingWeightGrams'
	and weight.selected
	and not exists (
		select 1
		from public.shared_product_field_provenance existing
		where existing.shared_product_id = weight.shared_product_id
			and existing.field_path = 'serving'
			and existing.selected
	)
on conflict (shared_product_id, observation_id, field_path) do nothing;

update public.food_servings
set source = source
where shared_product_id is not null
	and is_primary;

comment on function public.normalize_food_serving_lineage() is
	'Links normalized servings to canonical serving evidence, accepting current servingWeightGrams provenance and legacy serving provenance.';
