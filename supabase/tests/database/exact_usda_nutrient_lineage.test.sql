begin;

select plan(8);

select has_function(
	'private',
	'enforce_reviewed_food_nutrient_lineage',
	array[]::text[],
	'exact source nutrient lineage has a database enforcement function'
);

select ok(
	not exists (
		select 1
		from public.food_nutrients nutrient
		join public.nutrient_definitions definition
			on definition.nutrient_id = nutrient.nutrient_id
		where nutrient.source = 'usda'
			and nullif(btrim(nutrient.source_reference), '') is not null
			and upper(btrim(nutrient.unit_name)) = upper(definition.default_unit_name)
			and nutrient.mapping_method is null
			and nutrient.mapping_status <> 'canonical'
	),
	'eligible legacy USDA normalized nutrients are backfilled as canonical'
);

select ok(
	not exists (
		select 1
		from public.food_nutrient_measurements measurement
		join public.nutrient_definitions definition
			on definition.nutrient_id = measurement.nutrient_id
		where measurement.source = 'usda'
			and nullif(btrim(measurement.source_reference), '') is not null
			and upper(btrim(measurement.unit_name)) = upper(definition.default_unit_name)
			and measurement.mapping_method is null
			and measurement.mapping_status <> 'canonical'
	),
	'eligible legacy USDA native measurements are backfilled as canonical'
);

update public.food_nutrients nutrient
set
	source_nutrient_key = null,
	source_nutrient_code = null,
	mapping_status = 'unknown',
	mapping_method = null
from public.shared_products product
where product.id = nutrient.shared_product_id
	and product.barcode = '00021130493609'
	and nutrient.source = 'usda';

select ok(
	not exists (
		select 1
		from public.food_nutrients nutrient
		join public.shared_products product on product.id = nutrient.shared_product_id
		where product.barcode = '00021130493609'
			and nutrient.source = 'usda'
			and (
				nutrient.mapping_status <> 'canonical'
				or nutrient.source_nutrient_key <> nutrient.nutrient_id::text
				or nutrient.mapping_method <> 'source-identifier'
			)
	),
	'an exact USDA normalized nutrient automatically recovers identifier lineage'
);

select ok(
	not ('unreviewed_nutrient_mapping' = any(
		public.blendcalc_api_v1_product_readiness_reasons(
			(select id from public.shared_products where barcode = '00021130493609')
		)
	)),
	'exact USDA identifier lineage no longer blocks API publication readiness'
);

update public.food_nutrient_measurements measurement
set
	source_nutrient_key = null,
	source_nutrient_code = null,
	mapping_status = 'unknown',
	mapping_method = null
from public.shared_products product
where product.id = measurement.shared_product_id
	and product.barcode = '00021130493609'
	and measurement.source = 'usda';

select ok(
	not exists (
		select 1
		from public.food_nutrient_measurements measurement
		join public.shared_products product on product.id = measurement.shared_product_id
		where product.barcode = '00021130493609'
			and measurement.source = 'usda'
			and (
				measurement.mapping_status <> 'canonical'
				or measurement.source_nutrient_key <> measurement.nutrient_id::text
				or measurement.mapping_method <> 'source-identifier'
			)
	),
	'an exact USDA native measurement automatically recovers identifier lineage'
);

update public.food_nutrients nutrient
set
	mapping_status = 'canonical',
	mapping_method = 'api_taxonomy_match',
	mapping_review_reference = 'must-not-survive'
from public.shared_products product
where product.id = nutrient.shared_product_id
	and product.barcode = '00021130493609'
	and nutrient.nutrient_id = 1003;

select is(
	(
		select nutrient.mapping_status
		from public.food_nutrients nutrient
		join public.shared_products product on product.id = nutrient.shared_product_id
		where product.barcode = '00021130493609'
			and nutrient.nutrient_id = 1003
	),
	'unmapped',
	'semantic matching remains noncanonical even for a USDA-backed product'
);

select is(
	(
		select nutrient.mapping_review_reference
		from public.food_nutrients nutrient
		join public.shared_products product on product.id = nutrient.shared_product_id
		where product.barcode = '00021130493609'
			and nutrient.nutrient_id = 1003
	),
	null,
	'semantic matching cannot retain review evidence automatically'
);

select * from finish();

rollback;
