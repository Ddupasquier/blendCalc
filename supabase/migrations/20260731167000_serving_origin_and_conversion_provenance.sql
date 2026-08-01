alter table public.food_servings
	add column if not exists measure_type text,
	add column if not exists is_household_measure boolean not null default false,
	add column if not exists source_measure_key text,
	add column if not exists origin text not null default 'unknown',
	add column if not exists gram_weight_method text not null default 'unknown',
	add column if not exists calculation_basis text;

alter table public.food_servings
	drop constraint if exists food_servings_origin_check,
	add constraint food_servings_origin_check check (
		origin in (
			'package-label',
			'source-household-measure',
			'source-weight',
			'user-entered',
			'calculated-conversion',
			'unknown'
		)
	),
	drop constraint if exists food_servings_gram_weight_method_check,
	add constraint food_servings_gram_weight_method_check check (
		gram_weight_method in (
			'source-reported',
			'exact-unit-conversion',
			'user-reported',
			'calculated-conversion',
			'unknown'
		)
	);

create or replace function public.apply_food_serving_semantics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_food jsonb;
	v_item jsonb;
	v_observation_food jsonb;
	v_observation_source text;
	v_unit_dimension text;
begin
	if new.user_food_list_item_id is not null then
		select item.food into v_food
		from public.user_food_list_items item
		where item.id = new.user_food_list_item_id;
	elsif new.custom_food_id is not null then
		select food.food into v_food
		from public.custom_foods food
		where food.id = new.custom_food_id;
	elsif new.shared_product_submission_id is not null then
		select submission.food into v_food
		from public.shared_product_submissions submission
		where submission.id = new.shared_product_submission_id;
	elsif new.shared_product_id is not null then
		select product.food into v_food
		from public.shared_products product
		where product.id = new.shared_product_id;
	elsif new.shared_product_revision_id is not null then
		select revision.food into v_food
		from public.shared_product_revisions revision
		where revision.id = new.shared_product_revision_id;
	elsif new.shared_product_observation_id is not null then
		select observation.normalized_food into v_food
		from public.shared_product_observations observation
		where observation.id = new.shared_product_observation_id;
	end if;

	if jsonb_typeof(v_food -> 'foodServings') = 'array' then
		select serving.value into v_item
		from jsonb_array_elements(v_food -> 'foodServings') with ordinality serving(value, position)
		where jsonb_typeof(serving.value) = 'object'
			and jsonb_typeof(serving.value -> 'gramWeight') = 'number'
			and (serving.value ->> 'gramWeight')::numeric = new.gram_weight
			and lower(btrim(serving.value ->> 'label')) = lower(btrim(new.label))
		order by
			case when serving.position = new.serving_order then 0 else 1 end,
			serving.position
		limit 1;
	end if;

	if v_item is not null then
		new.measure_type := coalesce(
			nullif(btrim(v_item ->> 'measureType'), ''),
			new.measure_type
		);
		new.is_household_measure := case
			when jsonb_typeof(v_item -> 'isHouseholdMeasure') = 'boolean'
				then (v_item ->> 'isHouseholdMeasure')::boolean
			else new.is_household_measure
		end;
		new.source_measure_key := coalesce(
			nullif(btrim(v_item ->> 'sourceMeasureKey'), ''),
			new.source_measure_key
		);
		new.origin := coalesce(
			nullif(btrim(v_item ->> 'origin'), ''),
			new.origin
		);
		new.gram_weight_method := coalesce(
			nullif(btrim(v_item ->> 'gramWeightMethod'), ''),
			new.gram_weight_method
		);
		new.calculation_basis := coalesce(
			nullif(btrim(v_item ->> 'calculationBasis'), ''),
			new.calculation_basis
		);
	end if;

	if new.source_observation_id is not null then
		select observation.normalized_food, observation.source
		into v_observation_food, v_observation_source
		from public.shared_product_observations observation
		where observation.id = new.source_observation_id;

		if jsonb_typeof(v_observation_food -> 'foodServings') = 'array' then
			select serving.value into v_item
			from jsonb_array_elements(v_observation_food -> 'foodServings') serving(value)
			where jsonb_typeof(serving.value) = 'object'
				and jsonb_typeof(serving.value -> 'gramWeight') = 'number'
				and (serving.value ->> 'gramWeight')::numeric = new.gram_weight
				and lower(btrim(serving.value ->> 'label')) = lower(btrim(new.label))
			limit 1;
		end if;

		if v_item is not null then
			new.measure_type := coalesce(
				nullif(btrim(v_item ->> 'measureType'), ''),
				new.measure_type
			);
			new.is_household_measure := case
				when jsonb_typeof(v_item -> 'isHouseholdMeasure') = 'boolean'
					then (v_item ->> 'isHouseholdMeasure')::boolean
				else new.is_household_measure
			end;
			new.source_measure_key := coalesce(
				nullif(btrim(v_item ->> 'sourceMeasureKey'), ''),
				new.source_measure_key
			);
			new.origin := coalesce(
				nullif(btrim(v_item ->> 'origin'), ''),
				new.origin
			);
			new.gram_weight_method := coalesce(
				nullif(btrim(v_item ->> 'gramWeightMethod'), ''),
				new.gram_weight_method
			);
			new.calculation_basis := coalesce(
				nullif(btrim(v_item ->> 'calculationBasis'), ''),
				new.calculation_basis
			);

			if new.origin = 'unknown' then
				new.origin := case
					when v_observation_source = 'open-food-facts'
						then 'package-label'
					when v_observation_source = 'user-label'
						then 'user-entered'
					when v_observation_food ->> 'foodIdentityType' = 'packaged'
						then 'package-label'
					when v_observation_food ->> 'foodIdentityType' = 'generic'
						then 'source-household-measure'
					else 'unknown'
				end;
			end if;
			if new.gram_weight_method = 'unknown' then
				new.gram_weight_method := case
					when v_observation_source = 'user-label' then 'user-reported'
					else 'source-reported'
				end;
			end if;
		end if;
	end if;

	if new.source = 'user-label' and new.owner_user_id is not null then
		if new.origin = 'unknown' then
			new.origin := 'user-entered';
		end if;
		if new.gram_weight_method = 'unknown' then
			new.gram_weight_method := 'user-reported';
		end if;
	end if;

	if new.unit_key is not null then
		select unit.dimension into v_unit_dimension
		from public.serving_measure_units unit
		where unit.key = new.unit_key;
	end if;
	if v_unit_dimension = 'volume' and new.origin <> 'unknown' then
		new.is_household_measure := true;
	end if;

	new.measure_type := nullif(btrim(new.measure_type), '');
	new.source_measure_key := nullif(btrim(new.source_measure_key), '');
	new.calculation_basis := nullif(btrim(new.calculation_basis), '');
	if new.origin not in (
		'package-label', 'source-household-measure', 'source-weight',
		'user-entered', 'calculated-conversion', 'unknown'
	) then
		new.origin := 'unknown';
	end if;
	if new.gram_weight_method not in (
		'source-reported', 'exact-unit-conversion', 'user-reported',
		'calculated-conversion', 'unknown'
	) then
		new.gram_weight_method := 'unknown';
	end if;
	return new;
end;
$$;

drop trigger if exists zz_apply_food_serving_semantics
	on public.food_servings;
create trigger zz_apply_food_serving_semantics
	before insert or update of
		label,
		gram_weight,
		amount,
		unit_key,
		measure_type,
		is_household_measure,
		source_measure_key,
		origin,
		gram_weight_method,
		calculation_basis,
		source,
		source_observation_id,
		owner_user_id,
		user_food_list_item_id,
		custom_food_id,
		shared_product_submission_id,
		shared_product_id,
		shared_product_revision_id,
		shared_product_observation_id
	on public.food_servings
	for each row execute function public.apply_food_serving_semantics();

update public.food_servings
set origin = origin;

comment on column public.food_servings.measure_type is
	'Exact measure classification reported by the serving source when available.';
comment on column public.food_servings.is_household_measure is
	'True only when the serving is an explicit household or volume measure.';
comment on column public.food_servings.source_measure_key is
	'Source-owned measure identifier retained without using it as display copy.';
comment on column public.food_servings.origin is
	'Bounded serving origin; ambiguous legacy rows remain unknown.';
comment on column public.food_servings.gram_weight_method is
	'How the stored gram weight was established; runtime conversions are not silently stored as source-reported.';
comment on column public.food_servings.calculation_basis is
	'Human-readable source-backed basis for a calculated serving weight, when applicable.';
comment on function public.apply_food_serving_semantics() is
	'Preserves explicit serving origin and conversion metadata and backfills only from exact serving observations or user-entered evidence.';

revoke all on function public.apply_food_serving_semantics()
	from public, anon, authenticated;
grant execute on function public.apply_food_serving_semantics()
	to service_role;
