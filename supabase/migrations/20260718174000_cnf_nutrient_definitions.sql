alter table public.nutrient_source_mappings
	drop constraint nutrient_source_mappings_mapping_method_check;

alter table public.nutrient_source_mappings
	add constraint nutrient_source_mappings_mapping_method_check
	check (
		mapping_method in (
			'api_id_match',
			'api_taxonomy_match',
			'api_observation_match',
			'moderator_verified',
			'standards_dataset'
		)
	);

create unique index if not exists nutrient_definitions_number_unique_idx
	on public.nutrient_definitions (nutrient_number)
	where nutrient_number is not null;

insert into public.nutrient_definitions (
	nutrient_id,
	nutrient_name,
	nutrient_number,
	default_unit_name
)
values
	(700260, 'Mannitol', '260', 'G'),
	(700261, 'Sorbitol', '261', 'G'),
	(700329, '25-hydroxycholecalciferol', '329', 'UG'),
	(700330, '25-hydroxyergocalciferol', '330', 'UG'),
	(700409, 'Total niacin equivalent', '409', 'NE'),
	(700550, 'Aspartame', '550', 'MG'),
	(700638, 'Stigmasterol', '638', 'MG'),
	(700639, 'Campesterol', '639', 'MG'),
	(700641, 'Beta-sitosterol', '641', 'MG'),
	(700666, 'Fatty acids, polyunsaturated, 18:2i, linoleic, octadecadienoic', '666', 'G'),
	(700669, 'Fatty acids, polyunsaturated, 18:2t,t, octadecadienoic', '669', 'G'),
	(700855, 'Fatty acids, polyunsaturated, 20:4 n-6, arachidonic', '855', 'G'),
	(700857, 'Fatty acids, polyunsaturated, 21:5', '857', 'G'),
	(700860, 'Fatty acids, monounsaturated, 12:1, lauroleic', '860', 'G'),
	(700861, 'Fatty acids, polyunsaturated, 22:3', '861', 'G'),
	(700862, 'Fatty acids, polyunsaturated, 22:2, docosadienoic', '862', 'G'),
	(700884, 'Fatty acids, monounsaturated, 18:1 10c', '884', 'G'),
	(700885, 'Fatty acids, monounsaturated, 18:1 11c', '885', 'G'),
	(700886, 'Fatty acids, monounsaturated, 18:1 12c', '886', 'G'),
	(700888, 'Fatty acids, monounsaturated, 18:1 13c', '888', 'G'),
	(700891, 'Fatty acids, monounsaturated, 18:1 14c', '891', 'G'),
	(700895, 'Fatty acids, monounsaturated, 18:1 15c', '895', 'G'),
	(700896, 'Fatty acids, monounsaturated, 18:1 16c', '896', 'G'),
	(700897, 'Fatty acids, monounsaturated, 18:1 11t', '897', 'G'),
	(700898, 'Fatty acids, monounsaturated, 18:1 4t', '898', 'G'),
	(700899, 'Fatty acids, monounsaturated, 18:1 5t', '899', 'G'),
	(700904, 'Fatty acids, monounsaturated, 18:1 6t-8t', '904', 'G'),
	(700905, 'Fatty acids, monounsaturated, 18:1 10t', '905', 'G'),
	(700906, 'Fatty acids, monounsaturated, 18:1 12t', '906', 'G'),
	(700907, 'Fatty acids, monounsaturated, 18:1 13t + 14t + 6c-8c', '907', 'G'),
	(700908, 'Fatty acids, monounsaturated, 18:1 16t', '908', 'G'),
	(700909, 'Fatty acids, monounsaturated, 20:1 5c', '909', 'G'),
	(700910, 'Fatty acids, polyunsaturated, 18:2 9c,13c', '910', 'G'),
	(700911, 'Fatty acids, polyunsaturated, 18:2 9c,14c', '911', 'G'),
	(700912, 'Fatty acids, polyunsaturated, 18:2 9c,15c', '912', 'G'),
	(700913, 'Fatty acids, polyunsaturated, 22:5 n-6', '913', 'G'),
	(701001, 'Fructans (inulin)', '1001', 'G')
on conflict (nutrient_id) do update
set
	nutrient_name = excluded.nutrient_name,
	nutrient_number = excluded.nutrient_number,
	default_unit_name = excluded.default_unit_name;
