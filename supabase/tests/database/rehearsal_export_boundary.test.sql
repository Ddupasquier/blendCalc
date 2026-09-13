begin;

select plan(20);

select has_schema(
	'rehearsal_export',
	'Rehearsal exports use a dedicated non-Data-API schema'
);
select ok(
	exists (
		select 1 from pg_roles
		where rolname = 'rehearsal_export_owner'
			and not rolcanlogin and not rolsuper and not rolcreatedb
			and not rolcreaterole and not rolinherit
			and not rolreplication and not rolbypassrls
	),
	'the export view owner is an inert no-login role'
);
select ok(
	exists (
		select 1 from pg_roles
		where rolname = 'rehearsal_export_reader'
			and not rolcanlogin and not rolsuper and not rolcreatedb
			and not rolcreaterole and not rolinherit
			and not rolreplication and not rolbypassrls
	),
	'the export reader is an inert no-login role'
);
select ok(
	exists (
		select 1 from pg_roles
		where rolname = 'rehearsal_storage_reader'
			and not rolcanlogin and not rolsuper and not rolcreatedb
			and not rolcreaterole and not rolinherit
			and not rolreplication and not rolbypassrls
	),
	'the Storage reader is an inert no-login role'
);
select ok(
	has_table_privilege('rehearsal_storage_reader', 'storage.objects', 'select')
		and not has_table_privilege('rehearsal_storage_reader', 'storage.objects', 'insert')
		and not has_table_privilege('rehearsal_storage_reader', 'storage.objects', 'update')
		and not has_table_privilege('rehearsal_storage_reader', 'storage.objects', 'delete'),
	'the Storage reader can only read object metadata'
);
select ok(
	exists (
		select 1 from pg_policies
		where schemaname = 'storage'
			and tablename = 'objects'
			and policyname = 'rehearsal_storage_reader_read'
			and cmd = 'SELECT'
	),
	'the Storage reader is constrained by an explicit SELECT policy'
);
select is(
	(
		select count(*)
		from information_schema.views
		where table_schema = 'rehearsal_export'
	),
	128::bigint,
	'the boundary exposes 126 reviewed tables plus migration and owner-scope receipts'
);
select is(
	(
		select count(*)
		from pg_policies
		where schemaname = 'public'
			and policyname = 'rehearsal_export_owner_read'
	),
	126::bigint,
	'every exported source table has one forced-RLS owner policy'
);
select ok(
	not exists (
		select 1
		from aclexplode(coalesce((select nspacl from pg_namespace where nspname = 'public'), acldefault('n', 0))) acl
		where acl.grantee = 0 and acl.privilege_type in ('USAGE', 'CREATE')
	),
	'the public pseudo-role no longer grants source-schema access'
);
select ok(
	not exists (
		select 1
		from aclexplode(coalesce((select datacl from pg_database where datname = current_database()), acldefault('d', 0))) acl
		where acl.grantee = 0 and acl.privilege_type in ('CREATE', 'TEMPORARY')
	),
	'the public pseudo-role no longer grants database creation capabilities'
);

create role rehearsal_export_test_login
	nologin nosuperuser nocreatedb nocreaterole inherit noreplication nobypassrls;
grant rehearsal_export_reader to rehearsal_export_test_login
	with inherit true, set false;

select ok(
	has_schema_privilege('rehearsal_export_test_login', 'rehearsal_export', 'usage'),
	'the reader can use only the export schema'
);
select ok(
	has_table_privilege('rehearsal_export_test_login', 'rehearsal_export.source_scope_v1', 'select')
		and not has_table_privilege('rehearsal_export_test_login', 'rehearsal_export.source_scopes', 'select'),
	'the reader sees only its filtered owner-scope receipt, never the registry'
);
select ok(
	not has_schema_privilege('rehearsal_export_test_login', 'public', 'usage')
		and not has_schema_privilege('rehearsal_export_test_login', 'auth', 'usage')
		and not has_schema_privilege('rehearsal_export_test_login', 'storage', 'usage')
		and not has_schema_privilege('rehearsal_export_test_login', 'extensions', 'usage'),
	'the reader cannot resolve source or extension schemas'
);
select ok(
	has_table_privilege('rehearsal_export_test_login', 'rehearsal_export.profiles_v1', 'select')
		and not has_table_privilege('rehearsal_export_test_login', 'rehearsal_export.profiles_v1', 'insert')
		and not has_table_privilege('rehearsal_export_test_login', 'rehearsal_export.profiles_v1', 'update')
		and not has_table_privilege('rehearsal_export_test_login', 'rehearsal_export.profiles_v1', 'delete'),
	'export views are read-only to the reader'
);
select ok(
	not has_table_privilege('rehearsal_export_test_login', 'public.profiles', 'select'),
	'the reader has no direct source-table read'
);
select ok(
	not has_table_privilege('rehearsal_export_test_login', 'public.blendcalc_api_keys', 'select')
		and not has_table_privilege('rehearsal_export_test_login', 'public.blocked_signup_emails', 'select'),
	'excluded secret and enforcement tables are unavailable'
);
select ok(
	not has_database_privilege('rehearsal_export_test_login', current_database(), 'create')
		and not has_database_privilege('rehearsal_export_test_login', current_database(), 'temporary'),
	'the reader cannot create persistent or temporary database objects'
);
select ok(
	not pg_has_role('rehearsal_export_test_login', 'rehearsal_export_owner', 'member'),
	'the reader cannot assume the view owner'
);
select columns_are(
	'rehearsal_export',
	'migration_history_v1',
	array['version', 'name', 'statement_count', 'statement_sha256'],
	'the migration receipt never exposes raw statements'
);
select ok(
	not exists (
		select 1
		from rehearsal_export.migration_history_v1
		where statement_count <= 0
			or statement_sha256 !~ '^[a-f0-9]{64}$'
	),
	'every applied migration exposes a bounded SHA-256 statement receipt'
);

select * from finish();
rollback;
