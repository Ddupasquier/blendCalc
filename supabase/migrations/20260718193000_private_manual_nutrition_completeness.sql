alter table public.nutrition_completeness_profiles
	drop constraint if exists nutrition_completeness_profiles_food_scope_check;

alter table public.nutrition_completeness_profiles
	add constraint nutrition_completeness_profiles_food_scope_check
	check (food_scope in ('generic', 'manual', 'packaged'));

insert into public.nutrition_completeness_profiles (
	key,
	display_name,
	food_scope,
	region_code,
	complete_label,
	resolved_label,
	partial_label,
	limited_label,
	description,
	source_key,
	source_reference,
	is_default,
	enabled
)
values (
	'private-manual-core-v1',
	'Private manual-entry core nutrition',
	'manual',
	'',
	'Complete',
	'Resolved',
	'Partial',
	'Limited',
	'Required nutrition for a private ingredient entered by the user.',
	'blendcalc-nutrition-policy',
	'blendCalc private manual-entry completeness policy version 2026-07-18',
	true,
	true
)
on conflict (key) do update
set
	display_name = excluded.display_name,
	food_scope = excluded.food_scope,
	region_code = excluded.region_code,
	complete_label = excluded.complete_label,
	resolved_label = excluded.resolved_label,
	partial_label = excluded.partial_label,
	limited_label = excluded.limited_label,
	description = excluded.description,
	source_key = excluded.source_key,
	source_reference = excluded.source_reference,
	is_default = excluded.is_default,
	enabled = excluded.enabled;

insert into public.nutrition_completeness_profile_nutrients (
	profile_key,
	nutrient_id,
	requirement_level,
	display_order,
	reason
)
select
	'private-manual-core-v1',
	required_nutrients.nutrient_id,
	'required',
	required_nutrients.field_sort_order,
	required_nutrients.reason
from public.nutrient_manual_entry_required_nutrients required_nutrients
where required_nutrients.enabled
on conflict (profile_key, nutrient_id) do update
set
	requirement_level = excluded.requirement_level,
	display_order = excluded.display_order,
	reason = excluded.reason;

do $$
declare
	v_manual_requirement_count integer;
	v_manual_profile_count integer;
begin
	select count(*) into v_manual_requirement_count
	from public.nutrient_manual_entry_required_nutrients
	where enabled;

	select count(*) into v_manual_profile_count
	from public.nutrition_completeness_profile_nutrients
	where profile_key = 'private-manual-core-v1'
		and requirement_level = 'required';

	if v_manual_requirement_count = 0 then
		raise exception 'Private manual nutrition profile requires at least one enabled manual-entry nutrient';
	end if;

	if v_manual_profile_count <> v_manual_requirement_count then
		raise exception 'Private manual nutrition profile expected % nutrients, found %',
			v_manual_requirement_count,
			v_manual_profile_count;
	end if;
end;
$$;
