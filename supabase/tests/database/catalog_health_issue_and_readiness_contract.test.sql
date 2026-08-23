begin;

select plan(16);

select has_column(
	'public',
	'app_issue_codes',
	'operational_severity',
	'issue codes expose operational urgency'
);

select has_column(
	'public',
	'app_issue_codes',
	'responsible_group',
	'issue codes expose permission-oriented ownership'
);

select has_column(
	'public',
	'app_issue_codes',
	'resolution_action',
	'issue codes expose a stable resolution action'
);

select has_column(
	'public',
	'app_issue_codes',
	'automated_repair_allowed',
	'issue codes distinguish reviewed automated repairs'
);

select has_view(
	'public',
	'catalog_product_readiness',
	'catalog product readiness is reusable database state'
);

select has_view(
	'public',
	'catalog_health_issue_occurrences',
	'catalog health issues use one normalized occurrence contract'
);

select is(
	(select count(*) from public.catalog_product_readiness),
	(select count(*) from public.shared_products),
	'every canonical product has one readiness record'
);

select ok(
	not exists (
		select 1
		from public.catalog_product_readiness readiness
		where readiness.shared_catalog_status not in ('Active', 'Waiting for review', 'Blocked')
			or readiness.api_v1_status not in ('Ready', 'Withheld')
	),
	'readiness states remain bounded'
);

select ok(
	not exists (
		select 1
		from public.catalog_product_readiness readiness
		join public.shared_products product on product.id = readiness.shared_product_id
		where product.status = 'active'
			and (not readiness.searchable_in_blendcalc or not readiness.usable_in_blendcalc)
	),
	'active shared-catalog products remain searchable and usable independent of API publication'
);

select ok(
	exists (
		select 1
		from public.catalog_product_readiness readiness
		where readiness.api_v1_status = 'Withheld'
			and readiness.searchable_in_blendcalc
			and readiness.usable_in_blendcalc
	),
	'API withholding does not hide an otherwise active blendCalc product'
);

select ok(
	not exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		left join public.app_issue_codes issue on issue.code = occurrence.issue_code
		where issue.code is null
			or issue.operational_severity is null
			or issue.responsible_group is null
			or issue.resolution_action is null
	),
	'every normalized occurrence resolves to complete operational metadata'
);

select ok(
	not exists (
		select 1
		from public.app_issue_codes issue
		where issue.automated_repair_allowed
			and nullif(btrim(issue.automated_repair_key), '') is null
	),
	'automated repair capability always names a reviewed handler'
);

select ok(
	not exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		join public.generic_food_datasets dataset
			on occurrence.subject_type = 'generic_food_dataset'
			and occurrence.subject_key = dataset.key
		where not dataset.active and not dataset.import_enabled
	),
	'disabled unused datasets do not become operational failures'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.catalog_product_readiness',
		'select'
	),
	'authenticated clients cannot read readiness internals directly'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.catalog_health_issue_occurrences',
		'select'
	),
	'authenticated clients cannot read catalog issue internals directly'
);

select ok(
	has_table_privilege(
		'service_role',
		'public.catalog_health_issue_occurrences',
		'select'
	),
	'trusted server workflows can read normalized catalog issues'
);

select * from finish();

rollback;
