create or replace function public.resolve_food_symbol_key_for_food(
	p_food jsonb,
	p_category_option_id text default null
)
returns text
language sql
stable
set search_path = ''
as $$
	select coalesce(
		(
			select nullif(category.symbol_key, 'generic')
			from public.custom_food_category_options category
			where category.id = coalesce(
				nullif(btrim(p_category_option_id), ''),
				nullif(btrim(p_food ->> 'categoryOptionId'), '')
			)
		),
		public.resolve_food_symbol_key(
			pg_catalog.concat_ws(
				' ',
				nullif(btrim(p_food ->> 'foodCategory'), ''),
				nullif(btrim(p_food ->> 'brandedFoodCategory'), ''),
				nullif(btrim(p_food ->> 'description'), '')
			)
		)
	);
$$;

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

update public.shared_product_submissions
set food = jsonb_set(
	food,
	'{symbolKey}',
	to_jsonb(public.resolve_food_symbol_key_for_food(food, category_option_id)),
	true
);

update public.shared_products
set food = jsonb_set(
	food,
	'{symbolKey}',
	to_jsonb(public.resolve_food_symbol_key_for_food(food, category_option_id)),
	true
);

update public.shared_product_revisions
set food = jsonb_set(
	food,
	'{symbolKey}',
	to_jsonb(public.resolve_food_symbol_key_for_food(food, category_option_id)),
	true
);

update public.user_food_list_items
set food = jsonb_set(
	food,
	'{symbolKey}',
	to_jsonb(public.resolve_food_symbol_key_for_food(food)),
	true
);

revoke all on function public.resolve_food_symbol_key_for_food(jsonb, text)
	from public, anon, authenticated;
grant execute on function public.resolve_food_symbol_key_for_food(jsonb, text)
	to service_role;

comment on function public.resolve_food_symbol_key_for_food(jsonb, text) is
	'Uses the canonical category symbol first, then applies DB-owned rules to category and food-name text when the category only provides the generic fallback.';
