create table public.food_symbol_category_rules (
	id bigint generated always as identity primary key,
	symbol_key text not null references public.food_symbol_definitions(key) on delete restrict,
	match_pattern text not null check (btrim(match_pattern) <> ''),
	priority integer not null check (priority >= 0),
	enabled boolean not null default true,
	source_key text not null references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (symbol_key, match_pattern)
);

create trigger set_food_symbol_category_rules_updated_at
	before update on public.food_symbol_category_rules
	for each row execute function public.set_updated_at();

insert into public.food_symbol_category_rules (
	symbol_key,
	match_pattern,
	priority,
	source_key,
	source_reference
)
values
	('protein-powder', '(protein powder|whey|casein|protein isolate|protein concentrate)', 10, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v1'),
	('beverage', '(beverage|drink|water|juice|soda|coffee|tea|nectar)', 20, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v1'),
	('sweets', '(sweet|candy|chocolate|sugar|syrup|jelly|jam|dessert|cookie|cake)', 30, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v1'),
	('oils-fats', '(oil|fat|butter|margarine|shortening)', 40, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v1'),
	('dairy', '(dairy|milk|yogurt|cheese|cream|egg)', 50, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v1'),
	('meat', '(meat|beef|pork|chicken|poultry|turkey|lamb|sausage)', 60, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v1'),
	('seafood', '(fish|seafood|shellfish|shrimp|salmon|tuna|crab|crustacean)', 70, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v1'),
	('grains', '(grain|cereal|wheat|oat|rice|pasta|bread|flour)', 80, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v1'),
	('nuts-seeds', '(nut|seed|almond|peanut|cashew|chia|walnut|legume)', 90, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v1'),
	('vegetables', '(vegetable|spinach|kale|broccoli|tomato|carrot|lettuce|greens)', 100, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v1'),
	('fruit', '(fruit|berr|apple|banana|mango|grape|citrus|peach|pineapple|melon|kiwi)', 110, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v1'),
	('packaged', '(branded|packaged|prepared|sauce|soup|condiment)', 120, 'blendcalc-nutrition-policy', 'blendCalc food symbol policy v1')
on conflict (symbol_key, match_pattern) do update set
	priority = excluded.priority,
	enabled = true,
	source_key = excluded.source_key,
	source_reference = excluded.source_reference,
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
				and lower(coalesce(category_value, '')) ~ rule.match_pattern
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
	new.symbol_key := public.resolve_food_symbol_key(new.normalized_value);
	return new;
end;
$$;

drop trigger if exists set_custom_food_category_symbol_key
	on public.custom_food_category_options;
create trigger set_custom_food_category_symbol_key
	before insert or update of normalized_value
	on public.custom_food_category_options
	for each row execute function public.set_food_category_symbol_key();

update public.custom_food_category_options
set symbol_key = public.resolve_food_symbol_key(normalized_value),
	updated_at = now();

alter table public.food_symbol_category_rules enable row level security;
alter table public.food_symbol_category_rules force row level security;
create policy "Authenticated users can read food symbol category rules"
	on public.food_symbol_category_rules for select to authenticated using (true);

revoke all on table public.food_symbol_category_rules from public, anon, authenticated;
grant select on table public.food_symbol_category_rules to authenticated;
grant all on table public.food_symbol_category_rules to service_role;
grant execute on function public.resolve_food_symbol_key(text) to authenticated, service_role;
revoke all on function public.set_food_category_symbol_key() from public, anon, authenticated;
grant execute on function public.set_food_category_symbol_key() to service_role;

comment on table public.food_symbol_category_rules is
	'DB-owned, ordered category rules that assign reusable food-symbol keys without client-side keyword guessing.';
