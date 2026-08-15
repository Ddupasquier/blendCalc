begin;

select plan(50);

select ok(
	(select count(*) from public.food_symbol_definitions where enabled) >= 158,
	'the curated food symbol catalog covers at least 158 specific foods, prepared forms, and broad fallbacks'
);

select ok(
	not exists (
		select 1
		from public.food_symbol_definitions
		where enabled
			and family_key not in (
				'generic', 'beverage', 'sweets', 'oils-fats', 'dairy', 'meat',
				'seafood', 'grains', 'nuts-seeds', 'vegetables', 'fruit', 'legumes',
				'sauces-condiments', 'soup', 'protein-supplement', 'prepared-food',
				'novelty'
			)
	),
	'every enabled fallback belongs to one reviewed symbol family'
);

select ok(
	not exists (
		select 1
		from public.food_symbol_category_rules
		where enabled
			and (
				cardinality(match_scopes) = 0
				or not match_scopes <@ array[
					'prepared_override',
					'category',
					'name_refinement',
					'uncategorized_name'
				]::text[]
			)
	),
	'every enabled symbol rule declares only reviewed resolution scopes'
);

select ok(
	(
		select count(*)
		from public.food_symbol_category_rules
		where enabled
			and match_scopes @> array['category']::text[]
	) >= 20,
	'the category-led policy includes broad reviewed category-family classifiers'
);

select is(
	public.resolve_food_symbol_key_for_category('Fruits and Fruit Juices'),
	'fruit',
	'a reviewed fruit category resolves to the broad fruit family fallback'
);

select is(
	public.resolve_food_symbol_key_for_category('Dairy and Egg Products'),
	'dairy',
	'a mixed dairy category stays broad instead of being guessed as eggs'
);

select is(
	public.resolve_food_symbol_key_for_category('Nut & Seed Butters'),
	'nuts-seeds',
	'category labels containing ampersands normalize to the reviewed category family'
);

select ok(
	not exists (
		select 1
		from (
			values
				('poop'),
				('noodle-soup'),
				('beer'),
				('wine'),
				('spirits'),
				('kombucha'),
				('beef'),
				('pork'),
				('sausage'),
				('shellfish'),
				('salmon'),
				('duck'),
				('lamb'),
				('bread'),
				('pasta'),
				('salad'),
				('pizza'),
				('ice-cream'),
				('banana'),
				('mango'),
				('strawberry'),
				('avocado'),
				('tomato'),
				('spinach'),
				('potato'),
				('mushrooms')
		) expected(key)
		where not exists (
			select 1
			from public.food_symbol_definitions definition
			where definition.key = expected.key
				and definition.enabled
				and btrim(definition.emoji) <> ''
		)
	),
	'every representative specific fallback has an enabled emoji definition'
);

select ok(
	(select count(*) from public.custom_foods) > 0
		and not exists (
			select 1 from public.custom_foods
			where nullif(btrim(food ->> 'symbolKey'), '') is null
		),
	'existing private custom-food snapshots retain a fallback key after backfill'
);
select ok(
	(select count(*) from public.shared_product_submissions) > 0
		and not exists (
			select 1 from public.shared_product_submissions
			where nullif(btrim(food ->> 'symbolKey'), '') is null
		),
	'existing catalog submissions retain a fallback key after backfill'
);
select ok(
	(select count(*) from public.shared_products) > 0
		and not exists (
			select 1 from public.shared_products
			where nullif(btrim(food ->> 'symbolKey'), '') is null
		),
	'existing canonical products retain a fallback key after backfill'
);
select ok(
	(select count(*) from public.shared_product_revisions) > 0
		and not exists (
			select 1 from public.shared_product_revisions
			where nullif(btrim(food ->> 'symbolKey'), '') is null
		),
	'existing immutable catalog revisions retain a fallback key after backfill'
);
select ok(
	(select count(*) from public.user_food_list_items) > 0
		and not exists (
			select 1 from public.user_food_list_items
			where nullif(btrim(food ->> 'symbolKey'), '') is null
		),
	'existing Fridge and Shopping snapshots retain a fallback key after backfill'
);
select is(
	(
		select food ->> 'symbolKey'
		from public.shared_products
		where barcode = '00016459200441'
	),
	'nuts-seeds',
	'a pre-existing canonical banana respects its reviewed Nut and Seed Butters category family'
);
select is(
	(
		select food ->> 'symbolKey'
		from public.shared_products
		where barcode = '00609207617761'
	),
	'packaged',
	'a pre-existing canonical banana respects its reviewed Snacks category family'
);
select ok(
	exists (
		select 1
		from public.user_food_list_items
		where food ->> 'barcode' = '00016459200441'
	)
	and not exists (
		select 1
		from public.user_food_list_items
		where food ->> 'barcode' = '00016459200441'
			and food ->> 'symbolKey' is distinct from 'nuts-seeds'
	),
	'all pre-existing user-list copies respect the reviewed Nut and Seed Butters category family'
);
select ok(
	exists (
		select 1
		from public.user_food_list_items
		where food ->> 'barcode' = '00609207617761'
	)
	and not exists (
		select 1
		from public.user_food_list_items
		where food ->> 'barcode' = '00609207617761'
			and food ->> 'symbolKey' is distinct from 'packaged'
	),
	'all pre-existing user-list copies respect the reviewed Snacks category family'
);

create temporary table expected_food_symbol_resolution (
	food_name text primary key,
	expected_symbol_key text not null
) on commit drop;

insert into expected_food_symbol_resolution (food_name, expected_symbol_key)
values
	('Tomato basil salad', 'salad'),
	('Turkey club sandwich', 'sandwich'),
	('Beef and cheddar burger', 'burger'),
	('Sausage pizza', 'pizza'),
	('Chicken tacos', 'taco'),
	('Black bean burrito', 'burrito-wrap'),
	('Chicken curry', 'curry'),
	('Vegetable stir-fry', 'stir-fry'),
	('Salmon sushi', 'sushi'),
	('Potato french fries', 'french-fries'),
	('Blueberry pancakes', 'pancakes'),
	('Belgian waffle', 'waffles'),
	('Whole wheat bagel', 'bagel'),
	('Butter croissant', 'croissant'),
	('Soft pretzel', 'pretzel'),
	('Glazed donut', 'doughnut'),
	('Chocolate cake', 'cake'),
	('Oatmeal cookies', 'cookie'),
	('Ready-to-eat cereal', 'cereal'),
	('Sea salt popcorn', 'popcorn'),
	('Beer bread', 'bread'),
	('Chicken pasta', 'pasta'),
	('Pork dumplings', 'dumpling'),
	('Apple pie', 'pie'),
	('Scrambled eggs', 'eggs'),
	('Tortilla chips', 'chips'),
	('Ahi salmon poke bowl', 'food-bowl'),
	('Green bean casserole', 'casserole'),
	('Cheese quesadilla', 'quesadilla'),
	('Vanilla pudding', 'pudding'),
	('Classic hummus', 'hummus'),
	('Honey granola', 'granola'),
	('Steel-cut oatmeal', 'porridge'),
	('Pure maple syrup', 'maple-syrup'),
	('Chocolate milk', 'milk'),
	('Hot chocolate beverage', 'coffee-tea'),
	('Sriracha hot sauce', 'hot-sauce'),
	('Vanilla ice cream', 'ice-cream'),
	('Sparkling mineral water', 'water'),
	('Orange juice', 'juice'),
	('Cola soft drink', 'soda'),
	('Mango smoothie', 'smoothie'),
	('Cabernet sparkling wine', 'sparkling-wine'),
	('India pale ale beer', 'beer'),
	('Small batch bourbon whiskey', 'spirits'),
	('Mojito cocktail', 'cocktail'),
	('Apple cider', 'cider'),
	('Ginger kombucha', 'kombucha'),
	('Junmai sake', 'sake'),
	('Espresso coffee', 'coffee'),
	('Green tea', 'tea'),
	('Greek yogurt', 'yogurt'),
	('Cheddar cheese', 'cheese'),
	('Pork bacon', 'bacon'),
	('Beef sausage', 'sausage'),
	('Italian meatballs', 'meatballs'),
	('Ribeye beef steak', 'beef'),
	('Smoked ham', 'ham'),
	('Pork loin', 'pork'),
	('Chicken breast', 'chicken'),
	('Turkey breast', 'turkey'),
	('Roasted duck', 'duck'),
	('Lamb chop', 'lamb'),
	('Goat meat', 'goat'),
	('Venison roast', 'venison'),
	('Crabmeat', 'crab'),
	('Lobster tail', 'lobster'),
	('Raw shrimp', 'shrimp'),
	('Atlantic salmon', 'salmon'),
	('Canned tuna', 'tuna'),
	('Brown rice', 'rice'),
	('Roasted peanuts', 'peanuts'),
	('Sunflower seeds', 'seeds'),
	('Pear, raw', 'pear'),
	('Banana, raw', 'banana'),
	('Red grapes', 'grapes'),
	('Watermelon, raw', 'watermelon'),
	('Mango, raw', 'mango'),
	('Pineapple chunks', 'pineapple'),
	('Sweet cherries', 'cherries'),
	('Fresh peach', 'peach'),
	('Avocado, raw', 'avocado'),
	('Coconut, raw', 'coconut'),
	('Fresh strawberries', 'strawberry'),
	('Fresh blueberries', 'blueberry'),
	('Fresh raspberries', 'raspberries'),
	('Lemon, raw', 'lemon'),
	('Orange, raw', 'orange'),
	('Lime, raw', 'lime'),
	('Kiwifruit, raw', 'kiwi'),
	('Roma tomato', 'tomato'),
	('Sweet corn', 'corn'),
	('Jalapeño chili pepper', 'chili-pepper'),
	('Red bell pepper', 'bell-pepper'),
	('Shiitake mushrooms', 'mushrooms'),
	('Fresh garlic', 'garlic'),
	('Yellow onion', 'onion'),
	('Sweet potato', 'sweet-potato'),
	('Russet potato', 'potato'),
	('Broccoli florets', 'broccoli'),
	('Cauliflower florets', 'cauliflower'),
	('Green cabbage', 'cabbage'),
	('Cucumber, raw', 'cucumber'),
	('Pumpkin puree', 'pumpkin'),
	('Zucchini, raw', 'zucchini'),
	('Romaine lettuce', 'lettuce'),
	('Baby spinach', 'spinach'),
	('Kale, raw', 'kale'),
	('Carrot, raw', 'carrot'),
	('Eggplant, raw', 'eggplant'),
	('Red lentils', 'lentils'),
	('Cooked chickpeas', 'chickpeas'),
	('Green peas', 'peas'),
	('Black beans', 'beans'),
	('Green olives', 'olives'),
	('Table salt', 'salt'),
	('Fresh basil herb', 'herbs-spices');

select is(
	(
		select count(*)
		from expected_food_symbol_resolution expected
		where public.resolve_food_symbol_key(expected.food_name)
			is distinct from expected.expected_symbol_key
	),
	0::bigint,
	'the representative 117-food corpus resolves every prepared form and ingredient to its expected fallback'
);

select is(public.resolve_food_symbol_key('Cabernet Sauvignon wine'), 'wine', 'wine resolves specifically');
select is(public.resolve_food_symbol_key('Craft lager beer'), 'beer', 'beer resolves specifically');
select is(public.resolve_food_symbol_key('Small batch whiskey'), 'spirits', 'spirits resolve specifically');
select is(public.resolve_food_symbol_key('Ginger kombucha'), 'kombucha', 'kombucha resolves specifically');
select is(public.resolve_food_symbol_key('Chicken noodle soup'), 'noodle-soup', 'noodle soup beats broad soup and poultry');
select is(public.resolve_food_symbol_key('Pork chorizo'), 'sausage', 'sausage form beats its meat species');
select is(public.resolve_food_symbol_key('Beef ribeye steak'), 'beef', 'beef resolves specifically');
select is(public.resolve_food_symbol_key('Shrimp, canned'), 'shrimp', 'shrimp resolves separately from broad shellfish and fish');
select is(public.resolve_food_symbol_key('Banana, raw'), 'banana', 'banana resolves specifically');
select is(public.resolve_food_symbol_key('Avocado, raw'), 'avocado', 'avocado resolves specifically');
select is(public.resolve_food_symbol_key('Tomatoes, roma'), 'tomato', 'tomato resolves specifically');
select is(public.resolve_food_symbol_key('Corn, sweet, yellow'), 'corn', 'corn resolves specifically');
select is(public.resolve_food_symbol_key('Shiitake mushrooms'), 'mushrooms', 'shiitake resolves as mushrooms');
select is(public.resolve_food_symbol_key('Cacao powder'), 'generic', 'cacao never matches the caca novelty synonym');
select is(public.resolve_food_symbol_key('Root beer'), 'beverage', 'root beer does not masquerade as alcoholic beer');
select is(public.resolve_food_symbol_key('Red wine vinegar'), 'sauces-condiments', 'vinegar form beats wine');
select is(public.resolve_food_symbol_key('Oil, apricot kernel'), 'oils-fats', 'oil form beats the fruit name');
select is(public.resolve_food_symbol_key('Spinach, boiled'), 'spinach', 'boiled does not masquerade as oil');
select is(public.resolve_food_symbol_key('Goat meat'), 'goat', 'goat does not masquerade as oats');
select is(public.resolve_food_symbol_key('Coconut, raw'), 'coconut', 'coconut does not collapse into the broad nut rule');
select is(public.resolve_food_symbol_key('Pork adipose tissue'), 'pork', 'adipose does not masquerade as dip');
select is(public.resolve_food_symbol_key('Poop'), 'poop', 'poop resolves to the novelty symbol');
select is(public.resolve_food_symbol_key('shit'), 'poop', 'shit resolves to the novelty symbol');
select is(public.resolve_food_symbol_key('caca'), 'poop', 'caca resolves to the novelty symbol');
select is(public.resolve_food_symbol_key('a tiny turd'), 'poop', 'another whole-word synonym resolves to the novelty symbol');
select is(
	public.resolve_food_symbol_key_for_food(
		jsonb_build_object(
			'description', 'Banana, raw',
			'foodCategory', 'Fruits and Fruit Juices'
		)
	),
	'banana',
	'the durable food resolver refines a broad category within the same family'
);
select is(
	public.resolve_food_symbol_key_for_food(
		jsonb_build_object(
			'description', 'Tuna steak',
			'foodCategory', 'Finfish and Shellfish Products'
		)
	),
	'tuna',
	'tuna steak stays in the reviewed seafood family instead of becoming beef'
);
select is(
	public.resolve_food_symbol_key_for_food(
		jsonb_build_object(
			'description', 'Tuna steak',
			'foodCategory', 'Meat Products'
		)
	),
	'beef',
	'a reviewed meat category permits the steak refinement while blocking tuna'
);
select is(
	public.resolve_food_symbol_key_for_food(
		jsonb_build_object(
			'description', 'Tuna sandwich',
			'foodCategory', 'Finfish and Shellfish Products'
		)
	),
	'sandwich',
	'a recognizable prepared sandwich overrides the ingredient family'
);
select is(
	public.resolve_food_symbol_key_for_food(
		jsonb_build_object('description', 'Tuna steak')
	),
	'tuna',
	'a missing category uses the bounded reviewed name fallback'
);
select is(
	public.resolve_food_symbol_key_for_food(
		jsonb_build_object(
			'symbolKey', 'beef',
			'description', 'Tuna',
			'foodCategory', 'Finfish and Shellfish Products'
		)
	),
	'tuna',
	'a stale cross-family stored key cannot override current category-led resolution'
);
select is(
	public.resolve_food_symbol_key_for_food(
		jsonb_build_object(
			'description', 'Unknown sample',
			'foodCategory', 'Unknown category'
		)
	),
	'generic',
	'unknown food data remains an honest generic fallback'
);

select * from finish();

rollback;
