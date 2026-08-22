create or replace function public.food_metadata_search_text(p_food jsonb)
returns text
language sql
stable
set search_path = public
as $$
	select lower(concat_ws(
		' ',
		p_food ->> 'description',
		p_food ->> 'alternateDescription',
		p_food ->> 'scientificName',
		p_food ->> 'brandOwner',
		p_food ->> 'foodCategory',
		p_food ->> 'brandedFoodCategory',
		p_food ->> 'preparation',
		p_food ->> 'marketCountry',
		p_food ->> 'packageWeight',
		p_food ->> 'ingredients',
		public.jsonb_text_array_search_text(p_food -> 'ingredientList'),
		public.jsonb_text_array_search_text(p_food -> 'additives'),
		public.jsonb_text_array_search_text(p_food -> 'allergens'),
		public.jsonb_text_array_search_text(p_food -> 'traces'),
		public.jsonb_text_array_search_text(p_food -> 'dietaryTags'),
		public.jsonb_text_array_search_text(p_food -> 'labels'),
		public.jsonb_text_array_search_text(p_food -> 'categories'),
		public.jsonb_text_array_search_text(p_food -> 'sourceCategories'),
		public.jsonb_text_array_search_text(p_food -> 'sourceMetadata' -> 'marketCountries')
	));
$$;

update public.shared_products product
set search_text = lower(concat_ws(
	' ',
	product.product_name,
	product.brand_owner,
	product.barcode,
	public.food_metadata_search_text(product.food)
));

update public.custom_foods custom_food
set search_text = lower(concat_ws(
	' ',
	custom_food.barcode,
	custom_food.name_key,
	public.food_metadata_search_text(custom_food.food)
));

comment on function public.food_metadata_search_text(jsonb) is
	'Builds normalized candidate text from real food identity, category, package, ingredient, and label metadata. Result ranking remains field-aware in the server search layer.';
