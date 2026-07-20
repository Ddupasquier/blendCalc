alter table public.food_symbol_definitions
	add column if not exists emoji text;

update public.food_symbol_definitions
set emoji = case key
	when 'protein-powder' then '💪'
	when 'beverage' then '🥤'
	when 'sweets' then '🍬'
	when 'oils-fats' then '🧈'
	when 'dairy' then '🥛'
	when 'meat' then '🥩'
	when 'seafood' then '🐟'
	when 'grains' then '🌾'
	when 'nuts-seeds' then '🌰'
	when 'vegetables' then '🥦'
	when 'fruit' then '🍓'
	when 'packaged' then '📦'
	when 'generic' then '🥣'
	when 'berries' then '🫐'
	when 'citrus' then '🍊'
	when 'leafy-greens' then '🥬'
	when 'root-vegetables' then '🥕'
	when 'eggs' then '🥚'
	when 'poultry' then '🍗'
	when 'bread-bakery' then '🍞'
	when 'pasta-noodles' then '🍝'
	when 'legumes' then '🫘'
	when 'coffee-tea' then '☕'
	when 'frozen-dessert' then '🍨'
	when 'spreads-preserves' then '🍯'
	when 'sauces-condiments' then '🌶️'
	when 'soup' then '🍲'
	when 'protein-bar' then '🍫'
	else emoji
end,
	updated_at = now();

alter table public.food_symbol_definitions
	drop constraint if exists food_symbol_definitions_emoji_check;

alter table public.food_symbol_definitions
	add constraint food_symbol_definitions_emoji_check
	check (btrim(emoji) <> '');

alter table public.food_symbol_definitions
	alter column emoji set not null;

comment on column public.food_symbol_definitions.emoji is
	'The reusable category-aware emoji shown when no approved or source-backed product image exists.';

comment on table public.food_symbol_definitions is
	'DB-owned reusable food-category fallback symbols used only when no product image is available.';
