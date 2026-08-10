insert into public.compatibility_tags (slug, label, category)
values
	('dairy', 'Dairy', 'allergen'),
	('milk', 'Milk', 'allergen'),
	('peanut', 'Peanut', 'allergen'),
	('tree-nut', 'Tree Nut', 'allergen'),
	('soy', 'Soy', 'allergen'),
	('egg', 'Egg', 'allergen'),
	('wheat', 'Wheat', 'allergen'),
	('gluten', 'Gluten', 'allergen'),
	('fish', 'Fish', 'allergen'),
	('shellfish', 'Shellfish', 'allergen'),
	('sesame', 'Sesame', 'allergen'),
	('vegan', 'Vegan', 'dietary'),
	('vegetarian', 'Vegetarian', 'dietary'),
	('dairy-free', 'Dairy-free', 'dietary'),
	('gluten-free', 'Gluten-free', 'dietary'),
	('nut-free', 'Nut-free', 'dietary'),
	('soy-free', 'Soy-free', 'dietary'),
	('egg-free', 'Egg-free', 'dietary'),
	('halal', 'Halal', 'dietary'),
	('kosher', 'Kosher', 'dietary')
on conflict (slug) do update
set
	label = excluded.label,
	category = excluded.category,
	updated_at = now();

create table public.food_compatibility_match_rules (
	id uuid primary key default gen_random_uuid(),
	tag_id uuid not null references public.compatibility_tags(id) on delete cascade,
	source_key text,
	field_name text not null
		check (field_name in ('description', 'food_category', 'ingredients')),
	match_pattern text not null check (btrim(match_pattern) <> ''),
	fact_type text not null
		check (fact_type in ('ingredient_present')),
	source_type text not null
		check (source_type in ('label_ingredient_field', 'source_food_identity')),
	confidence text not null
		check (confidence in ('confirmed', 'inferred', 'uncertain')),
	priority integer not null default 100,
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique nulls not distinct (
		tag_id,
		source_key,
		field_name,
		match_pattern,
		fact_type
	)
);

create index food_compatibility_match_rules_lookup_idx
	on public.food_compatibility_match_rules (
		enabled,
		source_key,
		field_name,
		priority
	);

create trigger set_food_compatibility_match_rules_updated_at
	before update on public.food_compatibility_match_rules
	for each row execute function public.set_updated_at();

with rule_values (
	tag_slug,
	source_key,
	field_name,
	match_pattern,
	fact_type,
	source_type,
	confidence,
	priority
) as (
	values
		('milk', null, 'ingredients', '\b(?:milk|whey|casein|caseinate)\b', 'ingredient_present', 'label_ingredient_field', 'confirmed', 10),
		('peanut', null, 'ingredients', '\bpeanuts?\b', 'ingredient_present', 'label_ingredient_field', 'confirmed', 20),
		('tree-nut', null, 'ingredients', '\b(?:almond|cashew|hazelnut|pecan|pistachio|walnut|macadamia|brazil nut|tree nuts?)\b', 'ingredient_present', 'label_ingredient_field', 'confirmed', 30),
		('soy', null, 'ingredients', '\b(?:soy|soya|soybean|soybeans)\b', 'ingredient_present', 'label_ingredient_field', 'confirmed', 40),
		('egg', null, 'ingredients', '\b(?:egg|eggs|albumen)\b', 'ingredient_present', 'label_ingredient_field', 'confirmed', 50),
		('wheat', null, 'ingredients', '\bwheat\b', 'ingredient_present', 'label_ingredient_field', 'confirmed', 60),
		('gluten', null, 'ingredients', '\b(?:gluten|barley|rye|malt)\b', 'ingredient_present', 'label_ingredient_field', 'confirmed', 70),
		('fish', null, 'ingredients', '\b(?:fish|anchovy|cod|salmon|tuna)\b', 'ingredient_present', 'label_ingredient_field', 'confirmed', 80),
		('shellfish', null, 'ingredients', '\b(?:shellfish|shrimp|prawn|crab|lobster|crayfish|crawfish|crustaceans?)\b', 'ingredient_present', 'label_ingredient_field', 'confirmed', 90),
		('sesame', null, 'ingredients', '\b(?:sesame|tahini)\b', 'ingredient_present', 'label_ingredient_field', 'confirmed', 100),
		('shellfish', 'usda', 'description', '\b(?:shellfish|shrimp|prawn|crab|lobster|crayfish|crawfish|crustaceans?)\b', 'ingredient_present', 'source_food_identity', 'confirmed', 110),
		('fish', 'usda', 'description', '\b(?:fish|anchovy|cod|salmon|tuna|trout|haddock|pollock|sardine)\b', 'ingredient_present', 'source_food_identity', 'confirmed', 120)
)
insert into public.food_compatibility_match_rules (
	tag_id,
	source_key,
	field_name,
	match_pattern,
	fact_type,
	source_type,
	confidence,
	priority
)
select
	tag.id,
	rule_values.source_key,
	rule_values.field_name,
	rule_values.match_pattern,
	rule_values.fact_type,
	rule_values.source_type,
	rule_values.confidence,
	rule_values.priority
from rule_values
join public.compatibility_tags tag
	on tag.slug = rule_values.tag_slug
on conflict (
	tag_id,
	source_key,
	field_name,
	match_pattern,
	fact_type
) do update
set
	source_type = excluded.source_type,
	confidence = excluded.confidence,
	priority = excluded.priority,
	enabled = true,
	updated_at = now();

with conflict_values (preference_slug, fact_slug, severity) as (
	values
		('dairy', 'dairy', 'warning'),
		('milk', 'milk', 'warning'),
		('peanut', 'peanut', 'warning'),
		('tree-nut', 'tree-nut', 'warning'),
		('soy', 'soy', 'warning'),
		('egg', 'egg', 'warning'),
		('wheat', 'wheat', 'warning'),
		('gluten', 'gluten', 'warning'),
		('fish', 'fish', 'warning'),
		('shellfish', 'shellfish', 'warning'),
		('sesame', 'sesame', 'warning'),
		('dairy-free', 'dairy', 'warning'),
		('dairy-free', 'milk', 'warning'),
		('egg-free', 'egg', 'warning'),
		('gluten-free', 'gluten', 'warning'),
		('gluten-free', 'wheat', 'warning'),
		('kosher', 'shellfish', 'warning'),
		('nut-free', 'peanut', 'warning'),
		('nut-free', 'tree-nut', 'warning'),
		('soy-free', 'soy', 'warning'),
		('vegan', 'dairy', 'warning'),
		('vegan', 'milk', 'warning'),
		('vegan', 'egg', 'warning'),
		('vegan', 'fish', 'warning'),
		('vegan', 'shellfish', 'warning'),
		('vegetarian', 'fish', 'warning'),
		('vegetarian', 'shellfish', 'warning')
)
insert into public.compatibility_rule_conflicts (
	preference_tag_id,
	fact_tag_id,
	severity
)
select
	preference_tag.id,
	fact_tag.id,
	conflict_values.severity
from conflict_values
join public.compatibility_tags preference_tag
	on preference_tag.slug = conflict_values.preference_slug
join public.compatibility_tags fact_tag
	on fact_tag.slug = conflict_values.fact_slug
on conflict (preference_tag_id, fact_tag_id) do update
set
	severity = excluded.severity,
	updated_at = now();

alter table public.product_compatibility_facts
	drop constraint if exists product_compatibility_facts_source_type_check;

alter table public.product_compatibility_facts
	add constraint product_compatibility_facts_source_type_check
	check (
		source_type in (
			'shared_product_metadata',
			'shared_observation_metadata',
			'shared_submission_metadata',
			'label_allergen_field',
			'label_trace_field',
			'label_dietary_field',
			'label_ingredient_field',
			'source_food_identity'
		)
	);

alter table public.food_compatibility_match_rules enable row level security;
alter table public.food_compatibility_match_rules force row level security;

create policy "Authenticated users can read food compatibility match rules"
	on public.food_compatibility_match_rules
	for select
	to authenticated
	using (enabled = true);

revoke all on table public.food_compatibility_match_rules
	from public, anon, authenticated;
grant select on table public.food_compatibility_match_rules
	to authenticated, service_role;

select public.sync_user_compatibility_rules(
	preferences.user_id,
	preferences.allergens,
	preferences.dietary_restrictions
)
from public.user_food_preferences preferences;
