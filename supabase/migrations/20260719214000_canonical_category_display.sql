create or replace function public.sync_canonical_food_category_display()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_category_option_id text;
	v_category_label text;
begin
	v_category_option_id := coalesce(
		nullif(btrim(new.food ->> 'categoryOptionId'), ''),
		nullif(btrim(to_jsonb(new) ->> 'category_option_id'), '')
	);

	if v_category_option_id is null then
		return new;
	end if;

	select category.label
	into v_category_label
	from public.custom_food_category_options category
	where category.id = v_category_option_id;

	if v_category_label is null then
		return new;
	end if;

	new.category_option_id := v_category_option_id;
	new.food := jsonb_set(
		jsonb_set(new.food, '{categoryOptionId}', to_jsonb(v_category_option_id), true),
		'{foodCategory}',
		to_jsonb(v_category_label),
		true
	);
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

	if v_category_option_id is null then
		return new;
	end if;

	select category.label
	into v_category_label
	from public.custom_food_category_options category
	where category.id = v_category_option_id;

	if v_category_label is null then
		return new;
	end if;

	new.food := jsonb_set(
		jsonb_set(new.food, '{categoryOptionId}', to_jsonb(v_category_option_id), true),
		'{foodCategory}',
		to_jsonb(v_category_label),
		true
	);
	return new;
end;
$$;

do $$
declare
	v_table text;
begin
	foreach v_table in array array[
		'custom_foods',
		'shared_product_submissions',
		'shared_products',
		'shared_product_revisions'
	]
	loop
		execute format(
			'drop trigger if exists zz_sync_canonical_food_category_display on public.%I',
			v_table
		);
		execute format(
			'create trigger zz_sync_canonical_food_category_display before insert or update of food, category_option_id on public.%I for each row execute function public.sync_canonical_food_category_display()',
			v_table
		);
	end loop;
end;
$$;

drop trigger if exists zz_sync_user_food_category_display
	on public.user_food_list_items;

create trigger zz_sync_user_food_category_display
	before insert or update of food, shared_product_id, fdc_id
	on public.user_food_list_items
	for each row execute function public.sync_user_food_category_display();

update public.custom_foods custom_food
set food = jsonb_set(
	jsonb_set(custom_food.food, '{categoryOptionId}', to_jsonb(category.id), true),
	'{foodCategory}',
	to_jsonb(category.label),
	true
)
from public.custom_food_category_options category
where category.id = custom_food.category_option_id
	and custom_food.food ->> 'foodCategory' is distinct from category.label;

update public.shared_product_submissions submission
set food = jsonb_set(
	jsonb_set(submission.food, '{categoryOptionId}', to_jsonb(category.id), true),
	'{foodCategory}',
	to_jsonb(category.label),
	true
)
from public.custom_food_category_options category
where category.id = submission.category_option_id
	and submission.food ->> 'foodCategory' is distinct from category.label;

update public.shared_products product
set food = jsonb_set(
	jsonb_set(product.food, '{categoryOptionId}', to_jsonb(category.id), true),
	'{foodCategory}',
	to_jsonb(category.label),
	true
)
from public.custom_food_category_options category
where category.id = product.category_option_id
	and product.food ->> 'foodCategory' is distinct from category.label;

update public.shared_product_revisions revision
set food = jsonb_set(
	jsonb_set(revision.food, '{categoryOptionId}', to_jsonb(category.id), true),
	'{foodCategory}',
	to_jsonb(category.label),
	true
)
from public.custom_food_category_options category
where category.id = revision.category_option_id
	and revision.food ->> 'foodCategory' is distinct from category.label;

with resolved_categories as (
	select
		list_item.id,
		coalesce(
			nullif(btrim(list_item.food ->> 'categoryOptionId'), ''),
			custom_food.category_option_id,
			product.category_option_id
		) as category_option_id
	from public.user_food_list_items list_item
	left join public.custom_foods custom_food
		on custom_food.user_id = list_item.user_id
		and custom_food.fdc_id = list_item.fdc_id
	left join public.shared_products product
		on product.id = list_item.shared_product_id
)
update public.user_food_list_items list_item
set food = jsonb_set(
	jsonb_set(list_item.food, '{categoryOptionId}', to_jsonb(category.id), true),
	'{foodCategory}',
	to_jsonb(category.label),
	true
)
from resolved_categories resolved
join public.custom_food_category_options category
	on category.id = resolved.category_option_id
where list_item.id = resolved.id
	and list_item.food ->> 'foodCategory' is distinct from category.label;

revoke all on function public.sync_canonical_food_category_display()
	from public, anon, authenticated;
revoke all on function public.sync_user_food_category_display()
	from public, anon, authenticated;
grant execute on function public.sync_canonical_food_category_display()
	to service_role;
grant execute on function public.sync_user_food_category_display()
	to service_role;
