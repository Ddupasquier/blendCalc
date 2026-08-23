alter type public.app_permission add value if not exists
	'data_operations.catalog_health.read';

alter type public.app_permission add value if not exists
	'data_operations.catalog_health.repair';

alter type public.app_permission add value if not exists
	'data_operations.nutrient_mappings.manage';
