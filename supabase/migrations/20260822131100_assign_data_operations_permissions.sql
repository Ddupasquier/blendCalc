insert into public.app_role_permissions (role, permission)
values
	('admin', 'data_operations.catalog_health.read'),
	('admin', 'data_operations.catalog_health.repair'),
	('admin', 'data_operations.nutrient_mappings.manage'),
	('developer', 'data_operations.catalog_health.read'),
	('developer', 'data_operations.catalog_health.repair'),
	('developer', 'data_operations.nutrient_mappings.manage')
on conflict (role, permission) do nothing;

comment on type public.app_permission is
	'Permission capabilities are assigned by role. Data-operations permissions are intentionally limited to admins and developers; moderators retain review-work permissions.';
