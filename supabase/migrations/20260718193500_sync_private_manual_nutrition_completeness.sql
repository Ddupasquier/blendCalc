create or replace function public.sync_private_manual_nutrition_completeness()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	delete from public.nutrition_completeness_profile_nutrients
	where profile_key = 'private-manual-core-v1';

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
	where required_nutrients.enabled;

	return null;
end;
$$;

drop trigger if exists sync_private_manual_nutrition_completeness
	on public.nutrient_manual_entry_required_nutrients;

create trigger sync_private_manual_nutrition_completeness
	after insert or update or delete on public.nutrient_manual_entry_required_nutrients
	for each statement execute function public.sync_private_manual_nutrition_completeness();
