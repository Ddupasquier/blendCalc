insert into public.product_data_sources (
	key,
	display_name,
	source_type,
	homepage_url,
	terms_url,
	attribution_text,
	enabled,
	provenance
)
values (
	'nutrition-label-ocr',
	'Nutrition label text recognition',
	'internal_catalog',
	'https://github.com/naptha/tesseract.js',
	'https://github.com/naptha/tesseract.js/blob/master/LICENSE.md',
	'Text recognition powered by Tesseract.js (Apache-2.0). Confirmed values remain user-label data.',
	true,
	jsonb_build_object(
		'processing_kind', 'on_device_ocr',
		'library', 'tesseract.js',
		'library_version', '7.0.0',
		'requires_user_confirmation', true,
		'output_source_key', 'user-label'
	)
)
on conflict (key) do update
set
	display_name = excluded.display_name,
	source_type = excluded.source_type,
	homepage_url = excluded.homepage_url,
	terms_url = excluded.terms_url,
	attribution_text = excluded.attribution_text,
	enabled = excluded.enabled,
	provenance = excluded.provenance;

with label_aliases (
	source_nutrient_key,
	source_unit_name,
	source_nutrient_name,
	nutrient_number,
	priority
) as (
	values
		('calories', 'KCAL', 'Calories', '208', 10),
		('total fat', 'G', 'Total Fat', '204', 10),
		('saturated fat', 'G', 'Saturated Fat', '606', 10),
		('sat fat', 'G', 'Saturated Fat', '606', 20),
		('trans fat', 'G', 'Trans Fat', '605', 10),
		('cholesterol', 'MG', 'Cholesterol', '601', 10),
		('sodium', 'MG', 'Sodium', '307', 10),
		('total carbohydrate', 'G', 'Total Carbohydrate', '205', 10),
		('total carbohydrates', 'G', 'Total Carbohydrate', '205', 20),
		('total carb', 'G', 'Total Carbohydrate', '205', 30),
		('dietary fiber', 'G', 'Dietary Fiber', '291', 10),
		('dietary fibre', 'G', 'Dietary Fiber', '291', 20),
		('total sugars', 'G', 'Total Sugars', '269', 10),
		('sugars', 'G', 'Total Sugars', '269', 30),
		('added sugars', 'G', 'Added Sugars', '539', 10),
		('added sugar', 'G', 'Added Sugars', '539', 20),
		('protein', 'G', 'Protein', '203', 10),
		('vitamin d', 'UG', 'Vitamin D', '328', 10),
		('vitamin d', 'IU', 'Vitamin D', '328', 20),
		('calcium', 'MG', 'Calcium', '301', 10),
		('iron', 'MG', 'Iron', '303', 10),
		('potassium', 'MG', 'Potassium', '306', 10)
)
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
	provenance
)
select
	'nutrition-label-ocr',
	label_aliases.source_nutrient_key,
	label_aliases.source_unit_name,
	label_aliases.source_nutrient_name,
	definitions.nutrient_id,
	label_aliases.priority,
	'moderator_verified',
	1,
	true,
	jsonb_build_object(
		'mapping_scope', 'us_nutrition_facts_label',
		'requires_user_confirmation', true
	)
from label_aliases
join public.nutrient_definitions definitions
	on definitions.nutrient_number = label_aliases.nutrient_number
on conflict (source_key, source_nutrient_key, source_unit_name) do update
set
	source_nutrient_name = excluded.source_nutrient_name,
	nutrient_id = excluded.nutrient_id,
	priority = excluded.priority,
	mapping_method = excluded.mapping_method,
	confidence = excluded.confidence,
	enabled = excluded.enabled,
	provenance = excluded.provenance;

insert into public.nutrient_unit_conversions (
	source_key,
	nutrient_id,
	from_unit_name,
	to_unit_name,
	multiplier,
	conversion_method,
	confidence,
	provenance
)
select
	'nutrition-label-ocr',
	definitions.nutrient_id,
	'IU',
	'UG',
	0.025,
	'moderator_verified',
	1,
	jsonb_build_object(
		'nutrient', 'vitamin D',
		'requires_user_confirmation', true
	)
from public.nutrient_definitions definitions
where definitions.nutrient_number = '328'
on conflict (source_key, nutrient_id, from_unit_name, to_unit_name) do update
set
	multiplier = excluded.multiplier,
	conversion_method = excluded.conversion_method,
	confidence = excluded.confidence,
	provenance = excluded.provenance;
