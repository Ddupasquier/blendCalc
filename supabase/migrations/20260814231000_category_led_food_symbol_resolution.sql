alter table public.food_symbol_definitions
	add column if not exists family_key text not null default 'generic';

update public.food_symbol_definitions
set
	family_key = case
		when key in (
			'beverage', 'alcoholic-beverage', 'beer', 'wine', 'sparkling-wine',
			'spirits', 'cocktail', 'cider', 'kombucha', 'water', 'juice', 'soda',
			'smoothie', 'coffee', 'tea', 'coffee-tea', 'sake'
		) then 'beverage'
		when key in (
			'sweets', 'frozen-dessert', 'spreads-preserves', 'chocolate', 'honey',
			'cake', 'cookie', 'doughnut', 'pudding', 'pie', 'ice-cream', 'maple-syrup'
		) then 'sweets'
		when key = 'oils-fats' then 'oils-fats'
		when key in ('dairy', 'eggs', 'cheese', 'milk', 'yogurt') then 'dairy'
		when key in (
			'meat', 'poultry', 'beef', 'pork', 'bacon', 'sausage', 'lamb-game',
			'chicken', 'turkey', 'ham', 'meatballs', 'duck', 'lamb', 'goat', 'venison'
		) then 'meat'
		when key in ('seafood', 'shellfish', 'crab', 'lobster', 'salmon', 'tuna', 'shrimp')
			then 'seafood'
		when key in (
			'grains', 'bread-bakery', 'pasta-noodles', 'rice', 'bread', 'pasta',
			'cereal', 'popcorn', 'granola', 'porridge', 'bagel', 'croissant',
			'pretzel', 'pancakes', 'waffles'
		) then 'grains'
		when key in ('nuts-seeds', 'peanuts', 'seeds') then 'nuts-seeds'
		when key in (
			'vegetables', 'leafy-greens', 'root-vegetables', 'tomato', 'corn',
			'peppers', 'mushrooms', 'alliums', 'potatoes', 'cruciferous-vegetables',
			'cucumber', 'squash', 'garlic', 'onion', 'potato', 'pumpkin', 'zucchini',
			'cabbage', 'cauliflower', 'spinach', 'kale', 'chili-pepper', 'bell-pepper',
			'carrot', 'eggplant', 'olives'
		) then 'vegetables'
		when key in (
			'fruit', 'berries', 'citrus', 'apple', 'banana', 'grapes', 'melon',
			'tropical-fruit', 'stone-fruit', 'avocado', 'coconut', 'pear', 'cherries',
			'pineapple', 'kiwi', 'lemon', 'strawberry', 'watermelon', 'orange',
			'blueberry', 'mango', 'peach', 'lime', 'raspberries'
		) then 'fruit'
		when key in ('legumes', 'lentils', 'chickpeas', 'beans', 'peas', 'hummus')
			then 'legumes'
		when key in ('sauces-condiments', 'hot-sauce', 'salt', 'herbs-spices')
			then 'sauces-condiments'
		when key in ('soup', 'noodle-soup') then 'soup'
		when key in ('protein-powder', 'protein-bar') then 'protein-supplement'
		when key in (
			'packaged', 'salad', 'sandwich', 'burger', 'pizza', 'taco', 'burrito-wrap',
			'curry', 'stir-fry', 'sushi', 'french-fries', 'chips', 'food-bowl',
			'casserole', 'quesadilla', 'dumpling'
		) then 'prepared-food'
		when key = 'poop' then 'novelty'
		else 'generic'
	end,
	updated_at = now();

alter table public.food_symbol_definitions
	drop constraint if exists food_symbol_definitions_family_key_check;
alter table public.food_symbol_definitions
	add constraint food_symbol_definitions_family_key_check check (
		family_key in (
			'generic', 'beverage', 'sweets', 'oils-fats', 'dairy', 'meat',
			'seafood', 'grains', 'nuts-seeds', 'vegetables', 'fruit', 'legumes',
			'sauces-condiments', 'soup', 'protein-supplement', 'prepared-food',
			'novelty'
		)
	);

alter table public.food_symbol_category_rules
	add column if not exists match_scopes text[] not null default array[
		'name_refinement',
		'uncategorized_name'
	]::text[];

alter table public.food_symbol_category_rules
	drop constraint if exists food_symbol_category_rules_match_scopes_check;
alter table public.food_symbol_category_rules
	add constraint food_symbol_category_rules_match_scopes_check check (
		cardinality(match_scopes) > 0
		and match_scopes <@ array[
			'prepared_override',
			'category',
			'name_refinement',
			'uncategorized_name'
		]::text[]
	);

update public.food_symbol_category_rules
set
	match_scopes = array['name_refinement', 'uncategorized_name']::text[],
	updated_at = now();

update public.food_symbol_category_rules
set
	match_scopes = array[
		'prepared_override',
		'name_refinement',
		'uncategorized_name'
	]::text[],
	updated_at = now()
where enabled
	and (
		symbol_key in (
			'salad', 'sandwich', 'burger', 'pizza', 'taco', 'burrito-wrap', 'curry',
			'stir-fry', 'sushi', 'french-fries', 'chips', 'food-bowl', 'casserole',
			'quesadilla', 'pudding', 'pancakes', 'waffles', 'bagel', 'croissant',
			'pretzel', 'doughnut', 'cake', 'cookie', 'cereal', 'popcorn', 'bread',
			'pasta', 'dumpling', 'pie', 'granola', 'porridge', 'noodle-soup',
			'protein-bar', 'protein-powder', 'hummus', 'spreads-preserves',
			'maple-syrup', 'coffee-tea', 'hot-sauce', 'sauces-condiments', 'soup',
			'ice-cream', 'frozen-dessert', 'smoothie', 'sparkling-wine', 'beer',
			'wine', 'spirits', 'cocktail', 'cider', 'kombucha', 'sake',
			'alcoholic-beverage'
		)
		or (symbol_key = 'nuts-seeds' and priority = 35)
		or (symbol_key = 'milk' and priority = 44)
		or (symbol_key = 'fruit' and priority = 75)
		or (symbol_key = 'shellfish' and priority = 76)
		or (symbol_key = 'beverage' and priority = 77)
		or (symbol_key = 'seafood' and priority = 78)
		or (symbol_key = 'eggs' and priority = 6)
	);

insert into public.food_symbol_category_rules (
	symbol_key,
	match_pattern,
	priority,
	enabled,
	source_key,
	source_reference,
	match_scopes
)
values
	('protein-powder', '(^|[^a-z])(protein powder|protein powders)([^a-z]|$)', 10000, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('protein-bar', '(^|[^a-z])(protein bar|protein bars|nutrition bar|nutrition bars)([^a-z]|$)', 10010, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('alcoholic-beverage', '(^|[^a-z])(alcoholic beverage|alcoholic beverages|alcoholic drinks)([^a-z]|$)', 10020, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('eggs', '^egg products?$', 10030, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('beef', '(^|[^a-z])(beef product|beef products)([^a-z]|$)', 10040, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('pork', '(^|[^a-z])(pork product|pork products|porcine products)([^a-z]|$)', 10050, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('poultry', '(^|[^a-z])(poultry product|poultry products)([^a-z]|$)', 10060, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('seafood', '(^|[^a-z])(finfish and shellfish products|fish and seafood|seafood products|finfish products|shellfish products)([^a-z]|$)', 10070, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('bread-bakery', '(^|[^a-z])(baked products|bakery products|bread and bakery products)([^a-z]|$)', 10080, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('pasta-noodles', '(^|[^a-z])(pasta and noodle products|pasta products|noodle products)([^a-z]|$)', 10090, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('spreads-preserves', '(^|[^a-z])(jams and preserves|jams|preserves|fruit spreads)([^a-z]|$)', 10100, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('sauces-condiments', '(^|[^a-z])(dips and salsa|sauces and condiments|mustard and other condiments|pickles olives peppers and relishes)([^a-z]|$)', 10110, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('soup', '(^|[^a-z])(soups sauces and gravies|soups and stews|soup products)([^a-z]|$)', 10120, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('frozen-dessert', '(^|[^a-z])(frozen desserts|ice cream and frozen desserts)([^a-z]|$)', 10130, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('nuts-seeds', '(^|[^a-z])(nut and seed products|nuts and seeds|nut and seed butters)([^a-z]|$)', 10140, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('legumes', '(^|[^a-z])(legumes and legume products|legume products|beans and legumes)([^a-z]|$)', 10150, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('leafy-greens', '(^|[^a-z])(leaf vegetables|leafy greens|leaf vegetables and vegetable products)([^a-z]|$)', 10160, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('root-vegetables', '(^|[^a-z])(root vegetables|root vegetable products)([^a-z]|$)', 10170, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('fruit', '(^|[^a-z])(fruits and fruit juices|fruit products|fruits)([^a-z]|$)', 10200, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('vegetables', '(^|[^a-z])(vegetables and vegetable products|vegetable products|vegetables)([^a-z]|$)', 10210, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('dairy', '(^|[^a-z])(dairy and egg products|dairy products|milk and dairy products)([^a-z]|$)', 10220, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('meat', '(^|[^a-z])(meat products|animal products|sausages hotdogs and brats)([^a-z]|$)', 10230, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('grains', '(^|[^a-z])(cereal grains and pasta|grain products|cereal and grain products)([^a-z]|$)', 10240, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('oils-fats', '(^|[^a-z])(fats and oils|oils and fats|fat products)([^a-z]|$)', 10250, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('sweets', '(^|[^a-z])(sweets|desserts|candy and confections|sugars and sweets)([^a-z]|$)', 10260, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('beverage', '(^|[^a-z])(beverages|beverage products|drinks)([^a-z]|$)', 10270, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[]),
	('packaged', '(^|[^a-z])(meals entrees and side dishes|prepared meals|fast foods|snacks)([^a-z]|$)', 10280, true, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v4 category family', array['category']::text[])
on conflict (symbol_key, match_pattern) do update set
	priority = excluded.priority,
	enabled = excluded.enabled,
	source_key = excluded.source_key,
	source_reference = excluded.source_reference,
	match_scopes = excluded.match_scopes,
	updated_at = now();

create or replace function public.resolve_food_symbol_key(category_value text)
returns text
language sql
stable
set search_path = ''
as $$
	select coalesce(
		(
			select rule.symbol_key
			from public.food_symbol_category_rules rule
			where rule.enabled
				and rule.match_scopes && array[
					'prepared_override',
					'uncategorized_name'
				]::text[]
				and regexp_replace(
					replace(lower(coalesce(category_value, '')), '&', ' and '),
					'\s+',
					' ',
					'g'
				) ~ rule.match_pattern
			order by rule.priority, rule.id
			limit 1
		),
		'generic'
	);
$$;

create or replace function public.resolve_food_symbol_key_for_category(category_value text)
returns text
language sql
stable
set search_path = ''
as $$
	select coalesce(
		(
			select rule.symbol_key
			from public.food_symbol_category_rules rule
			where rule.enabled
				and rule.match_scopes @> array['category']::text[]
				and regexp_replace(
					replace(lower(coalesce(category_value, '')), '&', ' and '),
					'\s+',
					' ',
					'g'
				) ~ rule.match_pattern
			order by rule.priority, rule.id
			limit 1
		),
		'generic'
	);
$$;

create or replace function public.set_food_category_symbol_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.symbol_key := public.resolve_food_symbol_key_for_category(new.normalized_value);
	return new;
end;
$$;

create or replace function public.resolve_food_symbol_key_for_food(
	p_food jsonb,
	p_category_option_id text default null
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
	v_category_family_key text;
	v_category_option_id text;
	v_category_symbol_key text;
	v_category_text text;
	v_name text;
	v_symbol_key text;
begin
	v_name := pg_catalog.concat_ws(
		' ',
		nullif(btrim(p_food ->> 'canonicalDescription'), ''),
		nullif(btrim(p_food ->> 'description'), '')
	);
	v_category_option_id := coalesce(
		nullif(btrim(p_category_option_id), ''),
		nullif(btrim(p_food ->> 'categoryOptionId'), '')
	);

	select coalesce(
		nullif(btrim(category.normalized_value), ''),
		pg_catalog.concat_ws(
			' ',
			nullif(btrim(p_food ->> 'foodCategory'), ''),
			nullif(btrim(p_food ->> 'brandedFoodCategory'), ''),
			(
				select string_agg(category_item.value, ' ')
				from jsonb_array_elements_text(
					case
						when jsonb_typeof(p_food -> 'categories') = 'array'
							then p_food -> 'categories'
						else '[]'::jsonb
					end
				) category_item(value)
			)
		)
	)
	into v_category_text
	from (select 1) seed
	left join public.custom_food_category_options category
		on category.id = v_category_option_id
		and category.enabled;
	v_category_text := regexp_replace(
		replace(v_category_text, '&', ' and '),
		'\s+',
		' ',
		'g'
	);

	select rule.symbol_key
	into v_symbol_key
	from public.food_symbol_category_rules rule
	where rule.enabled
		and rule.match_scopes @> array['prepared_override']::text[]
		and lower(coalesce(v_name, '')) ~ rule.match_pattern
	order by rule.priority, rule.id
	limit 1;
	if v_symbol_key is not null then
		return v_symbol_key;
	end if;

	select rule.symbol_key, definition.family_key
	into v_category_symbol_key, v_category_family_key
	from public.food_symbol_category_rules rule
	join public.food_symbol_definitions definition
		on definition.key = rule.symbol_key
		and definition.enabled
	where rule.enabled
		and rule.match_scopes @> array['category']::text[]
		and lower(coalesce(v_category_text, '')) ~ rule.match_pattern
	order by rule.priority, rule.id
	limit 1;

	if v_category_symbol_key is not null then
		select rule.symbol_key
		into v_symbol_key
		from public.food_symbol_category_rules rule
		join public.food_symbol_definitions definition
			on definition.key = rule.symbol_key
			and definition.enabled
		where rule.enabled
			and rule.match_scopes @> array['name_refinement']::text[]
			and definition.family_key = v_category_family_key
			and lower(coalesce(v_name, '')) ~ rule.match_pattern
		order by rule.priority, rule.id
		limit 1;

		return coalesce(v_symbol_key, v_category_symbol_key);
	end if;

	select rule.symbol_key
	into v_symbol_key
	from public.food_symbol_category_rules rule
	where rule.enabled
		and rule.match_scopes @> array['uncategorized_name']::text[]
		and lower(coalesce(v_name, '')) ~ rule.match_pattern
	order by rule.priority, rule.id
	limit 1;
	if v_symbol_key is not null then
		return v_symbol_key;
	end if;

	v_symbol_key := nullif(btrim(p_food ->> 'symbolKey'), '');
	if v_symbol_key is not null and exists (
		select 1
		from public.food_symbol_definitions definition
		where definition.key = v_symbol_key
			and definition.enabled
	) then
		return v_symbol_key;
	end if;

	return 'generic';
end;
$$;

update public.custom_food_category_options
set
	symbol_key = public.resolve_food_symbol_key_for_category(normalized_value),
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

revoke all on function public.resolve_food_symbol_key_for_category(text)
	from public, anon, authenticated;
grant execute on function public.resolve_food_symbol_key_for_category(text)
	to authenticated, service_role;

comment on column public.food_symbol_definitions.family_key is
	'The broad reviewed family that bounds name refinement after a trusted category match.';
comment on column public.food_symbol_category_rules.match_scopes is
	'Declares whether a reviewed rule is a prepared-form override, category classifier, within-family name refinement, or uncategorized-name fallback.';
comment on function public.resolve_food_symbol_key(text) is
	'Compatibility resolver for uncategorized food names. New durable food resolution uses resolve_food_symbol_key_for_food.';
comment on function public.resolve_food_symbol_key_for_category(text) is
	'Resolves a reviewed category to its bounded fallback symbol and family.';
comment on function public.resolve_food_symbol_key_for_food(jsonb, text) is
	'Resolves prepared forms first, then constrains name refinement to the reviewed category family, and uses bounded name rules only when no reviewed category matches.';
comment on table public.food_symbol_definitions is
	'DB-owned reusable emoji fallbacks with reviewed family membership for category-led resolution when no approved product image is available.';
comment on table public.food_symbol_category_rules is
	'DB-owned scoped patterns for prepared-form overrides, category families, within-family name refinement, and bounded uncategorized fallback.';
