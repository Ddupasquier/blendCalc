begin;

select plan(4);

select is(
	(
		select count(*)::integer
		from public.nutrient_source_mappings mapping
		where mapping.source_key = 'open-food-facts'
			and (mapping.source_nutrient_key, mapping.source_unit_name, mapping.nutrient_id) in (
				('calcium', 'G', 1087),
				('iron', 'G', 1089),
				('potassium', 'G', 1092),
				('vitamin-d', 'G', 1114)
			)
			and mapping.enabled
			and mapping.review_status = 'approved'
	),
	4,
	'the four gram-based Open Food Facts micronutrients have approved mappings'
);

select is(
	(
		select count(*)::integer
		from public.nutrient_unit_conversions conversion
		where conversion.source_key = 'open-food-facts'
			and (conversion.nutrient_id, conversion.from_unit_name, conversion.to_unit_name, conversion.multiplier) in (
				(1087, 'G', 'MG', 1000),
				(1089, 'G', 'MG', 1000),
				(1092, 'G', 'MG', 1000),
				(1114, 'G', 'UG', 1000000)
			)
	),
	4,
	'the four micronutrient mappings have reviewed exact-unit conversions'
);

select is(
	(
		select count(*)::integer
		from public.nutrient_manual_entry_fields field
		join public.nutrient_manual_entry_groups nutrient_group
			on nutrient_group.id = field.group_id
		where field.nutrient_id in (1087, 1089, 1092, 1114)
			and field.enabled
			and nutrient_group.entry_step = 'extended'
	),
	4,
	'the mapped micronutrients are editable in the Extended step'
);

select is(
	(
		select count(distinct mapping.nutrient_id)::integer
		from public.nutrient_source_mappings mapping
		where mapping.source_key = 'open-food-facts'
			and mapping.source_nutrient_key in ('calcium', 'iron', 'potassium', 'vitamin-d')
			and mapping.source_unit_name = 'G'
			and mapping.enabled
	),
	4,
	'each reviewed source key resolves to one canonical nutrient'
);

select * from finish();

rollback;
