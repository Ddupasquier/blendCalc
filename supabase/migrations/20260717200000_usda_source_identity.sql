update public.ingredient_source_options
set
	filter_label = 'USDA',
	badge_label = 'USDA'
where value = 'fdc';

update public.shared_products as product
set food = product.food || jsonb_build_object(
	'sourceKey', source.key,
	'sourceLabel', source.display_name,
	'sourceDataType', coalesce(product.food ->> 'sourceDataType', 'Branded')
)
from public.product_data_sources as source
where
	product.source = 'usda'
	and source.key = 'usda';

update public.custom_foods as custom_food
set food = custom_food.food || jsonb_build_object(
	'sourceKey', source.key,
	'sourceLabel', source.display_name,
	'sourceDataType', coalesce(custom_food.food ->> 'sourceDataType', 'Branded')
)
from public.product_data_sources as source
where
	custom_food.food ->> 'barcodeSource' = 'usda'
	and custom_food.category_option_id is not null
	and source.key = 'usda';
