create or replace function public.jsonb_text_array_search_text(p_value jsonb)
returns text
language sql
immutable
set search_path = public
as $$
	select string_agg(value, ' ')
	from jsonb_array_elements_text(
		case
			when jsonb_typeof(p_value) = 'array' then p_value
			else '[]'::jsonb
		end
	);
$$;

create or replace function public.food_metadata_search_text(p_food jsonb)
returns text
language sql
stable
set search_path = public
as $$
	select lower(concat_ws(
		' ',
		p_food ->> 'description',
		p_food ->> 'brandOwner',
		p_food ->> 'foodCategory',
		p_food ->> 'ingredients',
		public.jsonb_text_array_search_text(p_food -> 'ingredientList'),
		public.jsonb_text_array_search_text(p_food -> 'allergens'),
		public.jsonb_text_array_search_text(p_food -> 'traces'),
		public.jsonb_text_array_search_text(p_food -> 'dietaryTags'),
		public.jsonb_text_array_search_text(p_food -> 'labels'),
		public.jsonb_text_array_search_text(p_food -> 'categories')
	));
$$;

create or replace function public.set_shared_product_search_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
	new.search_text = lower(concat_ws(
		' ',
		new.product_name,
		new.brand_owner,
		new.barcode,
		public.food_metadata_search_text(new.food)
	));
	return new;
end;
$$;

drop trigger if exists set_shared_product_search_text on public.shared_products;

create trigger set_shared_product_search_text
	before insert or update of product_name, brand_owner, barcode, food
	on public.shared_products
	for each row execute function public.set_shared_product_search_text();

update public.shared_products
set search_text = lower(concat_ws(
	' ',
	product_name,
	brand_owner,
	barcode,
	public.food_metadata_search_text(food)
));
