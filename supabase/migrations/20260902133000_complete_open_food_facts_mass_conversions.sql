insert into public.nutrient_unit_conversions (
	source_key,
	nutrient_id,
	from_unit_name,
	to_unit_name,
	multiplier,
	conversion_method,
	confidence,
	observation_count,
	provenance
)
values
	(
		'open-food-facts',
		1093,
		'G',
		'MG',
		1000,
		'reviewed_standard',
		1,
		1,
		jsonb_build_object(
			'sourceReference', 'https://ucum.org/ucum',
			'reviewedExampleBarcode', '00030000581728',
			'rule', 'grams to milligrams'
		)
	),
	(
		'open-food-facts',
		1253,
		'G',
		'MG',
		1000,
		'reviewed_standard',
		1,
		1,
		jsonb_build_object(
			'sourceReference', 'https://ucum.org/ucum',
			'reviewedExampleBarcode', '00030000581728',
			'rule', 'grams to milligrams'
		)
	)
on conflict (source_key, nutrient_id, from_unit_name, to_unit_name) do update set
	multiplier = excluded.multiplier,
	conversion_method = excluded.conversion_method,
	confidence = excluded.confidence,
	observation_count = greatest(
		public.nutrient_unit_conversions.observation_count,
		excluded.observation_count
	),
	provenance = public.nutrient_unit_conversions.provenance || excluded.provenance,
	updated_at = now();
