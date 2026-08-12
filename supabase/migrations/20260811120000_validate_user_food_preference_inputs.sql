create or replace function public.validate_user_food_preference_inputs()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
	preference_value text;
	normalized_value_count integer;
begin
	foreach preference_value in array new.allergens || new.dietary_restrictions
	loop
		if btrim(preference_value) = '' or char_length(preference_value) > 60 then
			raise exception using
				errcode = '23514',
				message = 'Food preference entries must contain 1 to 60 characters.';
		end if;
	end loop;

	select count(distinct lower(regexp_replace(btrim(value), '[[:space:]]+', ' ', 'g')))
	into normalized_value_count
	from unnest(new.allergens) value;
	if normalized_value_count <> cardinality(new.allergens) then
		raise exception using
			errcode = '23514',
			message = 'Allergen preferences must not contain duplicate values.';
	end if;

	select count(distinct lower(regexp_replace(btrim(value), '[[:space:]]+', ' ', 'g')))
	into normalized_value_count
	from unnest(new.dietary_restrictions) value;
	if normalized_value_count <> cardinality(new.dietary_restrictions) then
		raise exception using
			errcode = '23514',
			message = 'Dietary preferences must not contain duplicate values.';
	end if;

	if cardinality(new.prioritized_nutrient_ids) <>
		(select count(distinct nutrient_id) from unnest(new.prioritized_nutrient_ids) nutrient_id)
	then
		raise exception using
			errcode = '23514',
			message = 'Priority nutrients must not contain duplicate values.';
	end if;

	if exists (
		select 1
		from unnest(new.prioritized_nutrient_ids) selected_nutrient_id
		where not exists (
			select 1
			from public.nutrient_display_profiles profile
			join public.nutrient_display_profile_fields field
				on field.profile_key = profile.key
			where profile.purpose = 'mix_default'
				and profile.enabled
				and field.nutrient_id = selected_nutrient_id
		)
	) then
		raise exception using
			errcode = '23514',
			message = 'Priority nutrients must come from the active Mix display profile.';
	end if;

	if new.default_smoothie_serving_grams > 5000 then
		raise exception using
			errcode = '23514',
			message = 'Default Mix serving size must not exceed 5,000 grams.';
	end if;

	if new.sensitive_acknowledged_at is null and (
		new.unit_system is not null
		or cardinality(new.allergens) > 0
		or cardinality(new.dietary_restrictions) > 0
		or cardinality(new.prioritized_nutrient_ids) > 0
		or new.default_smoothie_serving_grams is not null
		or new.regulatory_region_code is not null
	) then
		raise exception using
			errcode = '23514',
			message = 'Food preference acknowledgement is required before saving preferences.';
	end if;

	return new;
end;
$$;

drop trigger if exists validate_user_food_preference_inputs
	on public.user_food_preferences;
create trigger validate_user_food_preference_inputs
	before insert or update on public.user_food_preferences
	for each row execute function public.validate_user_food_preference_inputs();

revoke all on function public.validate_user_food_preference_inputs()
	from public, anon, authenticated;
grant execute on function public.validate_user_food_preference_inputs()
	to service_role;

comment on function public.validate_user_food_preference_inputs() is
	'Rejects malformed, duplicate, unacknowledged, oversized, or non-policy user food preferences at the database boundary.';
