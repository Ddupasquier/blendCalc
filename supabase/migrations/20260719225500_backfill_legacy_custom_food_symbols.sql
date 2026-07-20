alter table public.custom_foods
	disable trigger prepare_custom_food_record;

update public.custom_foods
set food = jsonb_set(
	food,
	'{symbolKey}',
	to_jsonb(public.resolve_food_symbol_key_for_food(food, category_option_id)),
	true
);

alter table public.custom_foods
	enable trigger prepare_custom_food_record;

comment on table public.custom_foods is
	'Private user-created foods. Legacy rows were normalized for DB-owned fallback symbols before MVP.';
