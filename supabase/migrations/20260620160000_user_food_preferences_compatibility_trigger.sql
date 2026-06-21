create or replace function public.handle_user_food_preferences_compatibility_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if tg_op = 'DELETE' then
		perform public.sync_user_compatibility_rules(
			old.user_id,
			'{}'::text[],
			'{}'::text[],
			'{}'::text[],
			'{}'::text[]
		);
		return old;
	end if;

	perform public.sync_user_compatibility_rules(
		new.user_id,
		coalesce(new.food_preferences, '{}'::text[]),
		coalesce(new.allergens, '{}'::text[]),
		coalesce(new.dietary_restrictions, '{}'::text[]),
		coalesce(new.ingredients_to_avoid, '{}'::text[])
	);
	return new;
end;
$$;

drop trigger if exists sync_user_food_preferences_compatibility_rules
	on public.user_food_preferences;
create trigger sync_user_food_preferences_compatibility_rules
	after insert or update of food_preferences, allergens, dietary_restrictions, ingredients_to_avoid
	or delete on public.user_food_preferences
	for each row execute function public.handle_user_food_preferences_compatibility_sync();

revoke all on function public.sync_user_compatibility_rules(
	uuid,
	text[],
	text[],
	text[],
	text[]
) from authenticated;

revoke all on function public.handle_user_food_preferences_compatibility_sync()
	from public, anon, authenticated;

select public.sync_user_compatibility_rules(
	preferences.user_id,
	preferences.food_preferences,
	preferences.allergens,
	preferences.dietary_restrictions,
	preferences.ingredients_to_avoid
)
from public.user_food_preferences preferences;
