alter table public.nutrient_source_mappings
	add column if not exists review_status text not null default 'pending_review',
	add column if not exists review_reference text,
	add column if not exists reviewed_at timestamptz;

alter table public.nutrient_source_mappings
	drop constraint if exists nutrient_source_mappings_review_status_check;

alter table public.nutrient_source_mappings
	add constraint nutrient_source_mappings_review_status_check
	check (review_status in ('approved', 'pending_review', 'rejected'));

update public.nutrient_source_mappings
set
	review_status = case
		when mapping_method in (
			'api_id_match',
			'moderator_verified',
			'standards_dataset',
			'db_reviewed_api_key_match'
		) then 'approved'
		else 'pending_review'
	end,
	enabled = case
		when mapping_method in (
			'api_id_match',
			'moderator_verified',
			'standards_dataset',
			'db_reviewed_api_key_match'
		) then enabled
		else false
	end,
	review_reference = coalesce(
		review_reference,
		'20260719221000_reference_catalog_integrity'
	),
	reviewed_at = case
		when mapping_method in (
			'api_id_match',
			'moderator_verified',
			'standards_dataset',
			'db_reviewed_api_key_match'
		) then coalesce(reviewed_at, now())
		else reviewed_at
	end,
	updated_at = now();

insert into public.nutrient_source_mappings (
	source_key,
	source_nutrient_key,
	source_unit_name,
	source_nutrient_name,
	nutrient_id,
	priority,
	mapping_method,
	confidence,
	enabled,
	observation_count,
	provenance,
	review_status,
	review_reference,
	reviewed_at
)
values
	('open-food-facts', 'energy-kcal', 'KCAL', 'Energy', 1008, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now()),
	('open-food-facts', 'energy', 'KJ', 'Energy', 1008, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts energy field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now()),
	('open-food-facts', 'proteins', 'G', 'Proteins', 1003, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now()),
	('open-food-facts', 'fat', 'G', 'Fat', 1004, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now()),
	('open-food-facts', 'carbohydrates', 'G', 'Carbohydrates', 1005, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now()),
	('open-food-facts', 'fiber', 'G', 'Fiber', 1079, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now()),
	('open-food-facts', 'sugars', 'G', 'Sugars', 2000, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now()),
	('open-food-facts', 'sodium', 'G', 'Sodium', 1093, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now()),
	('open-food-facts', 'saturated-fat', 'G', 'Saturated Fat', 1258, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Specific fat field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now()),
	('open-food-facts', 'trans-fat', 'G', 'Trans Fat', 1257, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Specific fat field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now()),
	('open-food-facts', 'polyunsaturated-fat', 'G', 'Polyunsaturated Fat', 1293, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Specific fat field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now()),
	('open-food-facts', 'monounsaturated-fat', 'G', 'Monounsaturated Fat', 1292, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Specific fat field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now()),
	('open-food-facts', 'cholesterol', 'MG', 'Cholesterol', 1253, 0, 'db_reviewed_api_key_match', 1, true, 0, '{"reason":"Exact Open Food Facts field reviewed by blendCalc."}'::jsonb, 'approved', '20260719221000_reference_catalog_integrity', now())
on conflict (source_key, source_nutrient_key, source_unit_name) do update set
	source_nutrient_name = excluded.source_nutrient_name,
	nutrient_id = excluded.nutrient_id,
	priority = excluded.priority,
	mapping_method = excluded.mapping_method,
	confidence = excluded.confidence,
	enabled = excluded.enabled,
	provenance = public.nutrient_source_mappings.provenance || excluded.provenance,
	review_status = excluded.review_status,
	review_reference = excluded.review_reference,
	reviewed_at = excluded.reviewed_at,
	updated_at = now();

update public.nutrient_source_mappings
set
	enabled = false,
	review_status = 'rejected',
	review_reference = '20260719221000_reference_catalog_integrity',
	reviewed_at = now(),
	provenance = provenance || jsonb_build_object(
		'rejectionReason',
		'Sub-nutrient or ratio fields must never substitute for a parent nutrient.'
	),
	updated_at = now()
where source_key = 'open-food-facts'
	and source_nutrient_key in (
		'beta-alanine',
		'collagen-meat-protein-ratio',
		'energy-from-fat',
		'omega-3-fat',
		'omega-6-fat',
		'omega-9-fat',
		'unsaturated-fat'
	);

create index if not exists nutrient_source_mappings_reviewed_lookup_idx
	on public.nutrient_source_mappings (
		source_key,
		review_status,
		source_nutrient_key,
		priority
	)
	where enabled and review_status = 'approved';

create table public.nutrient_equivalences (
	id bigint generated always as identity primary key,
	canonical_nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete cascade,
	source_nutrient_id bigint,
	source_nutrient_number text,
	relation text not null check (relation in ('equivalent', 'legacy_alias')),
	source_key text not null references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (source_nutrient_id is not null or nullif(btrim(source_nutrient_number), '') is not null)
);

create unique index nutrient_equivalences_source_id_idx
	on public.nutrient_equivalences (source_key, source_nutrient_id, canonical_nutrient_id)
	where source_nutrient_id is not null;

create unique index nutrient_equivalences_source_number_idx
	on public.nutrient_equivalences (source_key, source_nutrient_number, canonical_nutrient_id)
	where source_nutrient_number is not null;

create trigger set_nutrient_equivalences_updated_at
	before update on public.nutrient_equivalences
	for each row execute function public.set_updated_at();

insert into public.nutrient_equivalences (
	canonical_nutrient_id,
	source_nutrient_id,
	source_nutrient_number,
	relation,
	source_key,
	source_reference
)
values
	(1008, 2047, null, 'equivalent', 'usda', 'USDA FoodData Central nutrient definitions'),
	(1008, 2048, null, 'equivalent', 'usda', 'USDA FoodData Central nutrient definitions'),
	(1004, 1085, null, 'equivalent', 'usda', 'USDA FoodData Central nutrient definitions'),
	(2000, 1063, null, 'legacy_alias', 'usda', 'USDA FoodData Central nutrient definitions'),
	(1008, null, '208', 'legacy_alias', 'usda', 'USDA legacy nutrient numbers'),
	(1003, null, '203', 'legacy_alias', 'usda', 'USDA legacy nutrient numbers'),
	(1004, null, '204', 'legacy_alias', 'usda', 'USDA legacy nutrient numbers'),
	(1004, null, '298', 'legacy_alias', 'usda', 'USDA legacy nutrient numbers'),
	(1005, null, '205', 'legacy_alias', 'usda', 'USDA legacy nutrient numbers'),
	(1079, null, '291', 'legacy_alias', 'usda', 'USDA legacy nutrient numbers'),
	(2000, null, '269', 'legacy_alias', 'usda', 'USDA legacy nutrient numbers')
on conflict do nothing;

create table public.nutrient_display_profiles (
	key text primary key check (btrim(key) <> ''),
	display_name text not null check (btrim(display_name) <> ''),
	purpose text not null check (purpose in ('nutrition_facts', 'mix_default', 'mix_popular')),
	version integer not null check (version > 0),
	enabled boolean not null default true,
	source_key text not null references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.nutrient_display_profile_fields (
	profile_key text not null references public.nutrient_display_profiles(key) on delete cascade,
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete restrict,
	display_label text,
	display_unit text,
	sort_order integer not null check (sort_order > 0),
	highlight boolean not null default false,
	default_goal numeric check (default_goal is null or default_goal >= 0),
	primary key (profile_key, nutrient_id),
	unique (profile_key, sort_order)
);

create trigger set_nutrient_display_profiles_updated_at
	before update on public.nutrient_display_profiles
	for each row execute function public.set_updated_at();

insert into public.nutrient_display_profiles (
	key,
	display_name,
	purpose,
	version,
	enabled,
	source_key,
	source_reference
)
values
	('nutrition-facts-primary-v1', 'Nutrition Facts primary nutrients', 'nutrition_facts', 1, true, 'blendcalc-nutrition-policy', 'blendCalc nutrition display policy v1'),
	('mix-default-v1', 'Default Mix nutrients', 'mix_default', 1, true, 'blendcalc-nutrition-policy', 'blendCalc Mix defaults v1'),
	('mix-popular-v1', 'Popular Mix nutrients', 'mix_popular', 1, true, 'blendcalc-nutrition-policy', 'blendCalc Mix popular nutrient policy v1')
on conflict (key) do update set
	display_name = excluded.display_name,
	purpose = excluded.purpose,
	version = excluded.version,
	enabled = excluded.enabled,
	source_key = excluded.source_key,
	source_reference = excluded.source_reference,
	updated_at = now();

insert into public.nutrient_display_profile_fields (
	profile_key,
	nutrient_id,
	display_label,
	display_unit,
	sort_order,
	highlight,
	default_goal
)
values
	('nutrition-facts-primary-v1', 1008, 'Calories', 'kcal', 10, true, null),
	('nutrition-facts-primary-v1', 1004, 'Total Fat', 'g', 20, false, null),
	('nutrition-facts-primary-v1', 1005, 'Total Carb.', 'g', 30, false, null),
	('nutrition-facts-primary-v1', 1079, 'Dietary Fiber', 'g', 40, false, null),
	('nutrition-facts-primary-v1', 2000, 'Total Sugars', 'g', 50, false, null),
	('nutrition-facts-primary-v1', 1003, 'Protein', 'g', 60, false, null),
	('mix-default-v1', 1008, 'Calories', 'kcal', 10, true, 350),
	('mix-default-v1', 1004, 'Total Fat', 'g', 20, false, 15),
	('mix-default-v1', 1005, 'Total Carbohydrates', 'g', 30, false, 60),
	('mix-default-v1', 1079, 'Dietary Fiber', 'g', 40, false, 10),
	('mix-default-v1', 2000, 'Total Sugars', 'g', 50, false, 25),
	('mix-default-v1', 1003, 'Protein', 'g', 60, false, 25),
	('mix-default-v1', 1162, 'Vitamin C', 'mg', 70, false, 90),
	('mix-default-v1', 1087, 'Calcium', 'mg', 80, false, 300),
	('mix-default-v1', 1089, 'Iron', 'mg', 90, false, 5),
	('mix-default-v1', 1092, 'Potassium', 'mg', 100, false, 900),
	('mix-default-v1', 1106, 'Vitamin A (RAE)', 'mcg', 110, false, 300),
	('mix-default-v1', 1110, 'Vitamin D', 'IU', 120, false, 400),
	('mix-default-v1', 1185, 'Vitamin K1', 'mcg', 130, false, 45),
	('mix-default-v1', 1253, 'Cholesterol', 'mg', 140, false, 50),
	('mix-default-v1', 1093, 'Sodium', 'mg', 150, false, 500),
	('mix-popular-v1', 1093, 'Sodium', 'mg', 10, false, null),
	('mix-popular-v1', 1092, 'Potassium', 'mg', 20, false, null),
	('mix-popular-v1', 1087, 'Calcium', 'mg', 30, false, null),
	('mix-popular-v1', 1089, 'Iron', 'mg', 40, false, null),
	('mix-popular-v1', 1090, 'Magnesium', 'mg', 50, false, null),
	('mix-popular-v1', 1253, 'Cholesterol', 'mg', 60, false, null),
	('mix-popular-v1', 1258, 'Saturated Fat', 'g', 70, false, null),
	('mix-popular-v1', 1292, 'Monounsaturated Fat', 'g', 80, false, null),
	('mix-popular-v1', 1293, 'Polyunsaturated Fat', 'g', 90, false, null),
	('mix-popular-v1', 1162, 'Vitamin C', 'mg', 100, false, null),
	('mix-popular-v1', 1106, 'Vitamin A (RAE)', 'mcg', 110, false, null),
	('mix-popular-v1', 1110, 'Vitamin D', 'IU', 120, false, null),
	('mix-popular-v1', 1185, 'Vitamin K1', 'mcg', 130, false, null),
	('mix-popular-v1', 1175, 'Vitamin B6', 'mg', 140, false, null),
	('mix-popular-v1', 1177, 'Folate', 'mcg', 150, false, null),
	('mix-popular-v1', 1178, 'Vitamin B12', 'mcg', 160, false, null),
	('mix-popular-v1', 1235, 'Added Sugars', 'g', 170, false, null)
on conflict (profile_key, nutrient_id) do update set
	display_label = excluded.display_label,
	display_unit = excluded.display_unit,
	sort_order = excluded.sort_order,
	highlight = excluded.highlight,
	default_goal = excluded.default_goal;

create table public.mix_goal_templates (
	key text primary key check (btrim(key) <> ''),
	display_name text not null check (btrim(display_name) <> ''),
	description text not null check (btrim(description) <> ''),
	sort_order integer not null check (sort_order > 0),
	version integer not null check (version > 0),
	enabled boolean not null default true,
	source_key text not null references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (sort_order)
);

create table public.mix_goal_template_targets (
	template_key text not null references public.mix_goal_templates(key) on delete cascade,
	nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete restrict,
	target_amount numeric not null check (target_amount >= 0),
	primary key (template_key, nutrient_id)
);

create table public.mix_runtime_configuration (
	key text primary key check (btrim(key) <> ''),
	value jsonb not null,
	version integer not null check (version > 0),
	enabled boolean not null default true,
	source_key text not null references public.product_data_sources(key) on delete restrict,
	source_reference text not null check (btrim(source_reference) <> ''),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create trigger set_mix_goal_templates_updated_at
	before update on public.mix_goal_templates
	for each row execute function public.set_updated_at();

create trigger set_mix_runtime_configuration_updated_at
	before update on public.mix_runtime_configuration
	for each row execute function public.set_updated_at();

insert into public.mix_goal_templates (
	key,
	display_name,
	description,
	sort_order,
	version,
	enabled,
	source_key,
	source_reference
)
values
	('balanced', 'Balanced', 'Moderate calories, protein, carbs, fiber, and sugar.', 10, 1, true, 'blendcalc-nutrition-policy', 'blendCalc Mix goal policy v1'),
	('high-protein', 'High Protein', 'Prioritizes protein while keeping sugar moderate.', 20, 1, true, 'blendcalc-nutrition-policy', 'blendCalc Mix goal policy v1'),
	('low-sugar', 'Low Sugar', 'Keeps sugar low while preserving fiber and protein.', 30, 1, true, 'blendcalc-nutrition-policy', 'blendCalc Mix goal policy v1'),
	('calorie-dense', 'Calorie Dense', 'Higher energy target for a more filling drink.', 40, 1, true, 'blendcalc-nutrition-policy', 'blendCalc Mix goal policy v1'),
	('fiber-focused', 'Fiber Focused', 'Raises fiber and keeps sugar controlled.', 50, 1, true, 'blendcalc-nutrition-policy', 'blendCalc Mix goal policy v1')
on conflict (key) do update set
	display_name = excluded.display_name,
	description = excluded.description,
	sort_order = excluded.sort_order,
	version = excluded.version,
	enabled = excluded.enabled,
	source_key = excluded.source_key,
	source_reference = excluded.source_reference,
	updated_at = now();

insert into public.mix_goal_template_targets (template_key, nutrient_id, target_amount)
values
	('balanced', 1008, 350), ('balanced', 1004, 15), ('balanced', 1005, 60), ('balanced', 1079, 10), ('balanced', 2000, 25), ('balanced', 1003, 25),
	('high-protein', 1008, 450), ('high-protein', 1004, 18), ('high-protein', 1005, 50), ('high-protein', 1079, 8), ('high-protein', 2000, 20), ('high-protein', 1003, 45),
	('low-sugar', 1008, 300), ('low-sugar', 1004, 12), ('low-sugar', 1005, 35), ('low-sugar', 1079, 12), ('low-sugar', 2000, 10), ('low-sugar', 1003, 25),
	('calorie-dense', 1008, 650), ('calorie-dense', 1004, 30), ('calorie-dense', 1005, 85), ('calorie-dense', 1079, 10), ('calorie-dense', 2000, 35), ('calorie-dense', 1003, 35),
	('fiber-focused', 1008, 375), ('fiber-focused', 1004, 12), ('fiber-focused', 1005, 60), ('fiber-focused', 1079, 18), ('fiber-focused', 2000, 18), ('fiber-focused', 1003, 25)
on conflict (template_key, nutrient_id) do update set
	target_amount = excluded.target_amount;

insert into public.mix_runtime_configuration (
	key,
	value,
	version,
	enabled,
	source_key,
	source_reference
)
values
	('default-goal-by-unit', '{"G":20,"KCAL":350,"fallback":100}'::jsonb, 1, true, 'blendcalc-nutrition-policy', 'blendCalc Mix runtime policy v1'),
	('progress-thresholds', '{"atGoal":1,"barelyOver":1.1,"midwayOver":1.35}'::jsonb, 1, true, 'blendcalc-nutrition-policy', 'blendCalc Mix runtime policy v1'),
	('point-goal-tolerance', '0.1'::jsonb, 1, true, 'blendcalc-nutrition-policy', 'blendCalc Mix runtime policy v1'),
	('default-serving-grams', '100'::jsonb, 1, true, 'blendcalc-nutrition-policy', 'blendCalc Mix runtime policy v1')
on conflict (key) do update set
	value = excluded.value,
	version = excluded.version,
	enabled = excluded.enabled,
	source_key = excluded.source_key,
	source_reference = excluded.source_reference,
	updated_at = now();

create table public.food_symbol_definitions (
	key text primary key check (btrim(key) <> ''),
	display_name text not null check (btrim(display_name) <> ''),
	sort_order integer not null check (sort_order > 0),
	enabled boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (sort_order)
);

create trigger set_food_symbol_definitions_updated_at
	before update on public.food_symbol_definitions
	for each row execute function public.set_updated_at();

insert into public.food_symbol_definitions (key, display_name, sort_order)
values
	('protein-powder', 'Protein powder', 10),
	('beverage', 'Beverage', 20),
	('sweets', 'Sweets', 30),
	('oils-fats', 'Oils and fats', 40),
	('dairy', 'Dairy', 50),
	('meat', 'Meat', 60),
	('seafood', 'Fish and seafood', 70),
	('grains', 'Grains', 80),
	('nuts-seeds', 'Nuts and seeds', 90),
	('vegetables', 'Vegetables', 100),
	('fruit', 'Fruit', 110),
	('packaged', 'Packaged food', 120),
	('generic', 'Ingredient', 130)
on conflict (key) do update set
	display_name = excluded.display_name,
	sort_order = excluded.sort_order,
	enabled = true,
	updated_at = now();

alter table public.custom_food_category_options
	add column if not exists symbol_key text not null default 'generic'
		references public.food_symbol_definitions(key) on delete restrict;

update public.custom_food_category_options
set symbol_key = case
	when normalized_value ~ '(protein powder|whey|casein|protein isolate|protein concentrate)' then 'protein-powder'
	when normalized_value ~ '(beverage|drink|water|juice|soda|coffee|tea|nectar)' then 'beverage'
	when normalized_value ~ '(sweet|candy|chocolate|sugar|syrup|jelly|jam|dessert|cookie|cake)' then 'sweets'
	when normalized_value ~ '(oil|fat|butter|margarine|shortening)' then 'oils-fats'
	when normalized_value ~ '(dairy|milk|yogurt|cheese|cream|egg)' then 'dairy'
	when normalized_value ~ '(meat|beef|pork|chicken|poultry|turkey|lamb|sausage)' then 'meat'
	when normalized_value ~ '(fish|seafood|shellfish|shrimp|salmon|tuna|crab|crustacean)' then 'seafood'
	when normalized_value ~ '(grain|cereal|wheat|oat|rice|pasta|bread|flour)' then 'grains'
	when normalized_value ~ '(nut|seed|almond|peanut|cashew|chia|walnut|legume)' then 'nuts-seeds'
	when normalized_value ~ '(vegetable|spinach|kale|broccoli|tomato|carrot|lettuce|greens)' then 'vegetables'
	when normalized_value ~ '(fruit|berr|apple|banana|mango|grape|citrus|peach|pineapple|melon|kiwi)' then 'fruit'
	when normalized_value ~ '(branded|packaged|prepared|sauce|soup|condiment)' then 'packaged'
	else 'generic'
end,
	updated_at = now();

alter table public.nutrient_equivalences enable row level security;
alter table public.nutrient_equivalences force row level security;
alter table public.nutrient_display_profiles enable row level security;
alter table public.nutrient_display_profiles force row level security;
alter table public.nutrient_display_profile_fields enable row level security;
alter table public.nutrient_display_profile_fields force row level security;
alter table public.mix_goal_templates enable row level security;
alter table public.mix_goal_templates force row level security;
alter table public.mix_goal_template_targets enable row level security;
alter table public.mix_goal_template_targets force row level security;
alter table public.mix_runtime_configuration enable row level security;
alter table public.mix_runtime_configuration force row level security;
alter table public.food_symbol_definitions enable row level security;
alter table public.food_symbol_definitions force row level security;

create policy "Authenticated users can read nutrient equivalences"
	on public.nutrient_equivalences for select to authenticated using (true);
create policy "Authenticated users can read nutrient display profiles"
	on public.nutrient_display_profiles for select to authenticated using (true);
create policy "Authenticated users can read nutrient display profile fields"
	on public.nutrient_display_profile_fields for select to authenticated using (true);
create policy "Authenticated users can read Mix goal templates"
	on public.mix_goal_templates for select to authenticated using (true);
create policy "Authenticated users can read Mix goal template targets"
	on public.mix_goal_template_targets for select to authenticated using (true);
create policy "Authenticated users can read Mix runtime configuration"
	on public.mix_runtime_configuration for select to authenticated using (true);
create policy "Authenticated users can read food symbol definitions"
	on public.food_symbol_definitions for select to authenticated using (true);

revoke all on table public.nutrient_equivalences from public, anon, authenticated;
revoke all on table public.nutrient_display_profiles from public, anon, authenticated;
revoke all on table public.nutrient_display_profile_fields from public, anon, authenticated;
revoke all on table public.mix_goal_templates from public, anon, authenticated;
revoke all on table public.mix_goal_template_targets from public, anon, authenticated;
revoke all on table public.mix_runtime_configuration from public, anon, authenticated;
revoke all on table public.food_symbol_definitions from public, anon, authenticated;

grant select on table public.nutrient_equivalences to authenticated;
grant select on table public.nutrient_display_profiles to authenticated;
grant select on table public.nutrient_display_profile_fields to authenticated;
grant select on table public.mix_goal_templates to authenticated;
grant select on table public.mix_goal_template_targets to authenticated;
grant select on table public.mix_runtime_configuration to authenticated;
grant select on table public.food_symbol_definitions to authenticated;

grant all on table public.nutrient_equivalences to service_role;
grant all on table public.nutrient_display_profiles to service_role;
grant all on table public.nutrient_display_profile_fields to service_role;
grant all on table public.mix_goal_templates to service_role;
grant all on table public.mix_goal_template_targets to service_role;
grant all on table public.mix_runtime_configuration to service_role;
grant all on table public.food_symbol_definitions to service_role;

comment on column public.nutrient_source_mappings.review_status is
	'Only approved mappings may feed product nutrition. API-discovered guesses remain pending and disabled until reviewed.';

comment on table public.nutrient_equivalences is
	'DB-owned safe aliases for equivalent or legacy nutrient identifiers. Missing nutrients are never inferred from fuzzy names.';

comment on table public.nutrient_display_profiles is
	'Versioned DB-owned nutrient presentation policy for Nutrition Facts and Mix defaults.';

comment on table public.mix_goal_templates is
	'Versioned DB-owned Mix goal presets. These are product defaults, not medical recommendations.';

comment on column public.custom_food_category_options.symbol_key is
	'Stable reusable icon key selected by the canonical category catalog.';
