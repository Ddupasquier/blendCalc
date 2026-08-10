insert into public.food_symbol_definitions (key, display_name, sort_order)
values
	('berries', 'Berries', 140),
	('citrus', 'Citrus', 150),
	('leafy-greens', 'Leafy greens', 160),
	('root-vegetables', 'Root vegetables', 170),
	('eggs', 'Eggs', 180),
	('poultry', 'Poultry', 190),
	('bread-bakery', 'Bread and bakery', 200),
	('pasta-noodles', 'Pasta and noodles', 210),
	('legumes', 'Legumes', 220),
	('coffee-tea', 'Coffee and tea', 230),
	('frozen-dessert', 'Frozen desserts', 240),
	('spreads-preserves', 'Spreads and preserves', 250),
	('sauces-condiments', 'Sauces and condiments', 260),
	('soup', 'Soup and stew', 270),
	('protein-bar', 'Protein and nutrition bars', 280)
on conflict (key) do update set
	display_name = excluded.display_name,
	sort_order = excluded.sort_order,
	enabled = true,
	updated_at = now();

update public.food_symbol_category_rules
set enabled = false,
	updated_at = now()
where source_key = 'blendcalc-nutrition-policy';

insert into public.food_symbol_category_rules (
	symbol_key,
	match_pattern,
	priority,
	enabled,
	source_key,
	source_reference
)
values
	('protein-bar', '(protein bar|nutrition bar|energy bar|meal replacement bar)', 10, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('protein-powder', '(protein powder|protein supplement|whey|casein|protein isolate|protein concentrate)', 20, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('spreads-preserves', '(jam|jelly|preserve|marmalade|fruit spread|nut butter|seed butter)', 30, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('sauces-condiments', '(sauce|salsa|dip|condiment|ketchup|mustard|dressing|mayonnaise|relish|chutney|pesto)', 40, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('soup', '(soup|stew|broth|chowder|bisque|bouillon)', 50, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('frozen-dessert', '(ice cream|frozen dessert|gelato|sorbet|sherbet|popsicle|frozen yogurt)', 60, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('coffee-tea', '(coffee|tea|cocoa beverage|hot chocolate)', 70, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('beverage', '(beverage|drink|water|juice|soda|nectar|smoothie)', 80, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('eggs', '(^|[^a-z])(egg|eggs)([^a-z]|$)', 90, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('dairy', '(dairy|milk|yogurt|cheese|cream|buttermilk|whey beverage)', 100, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('poultry', '(poultry|chicken|turkey|duck|goose)', 110, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('meat', '(meat|beef|pork|lamb|veal|venison|sausage|game product)', 120, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('seafood', '(fish|seafood|shellfish|shrimp|salmon|tuna|crab|lobster|mollusk|crustacean)', 130, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('bread-bakery', '(bread|bakery|bun|roll|tortilla|bagel|cracker|biscuit|waffle|pancake)', 140, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('pasta-noodles', '(pasta|noodle|macaroni|spaghetti|ravioli|lasagna|pizza|dumpling)', 150, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('grains', '(grain|cereal|wheat|oat|rice|flour|quinoa|barley|rye|cornmeal)', 160, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('legumes', '(legume|bean|lentil|chickpea|pea product|soy product|tofu|tempeh)', 170, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('nuts-seeds', '(nut|seed|almond|peanut|cashew|chia|walnut|pecan|pistachio|hazelnut)', 180, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('leafy-greens', '(leafy green|spinach|kale|lettuce|collard|cabbage|chard|mustard green)', 190, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('root-vegetables', '(root vegetable|carrot|potato|yam|sweet potato|beet|turnip|parsnip|onion|garlic)', 200, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('vegetables', '(vegetable|broccoli|tomato|pepper|corn|mushroom|squash|cucumber|cauliflower)', 210, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('berries', '(berry|berries|strawberry|blueberry|raspberry|blackberry|cranberry)', 220, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('citrus', '(citrus|orange|lemon|lime|grapefruit|tangerine|mandarin)', 230, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('fruit', '(fruit|apple|banana|mango|grape|peach|pineapple|melon|kiwi|pear|plum|cherry)', 240, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('sweets', '(sweet|candy|chocolate|sugar|syrup|dessert|cookie|cake|pastry|confection)', 250, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('oils-fats', '(oil|fat|butter|margarine|shortening|lard|ghee)', 260, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2'),
	('packaged', '(branded|packaged|prepared|snack|chip|crisp|ready to eat|meal)', 270, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v2')
on conflict (symbol_key, match_pattern) do update set
	priority = excluded.priority,
	enabled = excluded.enabled,
	source_key = excluded.source_key,
	source_reference = excluded.source_reference,
	updated_at = now();

update public.custom_food_category_options
set symbol_key = public.resolve_food_symbol_key(normalized_value),
	updated_at = now();

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

comment on table public.food_symbol_definitions is
	'A modest reusable catalog of illustrated food-category fallbacks used only when no product image is available.';

comment on table public.food_symbol_category_rules is
	'DB-owned category-to-symbol policy. Specific food groups take priority over broad packaged-food fallbacks.';
