update public.food_symbol_category_rules
set match_pattern = '(protein powder|protein bar|protein supplement|whey|casein|protein isolate|protein concentrate)',
	updated_at = now()
where symbol_key = 'protein-powder';

update public.food_symbol_category_rules
set match_pattern = '(grain|cereal|wheat|oat|rice|pasta|bread|flour|dough|crust|noodle)',
	updated_at = now()
where symbol_key = 'grains';

update public.food_symbol_category_rules
set priority = 35,
	updated_at = now()
where symbol_key = 'nuts-seeds';

update public.food_symbol_category_rules
set match_pattern = '(branded|packaged|prepared|sauce|soup|condiment|dip|salsa|snack|chip|crisp|spice|herb|seasoning)',
	updated_at = now()
where symbol_key = 'packaged';

update public.custom_food_category_options
set symbol_key = public.resolve_food_symbol_key(normalized_value),
	updated_at = now();

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
			select category.symbol_key
			from public.custom_food_category_options category
			where category.id = coalesce(
				nullif(btrim(p_category_option_id), ''),
				nullif(btrim(p_food ->> 'categoryOptionId'), '')
			)
		),
		public.resolve_food_symbol_key(
			coalesce(
				nullif(btrim(p_food ->> 'foodCategory'), ''),
				nullif(btrim(p_food ->> 'brandedFoodCategory'), ''),
				nullif(btrim(p_food ->> 'description'), '')
			)
		)
	);
$$;

create or replace function public.sync_canonical_food_category_display()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_category_option_id text;
	v_category_label text;
	v_symbol_key text;
begin
	v_category_option_id := coalesce(
		nullif(btrim(new.food ->> 'categoryOptionId'), ''),
		nullif(btrim(to_jsonb(new) ->> 'category_option_id'), '')
	);

	if v_category_option_id is not null then
		select category.label, category.symbol_key
		into v_category_label, v_symbol_key
		from public.custom_food_category_options category
		where category.id = v_category_option_id;

		if v_category_label is not null then
			new.category_option_id := v_category_option_id;
			new.food := jsonb_set(
				jsonb_set(new.food, '{categoryOptionId}', to_jsonb(v_category_option_id), true),
				'{foodCategory}',
				to_jsonb(v_category_label),
				true
			);
		end if;
	end if;

	v_symbol_key := coalesce(
		v_symbol_key,
		public.resolve_food_symbol_key_for_food(new.food, v_category_option_id)
	);
	new.food := jsonb_set(new.food, '{symbolKey}', to_jsonb(v_symbol_key), true);
	return new;
end;
$$;

create or replace function public.sync_user_food_category_display()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_category_option_id text;
	v_category_label text;
	v_symbol_key text;
begin
	v_category_option_id := nullif(btrim(new.food ->> 'categoryOptionId'), '');

	if v_category_option_id is null and new.shared_product_id is not null then
		select product.category_option_id
		into v_category_option_id
		from public.shared_products product
		where product.id = new.shared_product_id;
	end if;

	if v_category_option_id is null then
		select custom_food.category_option_id
		into v_category_option_id
		from public.custom_foods custom_food
		where custom_food.user_id = new.user_id
			and custom_food.fdc_id = new.fdc_id
		order by custom_food.updated_at desc, custom_food.id desc
		limit 1;
	end if;

	if v_category_option_id is not null then
		select category.label, category.symbol_key
		into v_category_label, v_symbol_key
		from public.custom_food_category_options category
		where category.id = v_category_option_id;

		if v_category_label is not null then
			new.food := jsonb_set(
				jsonb_set(new.food, '{categoryOptionId}', to_jsonb(v_category_option_id), true),
				'{foodCategory}',
				to_jsonb(v_category_label),
				true
			);
		end if;
	end if;

	v_symbol_key := coalesce(
		v_symbol_key,
		public.resolve_food_symbol_key_for_food(new.food, v_category_option_id)
	);
	new.food := jsonb_set(new.food, '{symbolKey}', to_jsonb(v_symbol_key), true);
	return new;
end;
$$;

update public.custom_foods
set food = jsonb_set(
	food,
	'{symbolKey}',
	to_jsonb(public.resolve_food_symbol_key_for_food(food, category_option_id)),
	true
)
where category_option_id is not null;

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
	'Resolves the DB-owned fallback symbol for stored food JSON using its canonical category before text fallback.';
