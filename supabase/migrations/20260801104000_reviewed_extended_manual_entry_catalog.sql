insert into public.nutrient_definitions (
	nutrient_id,
	nutrient_name,
	nutrient_number,
	default_unit_name
)
values
	(1007, 'Ash', '207', 'G'),
	(1071, 'Resistant starch', null, 'G'),
	(1082, 'Fiber, soluble', null, 'G'),
	(1084, 'Fiber, insoluble', null, 'G'),
	(1086, 'Total sugar alcohols', null, 'G'),
	(1099, 'Fluoride, F', null, 'UG'),
	(1102, 'Molybdenum, Mo', null, 'UG'),
	(1210, 'Tryptophan', '501', 'G'),
	(1211, 'Threonine', '502', 'G'),
	(1212, 'Isoleucine', '503', 'G'),
	(1213, 'Leucine', '504', 'G'),
	(1214, 'Lysine', '505', 'G'),
	(1215, 'Methionine', '506', 'G'),
	(1216, 'Cystine', '507', 'G'),
	(1217, 'Phenylalanine', '508', 'G'),
	(1218, 'Tyrosine', '509', 'G'),
	(1219, 'Valine', '510', 'G'),
	(1220, 'Arginine', '511', 'G'),
	(1221, 'Histidine', '512', 'G'),
	(1222, 'Alanine', '513', 'G'),
	(1223, 'Aspartic acid', '514', 'G'),
	(1224, 'Glutamic acid', '515', 'G'),
	(1225, 'Glycine', '516', 'G'),
	(1226, 'Proline', '517', 'G'),
	(1227, 'Serine', '518', 'G'),
	(1228, 'Hydroxyproline', '521', 'G'),
	(1329, 'Fatty acids, total trans-monoenoic', null, 'G'),
	(1330, 'Fatty acids, total trans-dienoic', null, 'G'),
	(1331, 'Fatty acids, total trans-polyenoic', null, 'G'),
	(2028, 'trans-beta-Carotene', null, 'UG'),
	(2029, 'trans-Lycopene', null, 'UG'),
	(2033, 'Total dietary fiber (AOAC 2011.25)', null, 'G'),
	(2038, 'High molecular weight dietary fiber (HMWDF)', null, 'G'),
	(2065, 'Low molecular weight dietary fiber (LMWDF)', null, 'G')
on conflict (nutrient_id) do nothing;

insert into public.nutrient_manual_entry_groups (
	id,
	entry_step,
	title,
	sort_order,
	enabled,
	group_role,
	source_count,
	observation_count,
	verification_status,
	sources,
	last_observed_at
)
values
	('required-basics', 'macros', 'Required basics', 10, true, 'display', 1, 0, 'single_source', array['blendcalc-reviewed-policy'], null),
	('carbohydrate-details', 'macros', 'Carbohydrate details', 20, true, 'display', 1, 0, 'single_source', array['blendcalc-reviewed-policy'], null),
	('fat-details', 'macros', 'Fat details', 30, true, 'display', 1, 0, 'single_source', array['blendcalc-reviewed-policy'], null),
	('vitamins', 'extended', 'Vitamins', 10, true, 'display', 1, 0, 'single_source', array['blendcalc-reviewed-policy'], null),
	('minerals', 'extended', 'Minerals', 20, true, 'display', 1, 0, 'single_source', array['blendcalc-reviewed-policy'], null),
	('carotenoids', 'extended', 'Carotenoids', 40, true, 'display', 1, 0, 'single_source', array['blendcalc-reviewed-policy'], null),
	('advanced-carbohydrate-details', 'extended', 'Advanced carbohydrate details', 50, true, 'display', 1, 0, 'single_source', array['blendcalc-reviewed-policy'], null),
	('advanced-fat-details', 'extended', 'Advanced fat details', 60, true, 'display', 1, 0, 'single_source', array['blendcalc-reviewed-policy'], null),
	('amino-acids', 'extended', 'Amino acids', 70, true, 'display', 1, 0, 'single_source', array['blendcalc-reviewed-policy'], null),
	('other-nutrients', 'extended', 'Other nutrients', 90, true, 'display', 1, 0, 'single_source', array['blendcalc-reviewed-policy'], null)
on conflict (id) do update set
	entry_step = excluded.entry_step,
	title = excluded.title,
	sort_order = excluded.sort_order,
	enabled = excluded.enabled,
	group_role = excluded.group_role,
	source_count = greatest(public.nutrient_manual_entry_groups.source_count, excluded.source_count),
	verification_status = excluded.verification_status,
	sources = (
		select array_agg(distinct source_key order by source_key)
		from unnest(public.nutrient_manual_entry_groups.sources || excluded.sources) source_key
	),
	updated_at = now();

with approved_fields (
	nutrient_id,
	group_id,
	nutrient_type,
	display_label,
	sort_order,
	dedupe_key
) as (
	values
		(1082::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Fiber, Soluble (g)', 10, 'extended:advanced-carbohydrate-details:fiber soluble:g'),
		(1084::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Fiber, Insoluble (g)', 20, 'extended:advanced-carbohydrate-details:fiber insoluble:g'),
		(2038::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'High Molecular Weight Dietary Fiber (HMWDF) (g)', 30, 'extended:advanced-carbohydrate-details:high molecular weight dietary fiber:g'),
		(2065::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Low Molecular Weight Dietary Fiber (LMWDF) (g)', 40, 'extended:advanced-carbohydrate-details:low molecular weight dietary fiber:g'),
		(2033::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Total Dietary Fiber (AOAC 2011.25) (g)', 50, 'extended:advanced-carbohydrate-details:total dietary fiber aoac:g'),
		(1086::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Total Sugar Alcohols (g)', 60, 'extended:advanced-carbohydrate-details:total sugar alcohols:g'),
		(1009::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Starch (g)', 70, 'extended:advanced-carbohydrate-details:starch:g'),
		(1071::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Resistant Starch (g)', 80, 'extended:advanced-carbohydrate-details:resistant starch:g'),
		(1330::bigint, 'advanced-fat-details', 'fat', 'Fatty Acids, Total Trans-Dienoic (g)', 10, 'extended:advanced-fat-details:fatty acids total trans-dienoic:g'),
		(1329::bigint, 'advanced-fat-details', 'fat', 'Fatty Acids, Total Trans-Monoenoic (g)', 20, 'extended:advanced-fat-details:fatty acids total trans-monoenoic:g'),
		(1331::bigint, 'advanced-fat-details', 'fat', 'Fatty Acids, Total Trans-Polyenoic (g)', 30, 'extended:advanced-fat-details:fatty acids total trans-polyenoic:g'),
		(2028::bigint, 'carotenoids', 'carotenoid', 'Trans-Beta-Carotene (mcg)', 10, 'extended:carotenoids:trans beta carotene:mcg'),
		(2029::bigint, 'carotenoids', 'carotenoid', 'Trans-Lycopene (mcg)', 20, 'extended:carotenoids:trans lycopene:mcg'),
		(1099::bigint, 'minerals', 'mineral', 'Fluoride, F (mcg)', 110, 'extended:minerals:fluoride:mcg'),
		(1102::bigint, 'minerals', 'mineral', 'Molybdenum, Mo (mcg)', 120, 'extended:minerals:molybdenum:mcg'),
		(1210::bigint, 'amino-acids', 'amino_acid', 'Tryptophan (g)', 10, 'extended:amino-acids:tryptophan:g'),
		(1211::bigint, 'amino-acids', 'amino_acid', 'Threonine (g)', 20, 'extended:amino-acids:threonine:g'),
		(1212::bigint, 'amino-acids', 'amino_acid', 'Isoleucine (g)', 30, 'extended:amino-acids:isoleucine:g'),
		(1213::bigint, 'amino-acids', 'amino_acid', 'Leucine (g)', 40, 'extended:amino-acids:leucine:g'),
		(1214::bigint, 'amino-acids', 'amino_acid', 'Lysine (g)', 50, 'extended:amino-acids:lysine:g'),
		(1215::bigint, 'amino-acids', 'amino_acid', 'Methionine (g)', 60, 'extended:amino-acids:methionine:g'),
		(1216::bigint, 'amino-acids', 'amino_acid', 'Cystine (g)', 70, 'extended:amino-acids:cystine:g'),
		(1217::bigint, 'amino-acids', 'amino_acid', 'Phenylalanine (g)', 80, 'extended:amino-acids:phenylalanine:g'),
		(1218::bigint, 'amino-acids', 'amino_acid', 'Tyrosine (g)', 90, 'extended:amino-acids:tyrosine:g'),
		(1219::bigint, 'amino-acids', 'amino_acid', 'Valine (g)', 100, 'extended:amino-acids:valine:g'),
		(1220::bigint, 'amino-acids', 'amino_acid', 'Arginine (g)', 110, 'extended:amino-acids:arginine:g'),
		(1221::bigint, 'amino-acids', 'amino_acid', 'Histidine (g)', 120, 'extended:amino-acids:histidine:g'),
		(1222::bigint, 'amino-acids', 'amino_acid', 'Alanine (g)', 130, 'extended:amino-acids:alanine:g'),
		(1223::bigint, 'amino-acids', 'amino_acid', 'Aspartic Acid (g)', 140, 'extended:amino-acids:aspartic acid:g'),
		(1224::bigint, 'amino-acids', 'amino_acid', 'Glutamic Acid (g)', 150, 'extended:amino-acids:glutamic acid:g'),
		(1225::bigint, 'amino-acids', 'amino_acid', 'Glycine (g)', 160, 'extended:amino-acids:glycine:g'),
		(1226::bigint, 'amino-acids', 'amino_acid', 'Proline (g)', 170, 'extended:amino-acids:proline:g'),
		(1227::bigint, 'amino-acids', 'amino_acid', 'Serine (g)', 180, 'extended:amino-acids:serine:g'),
		(1228::bigint, 'amino-acids', 'amino_acid', 'Hydroxyproline (g)', 190, 'extended:amino-acids:hydroxyproline:g'),
		(1007::bigint, 'other-nutrients', 'proximate', 'Ash (g)', 10, 'extended:other-nutrients:ash:g')
)
update public.nutrient_manual_entry_fields fields
set
	group_id = approved_fields.group_id,
	nutrient_type = approved_fields.nutrient_type,
	display_label = approved_fields.display_label,
	dedupe_key = approved_fields.dedupe_key,
	enabled = true,
	classification_status = 'approved',
	classification_source_key = 'blendcalc-manual-entry-policy',
	classification_reference = '20260801104000_reviewed_extended_manual_entry_catalog',
	classification_version = 3,
	classification_notes = 'Reviewed DB-owned Extended nutrient placement; source observations add evidence without controlling UI availability.',
	replacement_nutrient_id = null,
	reviewed_at = now(),
	updated_at = now()
from approved_fields
where fields.nutrient_id = approved_fields.nutrient_id;

with approved_fields (
	nutrient_id,
	group_id,
	nutrient_type,
	display_label,
	sort_order,
	dedupe_key
) as (
	values
		(1082::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Fiber, Soluble (g)', 10, 'extended:advanced-carbohydrate-details:fiber soluble:g'),
		(1084::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Fiber, Insoluble (g)', 20, 'extended:advanced-carbohydrate-details:fiber insoluble:g'),
		(2038::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'High Molecular Weight Dietary Fiber (HMWDF) (g)', 30, 'extended:advanced-carbohydrate-details:high molecular weight dietary fiber:g'),
		(2065::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Low Molecular Weight Dietary Fiber (LMWDF) (g)', 40, 'extended:advanced-carbohydrate-details:low molecular weight dietary fiber:g'),
		(2033::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Total Dietary Fiber (AOAC 2011.25) (g)', 50, 'extended:advanced-carbohydrate-details:total dietary fiber aoac:g'),
		(1086::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Total Sugar Alcohols (g)', 60, 'extended:advanced-carbohydrate-details:total sugar alcohols:g'),
		(1009::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Starch (g)', 70, 'extended:advanced-carbohydrate-details:starch:g'),
		(1071::bigint, 'advanced-carbohydrate-details', 'carbohydrate', 'Resistant Starch (g)', 80, 'extended:advanced-carbohydrate-details:resistant starch:g'),
		(1330::bigint, 'advanced-fat-details', 'fat', 'Fatty Acids, Total Trans-Dienoic (g)', 10, 'extended:advanced-fat-details:fatty acids total trans-dienoic:g'),
		(1329::bigint, 'advanced-fat-details', 'fat', 'Fatty Acids, Total Trans-Monoenoic (g)', 20, 'extended:advanced-fat-details:fatty acids total trans-monoenoic:g'),
		(1331::bigint, 'advanced-fat-details', 'fat', 'Fatty Acids, Total Trans-Polyenoic (g)', 30, 'extended:advanced-fat-details:fatty acids total trans-polyenoic:g'),
		(2028::bigint, 'carotenoids', 'carotenoid', 'Trans-Beta-Carotene (mcg)', 10, 'extended:carotenoids:trans beta carotene:mcg'),
		(2029::bigint, 'carotenoids', 'carotenoid', 'Trans-Lycopene (mcg)', 20, 'extended:carotenoids:trans lycopene:mcg'),
		(1099::bigint, 'minerals', 'mineral', 'Fluoride, F (mcg)', 110, 'extended:minerals:fluoride:mcg'),
		(1102::bigint, 'minerals', 'mineral', 'Molybdenum, Mo (mcg)', 120, 'extended:minerals:molybdenum:mcg'),
		(1210::bigint, 'amino-acids', 'amino_acid', 'Tryptophan (g)', 10, 'extended:amino-acids:tryptophan:g'),
		(1211::bigint, 'amino-acids', 'amino_acid', 'Threonine (g)', 20, 'extended:amino-acids:threonine:g'),
		(1212::bigint, 'amino-acids', 'amino_acid', 'Isoleucine (g)', 30, 'extended:amino-acids:isoleucine:g'),
		(1213::bigint, 'amino-acids', 'amino_acid', 'Leucine (g)', 40, 'extended:amino-acids:leucine:g'),
		(1214::bigint, 'amino-acids', 'amino_acid', 'Lysine (g)', 50, 'extended:amino-acids:lysine:g'),
		(1215::bigint, 'amino-acids', 'amino_acid', 'Methionine (g)', 60, 'extended:amino-acids:methionine:g'),
		(1216::bigint, 'amino-acids', 'amino_acid', 'Cystine (g)', 70, 'extended:amino-acids:cystine:g'),
		(1217::bigint, 'amino-acids', 'amino_acid', 'Phenylalanine (g)', 80, 'extended:amino-acids:phenylalanine:g'),
		(1218::bigint, 'amino-acids', 'amino_acid', 'Tyrosine (g)', 90, 'extended:amino-acids:tyrosine:g'),
		(1219::bigint, 'amino-acids', 'amino_acid', 'Valine (g)', 100, 'extended:amino-acids:valine:g'),
		(1220::bigint, 'amino-acids', 'amino_acid', 'Arginine (g)', 110, 'extended:amino-acids:arginine:g'),
		(1221::bigint, 'amino-acids', 'amino_acid', 'Histidine (g)', 120, 'extended:amino-acids:histidine:g'),
		(1222::bigint, 'amino-acids', 'amino_acid', 'Alanine (g)', 130, 'extended:amino-acids:alanine:g'),
		(1223::bigint, 'amino-acids', 'amino_acid', 'Aspartic Acid (g)', 140, 'extended:amino-acids:aspartic acid:g'),
		(1224::bigint, 'amino-acids', 'amino_acid', 'Glutamic Acid (g)', 150, 'extended:amino-acids:glutamic acid:g'),
		(1225::bigint, 'amino-acids', 'amino_acid', 'Glycine (g)', 160, 'extended:amino-acids:glycine:g'),
		(1226::bigint, 'amino-acids', 'amino_acid', 'Proline (g)', 170, 'extended:amino-acids:proline:g'),
		(1227::bigint, 'amino-acids', 'amino_acid', 'Serine (g)', 180, 'extended:amino-acids:serine:g'),
		(1228::bigint, 'amino-acids', 'amino_acid', 'Hydroxyproline (g)', 190, 'extended:amino-acids:hydroxyproline:g'),
		(1007::bigint, 'other-nutrients', 'proximate', 'Ash (g)', 10, 'extended:other-nutrients:ash:g')
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
	replacement_nutrient_id,
	reviewed_at
)
select
	approved_fields.dedupe_key,
	approved_fields.nutrient_id,
	approved_fields.group_id,
	approved_fields.nutrient_type,
	approved_fields.display_label,
	approved_fields.sort_order,
	true,
	1,
	0,
	'single_source',
	array['blendcalc-reviewed-policy'],
	null,
	false,
	'approved',
	'blendcalc-manual-entry-policy',
	'20260801104000_reviewed_extended_manual_entry_catalog',
	3,
	'Reviewed DB-owned Extended nutrient placement; source observations add evidence without controlling UI availability.',
	null,
	now()
from approved_fields
where not exists (
	select 1
	from public.nutrient_manual_entry_fields existing
	where existing.nutrient_id = approved_fields.nutrient_id
);
