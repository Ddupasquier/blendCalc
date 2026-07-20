update public.shared_products product
set
	confidence = 'imported',
	food = jsonb_set(
		coalesce(product.food, '{}'::jsonb),
		'{sharedProductConfidence}',
		'"imported"'::jsonb,
		true
	)
where product.source = 'open-food-facts'
	and product.confidence = 'source-verified'
	and not exists (
		select 1
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = product.id
			and provenance.verification_method in (
				'exact-barcode',
				'cross-source',
				'moderator-review'
			)
	);

update public.food_nutrients
set confidence = 'unknown'
where source = 'open-food-facts'
	and confidence = 'source-verified';

update public.food_servings
set confidence = 'unknown'
where source = 'open-food-facts'
	and confidence = 'source-verified';

update public.food_image_assets
set confidence = 'imported'
where source = 'open-food-facts'
	and confidence = 'source-verified';

update public.user_food_list_items
set food = food
where shared_product_id in (
	select id
	from public.shared_products
	where source = 'open-food-facts'
);
