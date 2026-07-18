create temporary table source_product_name_backfill (
	old_name text primary key,
	new_name text not null
) on commit drop;

insert into source_product_name_backfill (old_name, new_name)
values
	('UNREFINED COLD PRESSED VIRGIN COCONUT OIL', 'Unrefined Cold Pressed Virgin Coconut Oil'),
	('STRAWBERRY JELLY, STRAWBERRY', 'Strawberry Jelly, Strawberry'),
	('ROASTED ONION & GARLIC PASTA SAUCE, ROASTED ONION & GARLIC', 'Roasted Onion & Garlic Pasta Sauce, Roasted Onion & Garlic'),
	('Peanut Butter Spread with Honey', 'Peanut Butter Spread With Honey'),
	('Greek Yogurt Honey Made with Whole Milk', 'Greek Yogurt Honey Made With Whole Milk'),
	('Blue agave light golden syrup', 'Blue Agave Light Golden Syrup'),
	('Mustard greens, raw', 'Mustard Greens, Raw');

update public.shared_products product
set
	product_name = name_map.new_name,
	food = jsonb_set(
		jsonb_set(product.food, '{description}', to_jsonb(name_map.new_name), true),
		'{nameProvenance}',
		'"source"'::jsonb,
		true
	)
from source_product_name_backfill name_map
where product.product_name = name_map.old_name
	and product.source in ('open-food-facts', 'shared-catalog', 'usda')
	and product.food ->> 'nameProvenance' is distinct from 'user';

alter table public.custom_foods disable trigger prepare_custom_food_record;

update public.custom_foods custom_food
set
	name_key = lower(regexp_replace(name_map.new_name, '\s+', ' ', 'g')),
	food = jsonb_set(
		jsonb_set(custom_food.food, '{description}', to_jsonb(name_map.new_name), true),
		'{nameProvenance}',
		'"source"'::jsonb,
		true
	)
from source_product_name_backfill name_map
where custom_food.food ->> 'description' = name_map.old_name
	and coalesce(
		custom_food.food ->> 'sourceKey',
		custom_food.food ->> 'barcodeSource',
		''
	) in ('open-food-facts', 'shared-catalog', 'usda')
	and custom_food.food ->> 'nameProvenance' is distinct from 'user';

alter table public.custom_foods enable trigger prepare_custom_food_record;

update public.user_food_list_items list_item
set food = jsonb_set(
	jsonb_set(list_item.food, '{description}', to_jsonb(name_map.new_name), true),
	'{nameProvenance}',
	'"source"'::jsonb,
	true
)
from source_product_name_backfill name_map
where list_item.food ->> 'description' = name_map.old_name
	and coalesce(
		list_item.food ->> 'sourceKey',
		list_item.food ->> 'barcodeSource',
		''
	) in ('open-food-facts', 'shared-catalog', 'usda')
	and list_item.food ->> 'nameProvenance' is distinct from 'user';
