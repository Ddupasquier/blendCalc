-- Local-only deterministic runtime reference fixtures.
-- Supabase executes this file after `db reset --local`. These rows contain no
-- production users, private records, evidence, or images.

insert into public.serving_measure_units (
	key,
	display_label,
	short_label,
	dimension,
	base_unit_key,
	conversion_to_base,
	standards_code,
	display_order,
	is_default,
	enabled,
	source_key,
	source_reference,
	observed_at
)
values
	('g', 'grams (g)', 'g', 'weight', 'g', 1, 'g', 10, true, true, 'ucum-nlm', 'https://ucum.nlm.nih.gov/ucum-service/v1/ucumtransform/1/from/g/to/g', '2026-07-23T00:17:19.133Z'),
	('mg', 'milligrams (mg)', 'mg', 'weight', 'g', 0.001, '10*-3.g', 20, false, true, 'ucum-nlm', 'https://ucum.nlm.nih.gov/ucum-service/v1/ucumtransform/1/from/10*-3.g/to/g', '2026-07-23T00:17:19.133Z'),
	('oz', 'ounces (oz)', 'oz', 'weight', 'g', 28.349523, '[oz_av]', 30, false, true, 'ucum-nlm', 'https://ucum.nlm.nih.gov/ucum-service/v1/ucumtransform/1/from/%5Boz_av%5D/to/g', '2026-07-23T00:17:19.133Z'),
	('kg', 'kilograms (kg)', 'kg', 'weight', 'g', 1000, 'kg', 40, false, true, 'ucum-nlm', 'https://ucum.nlm.nih.gov/ucum-service/v1/ucumtransform/1/from/kg/to/g', '2026-07-23T00:17:19.133Z'),
	('lb', 'pounds (lb)', 'lb', 'weight', 'g', 453.59237, '[lb_av]', 50, false, true, 'ucum-nlm', 'https://ucum.nlm.nih.gov/ucum-service/v1/ucumtransform/1/from/%5Blb_av%5D/to/g', '2026-07-23T00:17:19.133Z'),
	('ml', 'milliliters (ml)', 'ml', 'volume', 'ml', 1, 'mL', 60, false, true, 'ucum-nlm', 'https://ucum.nlm.nih.gov/ucum-service/v1/ucumtransform/1/from/mL/to/mL', '2026-07-23T00:17:19.133Z'),
	('tsp', 'teaspoons (tsp)', 'tsp', 'volume', 'ml', 4.9289216, '[tsp_us]', 70, false, true, 'ucum-nlm', 'https://ucum.nlm.nih.gov/ucum-service/v1/ucumtransform/1/from/%5Btsp_us%5D/to/mL', '2026-07-23T00:17:19.133Z'),
	('tbsp', 'tablespoons (tbsp)', 'tbsp', 'volume', 'ml', 14.786765, '[tbs_us]', 80, false, true, 'ucum-nlm', 'https://ucum.nlm.nih.gov/ucum-service/v1/ucumtransform/1/from/%5Btbs_us%5D/to/mL', '2026-07-23T00:17:19.133Z'),
	('cup', 'cups', 'cup', 'volume', 'ml', 236.58824, '[cup_us]', 90, true, true, 'ucum-nlm', 'https://ucum.nlm.nih.gov/ucum-service/v1/ucumtransform/1/from/%5Bcup_us%5D/to/mL', '2026-07-23T00:17:19.133Z'),
	('floz', 'fluid ounces (fl oz)', 'fl oz', 'volume', 'ml', 29.57353, '[foz_us]', 100, false, true, 'ucum-nlm', 'https://ucum.nlm.nih.gov/ucum-service/v1/ucumtransform/1/from/%5Bfoz_us%5D/to/mL', '2026-07-23T00:17:19.133Z')
on conflict (key) do update set
	display_label = excluded.display_label,
	short_label = excluded.short_label,
	dimension = excluded.dimension,
	base_unit_key = excluded.base_unit_key,
	conversion_to_base = excluded.conversion_to_base,
	standards_code = excluded.standards_code,
	display_order = excluded.display_order,
	is_default = excluded.is_default,
	enabled = excluded.enabled,
	source_key = excluded.source_key,
	source_reference = excluded.source_reference,
	observed_at = excluded.observed_at;

with aliases(unit_key, alias) as (
	values
		('g', 'g'), ('g', 'gram'), ('g', 'grams'),
		('mg', 'mg'), ('mg', 'milligram'), ('mg', 'milligrams'),
		('oz', 'oz'), ('oz', 'ounce'), ('oz', 'ounces'),
		('kg', 'kg'), ('kg', 'kilogram'), ('kg', 'kilograms'),
		('lb', 'lb'), ('lb', 'lbs'), ('lb', 'pound'), ('lb', 'pounds'),
		('ml', 'ml'), ('ml', 'mlt'), ('ml', 'milliliter'), ('ml', 'milliliters'),
		('ml', 'millilitre'), ('ml', 'millilitres'),
		('tsp', 'tsp'), ('tsp', 'teaspoon'), ('tsp', 'teaspoons'),
		('tbsp', 'tbsp'), ('tbsp', 'tablespoon'), ('tbsp', 'tablespoons'),
		('cup', 'c'), ('cup', 'cup'), ('cup', 'cups'),
		('floz', 'fl oz'), ('floz', 'fluid ounce'), ('floz', 'fluid ounces')
)
insert into public.serving_measure_aliases (
	unit_key,
	alias,
	normalized_alias,
	source_key,
	observation_count,
	first_observed_at,
	last_observed_at
)
select
	unit_key,
	alias,
	regexp_replace(lower(alias), '\s+', '', 'g'),
	'ucum-nlm',
	1,
	'2026-07-23T00:17:19.133Z',
	'2026-07-23T00:17:19.133Z'
from aliases
on conflict (normalized_alias) do update set
	unit_key = excluded.unit_key,
	alias = excluded.alias,
	source_key = excluded.source_key,
	observation_count = excluded.observation_count,
	first_observed_at = excluded.first_observed_at,
	last_observed_at = excluded.last_observed_at;

insert into public.nutrient_manual_entry_groups (
	id,
	entry_step,
	title,
	sort_order,
	enabled,
	source_count,
	observation_count,
	verification_status,
	sources,
	last_observed_at,
	group_role
)
values
	('required-basics', 'macros', 'Required basics', 10, true, 1, 1, 'single_source', array['local-qa-fixture'], '2026-07-25T00:00:00Z', 'display'),
	('carbohydrate-details', 'macros', 'Carbohydrate details', 20, true, 1, 1, 'single_source', array['local-qa-fixture'], '2026-07-25T00:00:00Z', 'display'),
	('fat-details', 'macros', 'Fat details', 30, true, 1, 1, 'single_source', array['local-qa-fixture'], '2026-07-25T00:00:00Z', 'display'),
	('vitamins', 'extended', 'Vitamins', 10, true, 1, 1, 'single_source', array['local-qa-fixture'], '2026-07-25T00:00:00Z', 'display'),
	('minerals', 'extended', 'Minerals', 20, true, 1, 1, 'single_source', array['local-qa-fixture'], '2026-07-25T00:00:00Z', 'display')
on conflict (id) do update set
	entry_step = excluded.entry_step,
	title = excluded.title,
	sort_order = excluded.sort_order,
	enabled = excluded.enabled,
	source_count = excluded.source_count,
	observation_count = excluded.observation_count,
	verification_status = excluded.verification_status,
	sources = excluded.sources,
	last_observed_at = excluded.last_observed_at,
	group_role = excluded.group_role;

with fields (
	dedupe_key,
	nutrient_id,
	group_id,
	nutrient_type,
	display_label,
	sort_order,
	required_for_manual_entry
) as (
	values
		('macros:required-basics:calories:kcal', 1008, 'required-basics', 'energy', 'Calories (kcal)', 10, true),
		('macros:required-basics:total fat:g', 1004, 'required-basics', 'macro', 'Total Fat (g)', 20, true),
		('macros:required-basics:total carbohydrates:g', 1005, 'required-basics', 'macro', 'Total Carbohydrates (g)', 30, true),
		('macros:required-basics:protein:g', 1003, 'required-basics', 'macro', 'Protein (g)', 40, true),
		('macros:required-basics:sodium:mg', 1093, 'required-basics', 'mineral', 'Sodium (mg)', 50, true),
		('macros:carbohydrate-details:fiber total dietary:g', 1079, 'carbohydrate-details', 'carbohydrate', 'Fiber, Total Dietary (g)', 10, false),
		('macros:carbohydrate-details:total sugars:g', 2000, 'carbohydrate-details', 'carbohydrate', 'Total Sugars (g)', 20, false),
		('macros:carbohydrate-details:added sugars:g', 1235, 'carbohydrate-details', 'carbohydrate', 'Added Sugars (g)', 30, false),
		('macros:fat-details:fatty acids total saturated:g', 1258, 'fat-details', 'fat', 'Fatty Acids, Total Saturated (g)', 10, false),
		('macros:fat-details:fatty acids total trans:g', 1257, 'fat-details', 'fat', 'Fatty Acids, Total Trans (g)', 20, false),
		('macros:fat-details:fatty acids total polyunsaturated:g', 1293, 'fat-details', 'fat', 'Fatty Acids, Total Polyunsaturated (g)', 30, false),
		('macros:fat-details:fatty acids total monounsaturated:g', 1292, 'fat-details', 'fat', 'Fatty Acids, Total Monounsaturated (g)', 40, false),
		('macros:fat-details:cholesterol:mg', 1253, 'fat-details', 'fat', 'Cholesterol (mg)', 50, false),
		('extended:vitamins:vitamin a rae:ug', 1106, 'vitamins', 'vitamin', 'Vitamin A, RAE (mcg)', 10, false),
		('extended:vitamins:vitamin d d2 d3:ug', 1114, 'vitamins', 'vitamin', 'Vitamin D (D2 + D3) (mcg)', 20, false),
		('extended:vitamins:vitamin c total ascorbic acid:mg', 1162, 'vitamins', 'vitamin', 'Vitamin C, Total Ascorbic Acid (mg)', 30, false),
		('extended:vitamins:thiamin:mg', 1165, 'vitamins', 'vitamin', 'Thiamin (mg)', 40, false),
		('extended:vitamins:riboflavin:mg', 1166, 'vitamins', 'vitamin', 'Riboflavin (mg)', 50, false),
		('extended:vitamins:niacin:mg', 1167, 'vitamins', 'vitamin', 'Niacin (mg)', 60, false),
		('extended:vitamins:vitamin b6:mg', 1175, 'vitamins', 'vitamin', 'Vitamin B-6 (mg)', 70, false),
		('extended:vitamins:folate total:ug', 1177, 'vitamins', 'vitamin', 'Folate, Total (mcg)', 80, false),
		('extended:vitamins:vitamin b12:ug', 1178, 'vitamins', 'vitamin', 'Vitamin B-12 (mcg)', 90, false),
		('extended:vitamins:vitamin k phylloquinone:ug', 1185, 'vitamins', 'vitamin', 'Vitamin K (Phylloquinone) (mcg)', 100, false),
		('extended:minerals:calcium:mg', 1087, 'minerals', 'mineral', 'Calcium, Ca (mg)', 10, false),
		('extended:minerals:iron:mg', 1089, 'minerals', 'mineral', 'Iron, Fe (mg)', 20, false),
		('extended:minerals:magnesium:mg', 1090, 'minerals', 'mineral', 'Magnesium, Mg (mg)', 30, false),
		('extended:minerals:phosphorus:mg', 1091, 'minerals', 'mineral', 'Phosphorus, P (mg)', 40, false),
		('extended:minerals:potassium:mg', 1092, 'minerals', 'mineral', 'Potassium, K (mg)', 50, false),
		('extended:minerals:zinc:mg', 1095, 'minerals', 'mineral', 'Zinc, Zn (mg)', 60, false),
		('extended:minerals:copper:mg', 1098, 'minerals', 'mineral', 'Copper, Cu (mg)', 70, false),
		('extended:minerals:iodine:ug', 1100, 'minerals', 'mineral', 'Iodine, I (mcg)', 80, false),
		('extended:minerals:manganese:mg', 1101, 'minerals', 'mineral', 'Manganese, Mn (mg)', 90, false),
		('extended:minerals:selenium:ug', 1103, 'minerals', 'mineral', 'Selenium, Se (mcg)', 100, false)
)
insert into public.nutrient_manual_entry_fields (
	dedupe_key,
	nutrient_id,
	group_id,
	nutrient_type,
	display_label,
	sort_order,
	enabled,
	source_count,
	observation_count,
	verification_status,
	sources,
	last_observed_at,
	required_for_manual_entry,
	classification_status,
	classification_source_key,
	classification_reference,
	classification_version,
	classification_notes,
	reviewed_at
)
select
	dedupe_key,
	nutrient_id,
	group_id,
	nutrient_type,
	display_label,
	sort_order,
	true,
	1,
	1,
	'single_source',
	array['local-qa-fixture'],
	'2026-07-25T00:00:00Z',
	required_for_manual_entry,
	'approved',
	'blendcalc-manual-entry-policy',
	'local-qa-reference-fixture-v1',
	2,
	'Synthetic local QA fixture for deterministic manual-entry testing.',
	'2026-07-25T00:00:00Z'
from fields
on conflict (dedupe_key) do update set
	nutrient_id = excluded.nutrient_id,
	group_id = excluded.group_id,
	nutrient_type = excluded.nutrient_type,
	display_label = excluded.display_label,
	sort_order = excluded.sort_order,
	enabled = excluded.enabled,
	required_for_manual_entry = excluded.required_for_manual_entry,
	classification_status = excluded.classification_status,
	classification_source_key = excluded.classification_source_key,
	classification_reference = excluded.classification_reference,
	classification_version = excluded.classification_version,
	classification_notes = excluded.classification_notes,
	reviewed_at = excluded.reviewed_at;

update public.nutrient_relationship_rules
set enabled = true
where source = 'nutrient_definitions'
	and not enabled;

with categories(id, label, normalized_value, symbol_key) as (
	values
		('qa-fruit', 'Fruits and Fruit Juices', 'fruits and fruit juices', 'fruit'),
		('qa-vegetables', 'Vegetables and Vegetable Products', 'vegetables and vegetable products', 'vegetables'),
		('qa-dairy', 'Dairy and Egg Products', 'dairy and egg products', 'dairy'),
		('qa-beef', 'Beef Products', 'beef products', 'meat'),
		('qa-poultry', 'Poultry Products', 'poultry products', 'poultry'),
		('qa-seafood', 'Finfish and Shellfish Products', 'finfish and shellfish products', 'seafood'),
		('qa-grains', 'Cereal Grains and Pasta', 'cereal grains and pasta', 'grains'),
		('qa-legumes', 'Legumes and Legume Products', 'legumes and legume products', 'legumes'),
		('qa-nuts', 'Nut and Seed Products', 'nut and seed products', 'nuts-seeds'),
		('qa-beverages', 'Beverages', 'beverages', 'beverage'),
		('qa-sweets', 'Sweets', 'sweets', 'sweets'),
		('qa-fats', 'Fats and Oils', 'fats and oils', 'oils-fats'),
		('qa-snacks', 'Snacks', 'snacks', 'packaged'),
		('qa-soups', 'Soups, Sauces, and Gravies', 'soups sauces and gravies', 'soup'),
		('qa-spices', 'Spices and Herbs', 'spices and herbs', 'sauces-condiments'),
		('qa-baked', 'Baked Products', 'baked products', 'bread-bakery'),
		('qa-fast-foods', 'Fast Foods', 'fast foods', 'packaged'),
		('qa-meals', 'Meals, Entrees, and Side Dishes', 'meals entrees and side dishes', 'packaged'),
		('qa-protein-bars', 'Protein Bars', 'protein bars', 'protein-bar'),
		('qa-protein-powders', 'Protein Powders', 'protein powders', 'protein-powder'),
		('qa-nut-seed-butters', 'Nut & Seed Butters', 'nut and seed butters', 'nuts-seeds'),
		('qa-dips', 'Dips and Salsa', 'dips and salsa', 'sauces-condiments'),
		('qa-preserves', 'Jams and Preserves', 'jams and preserves', 'spreads-preserves')
)
insert into public.custom_food_category_options (
	id,
	label,
	normalized_value,
	sources,
	source_count,
	observation_count,
	verification_status,
	enabled,
	first_seen_at,
	last_seen_at,
	symbol_key
)
select
	id,
	label,
	normalized_value,
	array['local-qa-fixture'],
	2,
	10,
	'multi_source_verified',
	true,
	'2026-07-25T00:00:00Z',
	'2026-07-25T00:00:00Z',
	symbol_key
from categories
on conflict (id) do update set
	label = excluded.label,
	normalized_value = excluded.normalized_value,
	sources = excluded.sources,
	source_count = excluded.source_count,
	observation_count = excluded.observation_count,
	verification_status = excluded.verification_status,
	enabled = excluded.enabled,
	first_seen_at = excluded.first_seen_at,
	last_seen_at = excluded.last_seen_at,
	symbol_key = excluded.symbol_key;

insert into public.food_preference_option_catalog (
	category,
	label,
	normalized_value,
	source_type,
	tag_id,
	source_values,
	usage_count
)
select
	tag.category,
	tag.label,
	tag.slug,
	'compatibility_fact',
	tag.id,
	array[tag.slug],
	10
from public.compatibility_tags tag
where tag.category in ('allergen', 'dietary')
on conflict (category, normalized_value) do update set
	label = excluded.label,
	source_type = excluded.source_type,
	tag_id = excluded.tag_id,
	source_values = excluded.source_values,
	usage_count = excluded.usage_count;
