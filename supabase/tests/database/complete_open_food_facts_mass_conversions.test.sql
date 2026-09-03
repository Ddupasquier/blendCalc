begin;

select plan(2);

select is(
	(
		select count(*)::integer
		from public.nutrient_unit_conversions conversion
		where conversion.source_key = 'open-food-facts'
			and (
				conversion.nutrient_id,
				conversion.from_unit_name,
				conversion.to_unit_name,
				conversion.multiplier
			) in (
				(1093, 'G', 'MG', 1000),
				(1253, 'G', 'MG', 1000)
			)
	),
	2,
	'Open Food Facts sodium and cholesterol use reviewed gram-to-milligram conversions'
);

select is(
	(
		select count(*)::integer
		from public.nutrient_source_mappings mapping
		where mapping.source_key = 'open-food-facts'
			and (
				mapping.source_nutrient_key,
				mapping.source_unit_name,
				mapping.nutrient_id
			) in (
				('sodium', 'G', 1093),
				('cholesterol', 'G', 1253)
			)
			and mapping.enabled
			and mapping.review_status = 'approved'
	),
	2,
	'the matching source nutrient identities remain approved'
);

select * from finish();

rollback;
