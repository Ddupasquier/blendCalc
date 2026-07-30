alter table public.food_servings
	add column if not exists source_observation_id uuid
		references public.shared_product_observations(id)
		on delete set null;

create index if not exists food_servings_source_observation_idx
	on public.food_servings (source_observation_id)
	where source_observation_id is not null;

create or replace function public.normalize_food_nutrient_lineage()
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
			and provenance.field_path = 'nutrient:' || new.nutrient_id::text
			and provenance.selected
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
					and provenance.field_path = 'nutrient:' || new.nutrient_id::text
					and provenance.selected
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
			and provenance.field_path = 'serving'
			and provenance.selected
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
					and provenance.field_path = 'serving'
					and provenance.selected
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

drop trigger if exists normalize_food_nutrient_lineage
	on public.food_nutrients;
create trigger normalize_food_nutrient_lineage
	before insert or update of
		source,
		source_reference,
		source_observation_id,
		confidence,
		nutrient_id,
		user_food_list_item_id,
		custom_food_id,
		shared_product_id,
		shared_product_observation_id
	on public.food_nutrients
	for each row
	execute function public.normalize_food_nutrient_lineage();

drop trigger if exists normalize_food_serving_lineage
	on public.food_servings;
create trigger normalize_food_serving_lineage
	before insert or update of
		source,
		source_reference,
		source_observation_id,
		confidence,
		user_food_list_item_id,
		custom_food_id,
		shared_product_id,
		shared_product_observation_id
	on public.food_servings
	for each row
	execute function public.normalize_food_serving_lineage();

update public.food_nutrients
set source = source;

update public.food_servings
set source = source;

comment on column public.food_servings.source_observation_id is
	'Exact source observation supporting this serving. Null means serving lineage is unknown.';
comment on function public.normalize_food_nutrient_lineage() is
	'Requires normalized nutrients to retain an exact observation or remain explicitly unknown; provider identity never verifies a nutrient.';
comment on function public.normalize_food_serving_lineage() is
	'Requires normalized servings to retain an exact observation or remain explicitly unknown; provider identity never verifies a serving.';

revoke all on function public.normalize_food_nutrient_lineage()
	from public, anon, authenticated;
revoke all on function public.normalize_food_serving_lineage()
	from public, anon, authenticated;
