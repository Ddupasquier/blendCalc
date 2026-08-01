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

insert into public.serving_measure_aliases (
	unit_key,
	alias,
	normalized_alias,
	source_key,
	observation_count,
	first_observed_at,
	last_observed_at
)
values (
	'g',
	'GRM',
	'grm',
	'usda',
	1,
	'2026-07-27T00:00:00Z',
	'2026-07-27T00:00:00Z'
)
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

with scale_categories(id, label, normalized_value, symbol_key) as (
	select
		'qa-scale-category-' || lpad(category_number::text, 4, '0'),
		'QA Scale Category ' || lpad(category_number::text, 4, '0'),
		'qa scale category ' || lpad(category_number::text, 4, '0'),
		'packaged'
	from generate_series(1, 1005) as category_number
	union all
	select
		'qa-yogurts',
		'Yogurts',
		'yogurts',
		'dairy'
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
	array['local-qa-scale-fixture'],
	1,
	1,
	'single_source',
	true,
	'2026-08-01T00:00:00Z',
	'2026-08-01T00:00:00Z',
	symbol_key
from scale_categories
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

insert into public.product_data_sources (
	key,
	display_name,
	source_type,
	homepage_url,
	terms_url,
	attribution_text,
	enabled,
	canonical_storage_allowed,
	canonical_license_name,
	canonical_policy_notes,
	canonical_policy_reviewed_at,
	api_redistribution_allowed,
	provenance
)
values
	(
		'user-label',
		'Local QA label fixture',
		'internal_catalog',
		'https://blendcalc.local/qa-fixtures',
		'https://blendcalc.local/qa-fixtures',
		'Synthetic package-label data maintained only in the isolated blendCalc QA database.',
		true,
		true,
		'Local QA fixture',
		'Authored deterministic data for local testing; never imported into production.',
		'2026-08-01T00:00:00Z',
		true,
		'{"environment":"local-test","fixtureVersion":1}'::jsonb
	),
	(
		'shared-catalog',
		'blendCalc Community',
		'internal_catalog',
		'https://blendcalc.local/qa-fixtures',
		'https://blendcalc.local/qa-fixtures',
		'Food data created and approved through the blendCalc community catalog.',
		true,
		true,
		'blendCalc catalog data',
		'Local QA catalog records are authored fixtures and remain isolated from production.',
		'2026-08-01T00:00:00Z',
		true,
		'{"environment":"local-test","fixtureVersion":1}'::jsonb
	)
on conflict (key) do update set
	display_name = excluded.display_name,
	source_type = excluded.source_type,
	homepage_url = excluded.homepage_url,
	terms_url = excluded.terms_url,
	attribution_text = excluded.attribution_text,
	enabled = excluded.enabled,
	canonical_storage_allowed = excluded.canonical_storage_allowed,
	canonical_license_name = excluded.canonical_license_name,
	canonical_policy_notes = excluded.canonical_policy_notes,
	canonical_policy_reviewed_at = excluded.canonical_policy_reviewed_at,
	api_redistribution_allowed = excluded.api_redistribution_allowed,
	provenance = public.product_data_sources.provenance || excluded.provenance;

do $catalog_fixtures$
begin
drop table if exists private.qa_catalog_product_fixtures;
create table private.qa_catalog_product_fixtures (
	product_id uuid primary key,
	revision_id uuid not null unique,
	observation_id uuid not null unique,
	barcode text not null unique,
	product_name text not null,
	brand_owner text not null,
	category_option_id text not null,
	source_reference text not null,
	food jsonb not null
);

insert into private.qa_catalog_product_fixtures (
	product_id,
	revision_id,
	observation_id,
	barcode,
	product_name,
	brand_owner,
	category_option_id,
	source_reference,
	food
)
values
	(
		'81000000-0000-4000-8000-000000000001',
		'81000000-0000-4000-8000-000000000002',
		'81000000-0000-4000-8000-000000000003',
		'00021130462506',
		'Strawberry Jelly, Strawberry',
		'QA Pantry',
		'qa-preserves',
		'local-qa-label:00021130462506',
		'{
			"fdcId": 9100001,
			"description": "Strawberry Jelly, Strawberry",
			"nameProvenance": "source",
			"brandOwner": "QA Pantry",
			"foodNutrients": [
				{"nutrientId":1008,"nutrientName":"Energy","nutrientNumber":"208","unitName":"KCAL","value":250,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1004,"nutrientName":"Total lipid (fat)","nutrientNumber":"204","unitName":"G","value":0,"valueOrigin":"reported","valueStatus":"reported-zero","mappingStatus":"canonical"},
				{"nutrientId":1005,"nutrientName":"Carbohydrate, by difference","nutrientNumber":"205","unitName":"G","value":65,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1003,"nutrientName":"Protein","nutrientNumber":"203","unitName":"G","value":0,"valueOrigin":"reported","valueStatus":"reported-zero","mappingStatus":"canonical"},
				{"nutrientId":1079,"nutrientName":"Fiber, total dietary","nutrientNumber":"291","unitName":"G","value":0,"valueOrigin":"reported","valueStatus":"reported-zero","mappingStatus":"canonical"},
				{"nutrientId":2000,"nutrientName":"Sugars, total including NLEA","nutrientNumber":"269","unitName":"G","value":60,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1093,"nutrientName":"Sodium, Na","nutrientNumber":"307","unitName":"MG","value":10,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"}
			],
			"reportedNutrientIds": [1008,1004,1005,1003,1079,2000,1093],
			"dataType": "Branded",
			"foodIdentityType": "packaged",
			"servingSize": 20,
			"servingSizeUnit": "g",
			"householdServingFullText": "1 tbsp (20 g)",
			"hasSourceServing": true,
			"foodServings": [{"label":"1 tbsp (20 g)","gramWeight":20,"amount":1,"unitKey":"tbsp","isPrimary":true,"measureType":"Package serving","isHouseholdMeasure":true,"sourceMeasureKey":"label-serving","origin":"package-label","gramWeightMethod":"source-reported"}],
			"gtinUpc": "00021130462506",
			"barcode": "00021130462506",
			"ingredients": "Strawberries, sugar, fruit pectin, citric acid.",
			"ingredientList": ["Strawberries","Sugar","Fruit pectin","Citric acid"],
			"allergens": [],
			"traces": [],
			"dietaryTags": ["vegan","vegetarian"],
			"labels": ["Local QA fixture"],
			"packageQuantity": {"label":"18 oz","amount":18,"unit":"oz"},
			"sourceMetadata": {"language":"en","marketCountries":["United States"],"revision":1,"schemaVersion":1,"completeness":1},
			"categories": ["Jams and Preserves"],
			"categoryOptionId": "qa-preserves",
			"barcodeSource": "community",
			"sourceKey": "shared-catalog",
			"sourceLabel": "blendCalc Community",
			"sourceDataType": "local-qa-label",
			"trustStatus": "moderator-reviewed",
			"sharedProductConfidence": "moderator-reviewed"
		}'::jsonb
	),
	(
		'81000000-0000-4000-8000-000000000011',
		'81000000-0000-4000-8000-000000000012',
		'81000000-0000-4000-8000-000000000013',
		'00021130493609',
		'Roasted Onion & Garlic Pasta Sauce',
		'QA Pantry',
		'qa-dips',
		'local-qa-label:00021130493609',
		'{
			"fdcId": 9100002,
			"description": "Roasted Onion & Garlic Pasta Sauce",
			"nameProvenance": "source",
			"brandOwner": "QA Pantry",
			"foodNutrients": [
				{"nutrientId":1008,"nutrientName":"Energy","nutrientNumber":"208","unitName":"KCAL","value":48,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1004,"nutrientName":"Total lipid (fat)","nutrientNumber":"204","unitName":"G","value":1.2,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1005,"nutrientName":"Carbohydrate, by difference","nutrientNumber":"205","unitName":"G","value":8.8,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1003,"nutrientName":"Protein","nutrientNumber":"203","unitName":"G","value":1.6,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1079,"nutrientName":"Fiber, total dietary","nutrientNumber":"291","unitName":"G","value":1.6,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":2000,"nutrientName":"Sugars, total including NLEA","nutrientNumber":"269","unitName":"G","value":4.8,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1093,"nutrientName":"Sodium, Na","nutrientNumber":"307","unitName":"MG","value":440,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"}
			],
			"reportedNutrientIds": [1008,1004,1005,1003,1079,2000,1093],
			"dataType": "Branded",
			"foodIdentityType": "packaged",
			"servingSize": 125,
			"servingSizeUnit": "g",
			"householdServingFullText": "1/2 cup (125 g)",
			"hasSourceServing": true,
			"foodServings": [{"label":"1/2 cup (125 g)","gramWeight":125,"amount":0.5,"unitKey":"cup","isPrimary":true,"measureType":"Package serving","isHouseholdMeasure":true,"sourceMeasureKey":"label-serving","origin":"package-label","gramWeightMethod":"source-reported"}],
			"gtinUpc": "00021130493609",
			"barcode": "00021130493609",
			"ingredients": "Diced tomatoes, tomato puree, olive oil, roasted onions, roasted garlic, salt, sugar, spices.",
			"ingredientList": ["Diced tomatoes","Tomato puree","Olive oil","Roasted onions","Roasted garlic","Salt","Sugar","Spices"],
			"allergens": [],
			"traces": [],
			"dietaryTags": ["vegan","vegetarian"],
			"labels": ["Local QA fixture"],
			"packageQuantity": {"label":"24 oz","amount":24,"unit":"oz"},
			"sourceMetadata": {"language":"en","marketCountries":["United States"],"revision":1,"schemaVersion":1,"completeness":1},
			"categories": ["Dips and Salsa"],
			"categoryOptionId": "qa-dips",
			"barcodeSource": "community",
			"sourceKey": "shared-catalog",
			"sourceLabel": "blendCalc Community",
			"sourceDataType": "local-qa-label",
			"trustStatus": "moderator-reviewed",
			"sharedProductConfidence": "moderator-reviewed"
		}'::jsonb
	),
	(
		'81000000-0000-4000-8000-000000000021',
		'81000000-0000-4000-8000-000000000022',
		'81000000-0000-4000-8000-000000000023',
		'08801005523455',
		'Gochu Jang Hot & Sweet Chili Sauce',
		'QA Pantry',
		'qa-dips',
		'local-qa-label:08801005523455',
		'{
			"fdcId": 9100003,
			"description": "Gochu Jang Hot & Sweet Chili Sauce",
			"nameProvenance": "source",
			"brandOwner": "QA Pantry",
			"foodNutrients": [
				{"nutrientId":1008,"nutrientName":"Energy","nutrientNumber":"208","unitName":"KCAL","value":100,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1004,"nutrientName":"Total lipid (fat)","nutrientNumber":"204","unitName":"G","value":1.67,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1005,"nutrientName":"Carbohydrate, by difference","nutrientNumber":"205","unitName":"G","value":44.44,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1003,"nutrientName":"Protein","nutrientNumber":"203","unitName":"G","value":3.33,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1079,"nutrientName":"Fiber, total dietary","nutrientNumber":"291","unitName":"G","value":5.56,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":2000,"nutrientName":"Sugars, total including NLEA","nutrientNumber":"269","unitName":"G","value":27.78,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1093,"nutrientName":"Sodium, Na","nutrientNumber":"307","unitName":"MG","value":2167,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"}
			],
			"reportedNutrientIds": [1008,1004,1005,1003,1079,2000,1093],
			"dataType": "Branded",
			"foodIdentityType": "packaged",
			"servingSize": 30,
			"servingSizeUnit": "g",
			"householdServingFullText": "2 tbsp (30 g)",
			"hasSourceServing": true,
			"foodServings": [{"label":"2 tbsp (30 g)","gramWeight":30,"amount":2,"unitKey":"tbsp","isPrimary":true,"measureType":"Package serving","isHouseholdMeasure":true,"sourceMeasureKey":"label-serving","origin":"package-label","gramWeightMethod":"source-reported"}],
			"gtinUpc": "08801005523455",
			"barcode": "08801005523455",
			"ingredients": "Red pepper paste (wheat flour, red pepper powder), corn syrup, fermented soybean paste, salt.",
			"ingredientList": ["Red pepper paste","Wheat flour","Red pepper powder","Corn syrup","Fermented soybean paste","Salt"],
			"allergens": ["wheat","soy"],
			"traces": ["peanuts"],
			"dietaryTags": ["vegetarian"],
			"labels": ["Local QA fixture"],
			"packageQuantity": {"label":"500 g","amount":500,"unit":"g"},
			"sourceMetadata": {"language":"en","marketCountries":["United States"],"revision":1,"schemaVersion":1,"completeness":1},
			"categories": ["Dips and Salsa"],
			"categoryOptionId": "qa-dips",
			"barcodeSource": "community",
			"sourceKey": "shared-catalog",
			"sourceLabel": "blendCalc Community",
			"sourceDataType": "local-qa-label",
			"trustStatus": "moderator-reviewed",
			"sharedProductConfidence": "moderator-reviewed"
		}'::jsonb
	),
	(
		'81000000-0000-4000-8000-000000000031',
		'81000000-0000-4000-8000-000000000032',
		'81000000-0000-4000-8000-000000000033',
		'00869759000149',
		'Peanut Butter',
		'QA Pantry',
		'qa-nut-seed-butters',
		'local-qa-label:00869759000149',
		'{
			"fdcId": 9100004,
			"description": "Peanut Butter",
			"nameProvenance": "source",
			"brandOwner": "QA Pantry",
			"foodNutrients": [
				{"nutrientId":1008,"nutrientName":"Energy","nutrientNumber":"208","unitName":"KCAL","value":588,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1004,"nutrientName":"Total lipid (fat)","nutrientNumber":"204","unitName":"G","value":50,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1005,"nutrientName":"Carbohydrate, by difference","nutrientNumber":"205","unitName":"G","value":20,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1003,"nutrientName":"Protein","nutrientNumber":"203","unitName":"G","value":25,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1079,"nutrientName":"Fiber, total dietary","nutrientNumber":"291","unitName":"G","value":6,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":2000,"nutrientName":"Sugars, total including NLEA","nutrientNumber":"269","unitName":"G","value":9,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1093,"nutrientName":"Sodium, Na","nutrientNumber":"307","unitName":"MG","value":400,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"}
			],
			"reportedNutrientIds": [1008,1004,1005,1003,1079,2000,1093],
			"dataType": "Branded",
			"foodIdentityType": "packaged",
			"servingSize": 32,
			"servingSizeUnit": "g",
			"householdServingFullText": "2 tbsp (32 g)",
			"hasSourceServing": true,
			"foodServings": [{"label":"2 tbsp (32 g)","gramWeight":32,"amount":2,"unitKey":"tbsp","isPrimary":true,"measureType":"Package serving","isHouseholdMeasure":true,"sourceMeasureKey":"label-serving","origin":"package-label","gramWeightMethod":"source-reported"}],
			"gtinUpc": "00869759000149",
			"barcode": "00869759000149",
			"ingredients": "Peanuts, salt.",
			"ingredientList": ["Peanuts","Salt"],
			"allergens": ["peanuts"],
			"traces": [],
			"dietaryTags": ["vegan","vegetarian"],
			"labels": ["Local QA fixture"],
			"packageQuantity": {"label":"16 oz","amount":16,"unit":"oz"},
			"sourceMetadata": {"language":"en","marketCountries":["United States"],"revision":1,"schemaVersion":1,"completeness":1},
			"categories": ["Nut & Seed Butters"],
			"categoryOptionId": "qa-nut-seed-butters",
			"barcodeSource": "community",
			"sourceKey": "shared-catalog",
			"sourceLabel": "blendCalc Community",
			"sourceDataType": "local-qa-label",
			"trustStatus": "moderator-reviewed",
			"sharedProductConfidence": "moderator-reviewed"
		}'::jsonb
	),
	(
		'81000000-0000-4000-8000-000000000041',
		'81000000-0000-4000-8000-000000000042',
		'81000000-0000-4000-8000-000000000043',
		'00011110904416',
		'Blue Agave Light Golden Syrup',
		'QA Pantry',
		'qa-sweets',
		'local-qa-label:00011110904416',
		'{
			"fdcId": 9100005,
			"description": "Blue Agave Light Golden Syrup",
			"nameProvenance": "source",
			"brandOwner": "QA Pantry",
			"foodNutrients": [
				{"nutrientId":1008,"nutrientName":"Energy","nutrientNumber":"208","unitName":"KCAL","value":310,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1004,"nutrientName":"Total lipid (fat)","nutrientNumber":"204","unitName":"G","value":0,"valueOrigin":"reported","valueStatus":"reported-zero","mappingStatus":"canonical"},
				{"nutrientId":1005,"nutrientName":"Carbohydrate, by difference","nutrientNumber":"205","unitName":"G","value":76,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1003,"nutrientName":"Protein","nutrientNumber":"203","unitName":"G","value":0,"valueOrigin":"reported","valueStatus":"reported-zero","mappingStatus":"canonical"},
				{"nutrientId":2000,"nutrientName":"Sugars, total including NLEA","nutrientNumber":"269","unitName":"G","value":76,"valueOrigin":"reported","valueStatus":"reported","mappingStatus":"canonical"},
				{"nutrientId":1093,"nutrientName":"Sodium, Na","nutrientNumber":"307","unitName":"MG","value":0,"valueOrigin":"reported","valueStatus":"reported-zero","mappingStatus":"canonical"}
			],
			"reportedNutrientIds": [1008,1004,1005,1003,2000,1093],
			"dataType": "Branded",
			"foodIdentityType": "packaged",
			"hasSourceServing": false,
			"foodServings": [],
			"gtinUpc": "00011110904416",
			"barcode": "00011110904416",
			"ingredients": "Organic blue agave syrup.",
			"ingredientList": ["Organic blue agave syrup"],
			"allergens": [],
			"traces": [],
			"dietaryTags": ["vegan","vegetarian"],
			"labels": ["Local QA fixture"],
			"packageQuantity": {"label":"23.5 oz","amount":23.5,"unit":"oz"},
			"sourceMetadata": {"language":"en","marketCountries":["United States"],"revision":1,"schemaVersion":1,"completeness":0.85,"qualityWarningTags":["serving-not-reported"]},
			"categories": ["Sweets"],
			"categoryOptionId": "qa-sweets",
			"barcodeSource": "community",
			"sourceKey": "shared-catalog",
			"sourceLabel": "blendCalc Community",
			"sourceDataType": "local-qa-label",
			"trustStatus": "moderator-reviewed",
			"sharedProductConfidence": "moderator-reviewed"
		}'::jsonb
	);

with qa_generic_foods (
	fixture_number,
	barcode,
	fdc_id,
	product_name,
	category_option_id,
	category_label,
	calories,
	total_fat,
	total_carbohydrates,
	protein,
	dietary_fiber,
	total_sugars,
	sodium,
	serving_grams,
	serving_amount,
	serving_unit,
	serving_label,
	ingredients,
	ingredient_list,
	allergens,
	dietary_tags
) as (
	values
		(1, '09000000000018', 9200001, 'Spinach, Raw', 'qa-vegetables', 'Vegetables and Vegetable Products', 23::numeric, 0.39::numeric, 3.63::numeric, 2.86::numeric, 2.2::numeric, 0.42::numeric, 79::numeric, 30::numeric, 1::numeric, 'cup', '1 cup (30 g)', 'Spinach.', '["Spinach"]'::jsonb, '[]'::jsonb, '["vegan","vegetarian"]'::jsonb),
		(2, '09000000000025', 9200002, 'Banana, Raw', 'qa-fruit', 'Fruits and Fruit Juices', 89, 0.33, 22.84, 1.09, 2.6, 12.23, 1, 118, 1, null::text, '1 medium banana (118 g)', 'Banana.', '["Banana"]'::jsonb, '[]'::jsonb, '["vegan","vegetarian"]'::jsonb),
		(3, '09000000000032', 9200003, 'Greek Yogurt, Plain', 'qa-yogurts', 'Yogurts', 59, 0.39, 3.6, 10.19, 0, 3.24, 36, 170, 0.75, 'cup', '3/4 cup (170 g)', 'Cultured milk.', '["Cultured milk"]'::jsonb, '["milk"]'::jsonb, '["vegetarian"]'::jsonb),
		(4, '09000000000049', 9200004, 'Chia Seeds, Dried', 'qa-nuts', 'Nut and Seed Products', 486, 30.74, 42.12, 16.54, 34.4, 0, 16, 28, 2, 'tbsp', '2 tbsp (28 g)', 'Chia seeds.', '["Chia seeds"]'::jsonb, '[]'::jsonb, '["vegan","vegetarian"]'::jsonb),
		(5, '09000000000056', 9200005, 'Blueberries, Raw', 'qa-fruit', 'Fruits and Fruit Juices', 57, 0.33, 14.49, 0.74, 2.4, 9.96, 1, 148, 1, 'cup', '1 cup (148 g)', 'Blueberries.', '["Blueberries"]'::jsonb, '[]'::jsonb, '["vegan","vegetarian"]'::jsonb),
		(6, '09000000000063', 9200006, 'Almond Milk, Unsweetened', 'qa-beverages', 'Beverages', 15, 1.1, 0.3, 0.4, 0.2, 0, 63, 240, 1, 'cup', '1 cup (240 g)', 'Water, almonds, sea salt.', '["Water","Almonds","Sea salt"]'::jsonb, '["tree-nut"]'::jsonb, '["vegan","vegetarian"]'::jsonb),
		(7, '09000000000070', 9200007, 'Flax Seeds, Dried', 'qa-nuts', 'Nut and Seed Products', 534, 42.16, 28.88, 18.29, 27.3, 1.55, 30, 10, 1, 'tbsp', '1 tbsp (10 g)', 'Flax seeds.', '["Flax seeds"]'::jsonb, '[]'::jsonb, '["vegan","vegetarian"]'::jsonb),
		(8, '09000000000087', 9200008, 'Mango, Raw', 'qa-fruit', 'Fruits and Fruit Juices', 60, 0.38, 14.98, 0.82, 1.6, 13.66, 1, 165, 1, 'cup', '1 cup (165 g)', 'Mango.', '["Mango"]'::jsonb, '[]'::jsonb, '["vegan","vegetarian"]'::jsonb),
		(9, '09000000000094', 9200009, 'Pineapple, Raw', 'qa-fruit', 'Fruits and Fruit Juices', 50, 0.12, 13.12, 0.54, 1.4, 9.85, 1, 165, 1, 'cup', '1 cup (165 g)', 'Pineapple.', '["Pineapple"]'::jsonb, '[]'::jsonb, '["vegan","vegetarian"]'::jsonb),
		(10, '09000000000100', 9200010, 'Ginger Root, Raw', 'qa-spices', 'Spices and Herbs', 80, 0.75, 17.77, 1.82, 2, 1.7, 13, 5, 1, 'tsp', '1 tsp (5 g)', 'Ginger root.', '["Ginger root"]'::jsonb, '[]'::jsonb, '["vegan","vegetarian"]'::jsonb),
		(11, '09000000000117', 9200011, 'Strawberries, Raw', 'qa-fruit', 'Fruits and Fruit Juices', 32, 0.3, 7.68, 0.67, 2, 4.89, 1, 152, 1, 'cup', '1 cup (152 g)', 'Strawberries.', '["Strawberries"]'::jsonb, '[]'::jsonb, '["vegan","vegetarian"]'::jsonb),
		(12, '09000000000124', 9200012, 'Ground Beef, 85% Lean, Cooked', 'qa-beef', 'Beef Products', 250, 15, 0, 26, 0, 0, 72, 113, 4, 'oz', '4 oz (113 g)', 'Beef.', '["Beef"]'::jsonb, '[]'::jsonb, '[]'::jsonb),
		(13, '09000000000131', 9200013, 'Shrimp, Cooked', 'qa-seafood', 'Finfish and Shellfish Products', 99, 0.3, 0.2, 24, 0, 0, 111, 85, 3, 'oz', '3 oz (85 g)', 'Shrimp.', '["Shrimp"]'::jsonb, '["shellfish"]'::jsonb, '[]'::jsonb),
		(14, '09000000000148', 9200014, 'Egg, Whole, Cooked', 'qa-dairy', 'Dairy and Egg Products', 155, 10.6, 1.12, 12.6, 0, 1.12, 124, 50, 1, null::text, '1 large egg (50 g)', 'Egg.', '["Egg"]'::jsonb, '["egg"]'::jsonb, '["vegetarian"]'::jsonb),
		(15, '09000000000155', 9200015, 'Tomato, Roma, Raw', 'qa-vegetables', 'Vegetables and Vegetable Products', 18, 0.2, 3.9, 0.9, 1.2, 2.6, 5, 62, 1, null::text, '1 medium tomato (62 g)', 'Roma tomato.', '["Roma tomato"]'::jsonb, '[]'::jsonb, '["vegan","vegetarian"]'::jsonb),
		(16, '09000000000162', 9200016, 'Lemon Juice, Raw', 'qa-fruit', 'Fruits and Fruit Juices', 22, 0.24, 6.9, 0.35, 0.3, 2.52, 1, 15, 1, 'tbsp', '1 tbsp (15 g)', 'Lemon juice.', '["Lemon juice"]'::jsonb, '[]'::jsonb, '["vegan","vegetarian"]'::jsonb),
		(17, '09000000000179', 170456, 'Tomatoes, Green, Raw', 'qa-vegetables', 'Vegetables and Vegetable Products', 23, 0.2, 5.1, 1.2, 1.1, 4, 13, 180, 1, 'cup', '1 cup (180 g)', 'Green tomato.', '["Green tomato"]'::jsonb, '[]'::jsonb, '["vegan","vegetarian"]'::jsonb)
)
insert into private.qa_catalog_product_fixtures (
	product_id,
	revision_id,
	observation_id,
	barcode,
	product_name,
	brand_owner,
	category_option_id,
	source_reference,
	food
)
select
	('82000000-0000-4000-8000-' || lpad((fixture_number * 10 + 1)::text, 12, '0'))::uuid,
	('82000000-0000-4000-8000-' || lpad((fixture_number * 10 + 2)::text, 12, '0'))::uuid,
	('82000000-0000-4000-8000-' || lpad((fixture_number * 10 + 3)::text, 12, '0'))::uuid,
	barcode,
	product_name,
	'blendCalc QA Foods',
	category_option_id,
	'local-qa-generic:' || barcode,
	jsonb_build_object(
		'fdcId', fdc_id,
		'description', product_name,
		'nameProvenance', 'source',
		'brandOwner', 'blendCalc QA Foods',
		'foodNutrients', jsonb_build_array(
			jsonb_build_object('nutrientId', 1008, 'nutrientName', 'Energy', 'nutrientNumber', '208', 'unitName', 'KCAL', 'value', calories, 'valueOrigin', 'reported', 'valueStatus', case when calories = 0 then 'reported-zero' else 'reported' end, 'mappingStatus', 'canonical'),
			jsonb_build_object('nutrientId', 1004, 'nutrientName', 'Total lipid (fat)', 'nutrientNumber', '204', 'unitName', 'G', 'value', total_fat, 'valueOrigin', 'reported', 'valueStatus', case when total_fat = 0 then 'reported-zero' else 'reported' end, 'mappingStatus', 'canonical'),
			jsonb_build_object('nutrientId', 1005, 'nutrientName', 'Carbohydrate, by difference', 'nutrientNumber', '205', 'unitName', 'G', 'value', total_carbohydrates, 'valueOrigin', 'reported', 'valueStatus', case when total_carbohydrates = 0 then 'reported-zero' else 'reported' end, 'mappingStatus', 'canonical'),
			jsonb_build_object('nutrientId', 1003, 'nutrientName', 'Protein', 'nutrientNumber', '203', 'unitName', 'G', 'value', protein, 'valueOrigin', 'reported', 'valueStatus', case when protein = 0 then 'reported-zero' else 'reported' end, 'mappingStatus', 'canonical'),
			jsonb_build_object('nutrientId', 1079, 'nutrientName', 'Fiber, total dietary', 'nutrientNumber', '291', 'unitName', 'G', 'value', dietary_fiber, 'valueOrigin', 'reported', 'valueStatus', case when dietary_fiber = 0 then 'reported-zero' else 'reported' end, 'mappingStatus', 'canonical'),
			jsonb_build_object('nutrientId', 2000, 'nutrientName', 'Sugars, total including NLEA', 'nutrientNumber', '269', 'unitName', 'G', 'value', total_sugars, 'valueOrigin', 'reported', 'valueStatus', case when total_sugars = 0 then 'reported-zero' else 'reported' end, 'mappingStatus', 'canonical'),
			jsonb_build_object('nutrientId', 1093, 'nutrientName', 'Sodium, Na', 'nutrientNumber', '307', 'unitName', 'MG', 'value', sodium, 'valueOrigin', 'reported', 'valueStatus', case when sodium = 0 then 'reported-zero' else 'reported' end, 'mappingStatus', 'canonical')
		),
		'reportedNutrientIds', jsonb_build_array(1008, 1004, 1005, 1003, 1079, 2000, 1093),
		'dataType', 'Foundation',
		'foodIdentityType', 'generic',
		'foodCategory', category_label,
		'servingSize', serving_grams,
		'servingSizeUnit', 'g',
		'householdServingFullText', serving_label,
		'hasSourceServing', true,
		'foodServings', jsonb_build_array(jsonb_build_object(
			'label', serving_label,
			'gramWeight', serving_grams,
			'amount', case when serving_unit is null then null else serving_amount end,
			'unitKey', serving_unit,
			'isPrimary', true,
			'measureType', 'Source serving',
			'isHouseholdMeasure', true,
			'sourceMeasureKey', 'qa-source-serving',
			'origin', 'source-household-measure',
			'gramWeightMethod', 'source-reported'
		)),
		'gtinUpc', barcode,
		'barcode', barcode,
		'ingredients', ingredients,
		'ingredientList', ingredient_list,
		'allergens', allergens,
		'traces', jsonb_build_array(),
		'dietaryTags', dietary_tags,
		'labels', jsonb_build_array('Local QA fixture'),
		'sourceMetadata', jsonb_build_object('language', 'en', 'marketCountries', jsonb_build_array('United States'), 'revision', 1, 'schemaVersion', 1, 'completeness', 1),
		'categories', jsonb_build_array(category_label),
		'categoryOptionId', category_option_id,
		'barcodeSource', 'community',
		'sourceKey', 'shared-catalog',
		'sourceLabel', 'blendCalc Community',
		'sourceDataType', 'local-qa-generic',
		'trustStatus', 'moderator-reviewed',
		'sharedProductConfidence', 'moderator-reviewed'
	)
from qa_generic_foods;

delete from public.food_nutrients
where shared_product_id in (select product_id from private.qa_catalog_product_fixtures);
delete from public.food_servings
where shared_product_id in (select product_id from private.qa_catalog_product_fixtures);
delete from public.shared_product_field_provenance
where shared_product_id in (select product_id from private.qa_catalog_product_fixtures);

-- Local catalog fixtures are authored directly rather than submitted by a QA user.
-- Disable only the submission-derived category trigger while inserting them; the
-- fixtures still provide a valid canonical category and all other product triggers run.
alter table public.shared_products
	disable trigger set_shared_product_category_from_submission;

insert into public.shared_products (
	id,
	barcode,
	product_name,
	brand_owner,
	search_text,
	category_option_id,
	food,
	source,
	source_reference,
	confidence,
	status,
	last_verified_at,
	canonical_provenance
)
select
	product_id,
	barcode,
	product_name,
	brand_owner,
	lower(concat_ws(' ', product_name, brand_owner, barcode)),
	category_option_id,
	food,
	'community-reviewed',
	source_reference,
	'moderator-reviewed',
	'active',
	'2026-08-01T00:00:00Z',
	jsonb_build_object(
		'fixture', true,
		'source', 'user-label',
		'sourceReference', source_reference,
		'verificationMethod', 'label-review'
	)
from private.qa_catalog_product_fixtures
on conflict (barcode) do update set
	product_name = excluded.product_name,
	brand_owner = excluded.brand_owner,
	search_text = excluded.search_text,
	category_option_id = excluded.category_option_id,
	food = excluded.food,
	source = excluded.source,
	source_reference = excluded.source_reference,
	confidence = excluded.confidence,
	status = excluded.status,
	last_verified_at = excluded.last_verified_at,
	canonical_provenance = excluded.canonical_provenance;

alter table public.shared_products
	enable trigger set_shared_product_category_from_submission;

insert into public.shared_product_revisions (
	id,
	shared_product_id,
	revision_number,
	category_option_id,
	food,
	source,
	source_reference,
	change_summary,
	label_observed_at
)
select
	revision_id,
	product_id,
	1,
	category_option_id,
	food,
	'community-reviewed',
	source_reference,
	'{"version":1,"fixture":true,"changes":[]}'::jsonb,
	'2026-08-01T00:00:00Z'
from private.qa_catalog_product_fixtures
on conflict (id) do update set
	category_option_id = excluded.category_option_id,
	food = excluded.food,
	source = excluded.source,
	source_reference = excluded.source_reference,
	change_summary = excluded.change_summary,
	label_observed_at = excluded.label_observed_at;

insert into public.shared_product_observations (
	id,
	barcode,
	source,
	source_reference,
	source_license,
	raw_payload,
	normalized_food,
	content_hash,
	observed_at
)
select
	observation_id,
	barcode,
	'user-label',
	source_reference,
	'Local QA fixture',
	jsonb_build_object('fixture', true, 'fixtureVersion', 1, 'label', food),
	food,
	encode(extensions.digest(source_reference || food::text, 'sha256'), 'hex'),
	'2026-08-01T00:00:00Z'
from private.qa_catalog_product_fixtures
on conflict (id) do update set
	source_reference = excluded.source_reference,
	source_license = excluded.source_license,
	raw_payload = excluded.raw_payload,
	normalized_food = excluded.normalized_food,
	content_hash = excluded.content_hash,
	observed_at = excluded.observed_at;

with selected_fields as (
	select
		fixture.product_id,
		fixture.observation_id,
		field.field_path,
		field.field_value
	from private.qa_catalog_product_fixtures fixture
	join public.custom_food_category_options category
		on category.id = fixture.category_option_id
	cross join lateral (
		values
			('productName', to_jsonb(fixture.product_name)),
			('brandOwner', to_jsonb(fixture.brand_owner)),
			('categories', to_jsonb(array[category.label])),
			('ingredients', fixture.food -> 'ingredients'),
			('allergens', fixture.food -> 'allergens'),
			('traces', fixture.food -> 'traces'),
			('dietaryTags', fixture.food -> 'dietaryTags'),
			('labels', fixture.food -> 'labels'),
			('package', fixture.food -> 'packageQuantity'),
			('sourceMetadata', fixture.food -> 'sourceMetadata'),
			('serving', fixture.food -> 'foodServings'),
			('nutrition', fixture.food -> 'foodNutrients')
	) field(field_path, field_value)
	where field.field_value is not null
), nutrient_fields as (
	select
		fixture.product_id,
		fixture.observation_id,
		'nutrient:' || (nutrient.value ->> 'nutrientId') as field_path,
		nutrient.value as field_value
	from private.qa_catalog_product_fixtures fixture
	cross join lateral jsonb_array_elements(fixture.food -> 'foodNutrients') nutrient(value)
)
insert into public.shared_product_field_provenance (
	shared_product_id,
	observation_id,
	field_path,
	source_value,
	normalized_value,
	selected,
	confidence,
	verification_method
)
select
	product_id,
	observation_id,
	field_path,
	field_value,
	field_value,
	true,
	'moderator-reviewed',
	'label-review'
from (
	select * from selected_fields
	union all
	select * from nutrient_fields
) fields
on conflict (shared_product_id, observation_id, field_path) do update set
	source_value = excluded.source_value,
	normalized_value = excluded.normalized_value,
	selected = excluded.selected,
	confidence = excluded.confidence,
	verification_method = excluded.verification_method;

insert into public.food_nutrients (
	shared_product_id,
	nutrient_id,
	amount_per_100g,
	unit_name,
	value_origin,
	source,
	source_reference,
	source_observation_id,
	confidence,
	value_status,
	source_nutrient_key,
	mapping_status,
	mapping_method,
	mapping_review_reference
)
select
	fixture.product_id,
	(nutrient.value ->> 'nutrientId')::bigint,
	(nutrient.value ->> 'value')::numeric,
	nutrient.value ->> 'unitName',
	nutrient.value ->> 'valueOrigin',
	'user-label',
	fixture.source_reference,
	fixture.observation_id,
	'moderator-reviewed',
	nutrient.value ->> 'valueStatus',
	'local-qa:' || (nutrient.value ->> 'nutrientId'),
	'canonical',
	'local-qa-label-fixture',
	'docs/database-testing.md'
from private.qa_catalog_product_fixtures fixture
cross join lateral jsonb_array_elements(fixture.food -> 'foodNutrients') nutrient(value)
on conflict (shared_product_id, nutrient_id) where shared_product_id is not null
do update set
	amount_per_100g = excluded.amount_per_100g,
	unit_name = excluded.unit_name,
	value_origin = excluded.value_origin,
	source = excluded.source,
	source_reference = excluded.source_reference,
	source_observation_id = excluded.source_observation_id,
	confidence = excluded.confidence,
	value_status = excluded.value_status,
	source_nutrient_key = excluded.source_nutrient_key,
	mapping_status = excluded.mapping_status,
	mapping_method = excluded.mapping_method,
	mapping_review_reference = excluded.mapping_review_reference;

insert into public.food_servings (
	shared_product_id,
	serving_order,
	label,
	gram_weight,
	amount,
	unit_key,
	is_primary,
	measure_type,
	is_household_measure,
	source_measure_key,
	origin,
	gram_weight_method,
	source,
	source_reference,
	source_observation_id,
	confidence
)
select
	fixture.product_id,
	serving.position::smallint,
	serving.value ->> 'label',
	(serving.value ->> 'gramWeight')::numeric,
	(serving.value ->> 'amount')::numeric,
	serving.value ->> 'unitKey',
	(serving.value ->> 'isPrimary')::boolean,
	serving.value ->> 'measureType',
	(serving.value ->> 'isHouseholdMeasure')::boolean,
	serving.value ->> 'sourceMeasureKey',
	serving.value ->> 'origin',
	serving.value ->> 'gramWeightMethod',
	'user-label',
	fixture.source_reference,
	fixture.observation_id,
	'moderator-reviewed'
from private.qa_catalog_product_fixtures fixture
cross join lateral jsonb_array_elements(fixture.food -> 'foodServings')
	with ordinality serving(value, position)
on conflict (shared_product_id, serving_order) where shared_product_id is not null
do update set
	label = excluded.label,
	gram_weight = excluded.gram_weight,
	amount = excluded.amount,
	unit_key = excluded.unit_key,
	is_primary = excluded.is_primary,
	measure_type = excluded.measure_type,
	is_household_measure = excluded.is_household_measure,
	source_measure_key = excluded.source_measure_key,
	origin = excluded.origin,
	gram_weight_method = excluded.gram_weight_method,
	source = excluded.source,
	source_reference = excluded.source_reference,
	source_observation_id = excluded.source_observation_id,
	confidence = excluded.confidence;

drop table private.qa_catalog_product_fixtures;
end
$catalog_fixtures$;

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
