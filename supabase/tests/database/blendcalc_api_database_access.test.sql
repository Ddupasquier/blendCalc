begin;

select plan(23);

select is(
	(select relrowsecurity from pg_class where oid = 'public.blendcalc_api_scopes'::regclass),
	true,
	'blendCalcAPI scopes have row level security enabled'
);
select is(
	(select relforcerowsecurity from pg_class where oid = 'public.blendcalc_api_scopes'::regclass),
	true,
	'blendCalcAPI scopes force row level security'
);
select is(
	(select relrowsecurity from pg_class where oid = 'public.blendcalc_api_scope_policies'::regclass),
	true,
	'blendCalcAPI operation policies have row level security enabled'
);
select is(
	(select relforcerowsecurity from pg_class where oid = 'public.blendcalc_api_scope_policies'::regclass),
	true,
	'blendCalcAPI operation policies force row level security'
);

select ok(
	not has_table_privilege('anon', 'public.blendcalc_api_scopes', 'SELECT')
		and not has_table_privilege('authenticated', 'public.blendcalc_api_scopes', 'SELECT'),
	'external clients cannot read API scopes'
);
select ok(
	not has_table_privilege('anon', 'public.blendcalc_api_scope_policies', 'SELECT')
		and not has_table_privilege('authenticated', 'public.blendcalc_api_scope_policies', 'SELECT'),
	'external clients cannot read API operation policies'
);
select ok(
	has_table_privilege('service_role', 'public.blendcalc_api_scopes', 'SELECT')
		and has_table_privilege('service_role', 'public.blendcalc_api_scope_policies', 'SELECT'),
	'the trusted server can read API scope policy'
);

select ok(
	not has_table_privilege('anon', 'public.blendcalc_api_clients', 'SELECT')
		and not has_table_privilege('authenticated', 'public.blendcalc_api_clients', 'SELECT'),
	'external clients cannot read API consumer identities'
);
select ok(
	not has_table_privilege('anon', 'public.blendcalc_api_keys', 'SELECT')
		and not has_table_privilege('authenticated', 'public.blendcalc_api_keys', 'SELECT'),
	'external clients cannot read API credential hashes or lifecycle metadata'
);
select ok(
	has_table_privilege('service_role', 'public.blendcalc_api_clients', 'SELECT,INSERT,UPDATE,DELETE')
		and has_table_privilege('service_role', 'public.blendcalc_api_keys', 'SELECT,INSERT,UPDATE,DELETE'),
	'the trusted server manages API consumers and credentials'
);

select ok(
	not has_function_privilege('anon', 'public.get_blendcalc_api_product_v1(text)', 'EXECUTE')
		and not has_function_privilege('authenticated', 'public.get_blendcalc_api_product_v1(text)', 'EXECUTE'),
	'external clients cannot bypass the HTTP serializer for exact product reads'
);
select ok(
	not has_function_privilege('anon', 'public.search_blendcalc_api_products_v1(text,text[],integer,integer)', 'EXECUTE')
		and not has_function_privilege('authenticated', 'public.search_blendcalc_api_products_v1(text,text[],integer,integer)', 'EXECUTE'),
	'external clients cannot bypass the HTTP serializer for catalog search'
);
select ok(
	not has_function_privilege('anon', 'public.get_blendcalc_api_product_revision_history_v1(text,integer,integer)', 'EXECUTE')
		and not has_function_privilege('authenticated', 'public.get_blendcalc_api_product_revision_history_v1(text,integer,integer)', 'EXECUTE'),
	'external clients cannot bypass revision-history sanitization'
);
select ok(
	has_function_privilege('service_role', 'public.get_blendcalc_api_product_v1(text)', 'EXECUTE')
		and has_function_privilege('service_role', 'public.search_blendcalc_api_products_v1(text,text[],integer,integer)', 'EXECUTE')
		and has_function_privilege('service_role', 'public.get_blendcalc_api_product_revision_history_v1(text,integer,integer)', 'EXECUTE'),
	'the trusted server can execute all canonical catalog read functions'
);
select ok(
	(
		select bool_and(prosecdef)
		from pg_proc
		where oid = any(array[
			'public.get_blendcalc_api_product_v1(text)'::regprocedure,
			'public.search_blendcalc_api_products_v1(text,text[],integer,integer)'::regprocedure,
			'public.get_blendcalc_api_product_revision_history_v1(text,integer,integer)'::regprocedure
		])
	),
	'canonical catalog read functions use controlled definer privileges'
);
select ok(
	(
		select bool_and(coalesce(proconfig, '{}'::text[]) @> array['search_path=""'])
		from pg_proc
		where oid = any(array[
			'public.get_blendcalc_api_product_v1(text)'::regprocedure,
			'public.search_blendcalc_api_products_v1(text,text[],integer,integer)'::regprocedure,
			'public.get_blendcalc_api_product_revision_history_v1(text,integer,integer)'::regprocedure
		])
	),
	'canonical catalog read functions pin an empty search path'
);

select ok(
	not has_table_privilege('anon', 'public.blendcalc_api_v1_published_products', 'SELECT')
		and not has_table_privilege('authenticated', 'public.blendcalc_api_v1_published_products', 'SELECT'),
	'external clients cannot query the API publication inventory directly'
);
select ok(
	has_table_privilege('service_role', 'public.blendcalc_api_v1_published_products', 'SELECT'),
	'the trusted server can inspect the API publication inventory'
);
select ok(
	not has_table_privilege('anon', 'public.blendcalc_api_v1_product_readiness', 'SELECT')
		and not has_table_privilege('authenticated', 'public.blendcalc_api_v1_product_readiness', 'SELECT'),
	'external clients cannot inspect private publication-readiness reasons'
);
select ok(
	has_table_privilege('service_role', 'public.blendcalc_api_v1_product_readiness', 'SELECT'),
	'the trusted server can inspect private publication readiness'
);

select ok(
	not has_function_privilege('anon', 'public.rotate_blendcalc_api_key(uuid,uuid,text,text,text,text[],timestamp with time zone,uuid)', 'EXECUTE')
		and not has_function_privilege('authenticated', 'public.rotate_blendcalc_api_key(uuid,uuid,text,text,text,text[],timestamp with time zone,uuid)', 'EXECUTE'),
	'external clients cannot rotate API credentials'
);
select ok(
	has_function_privilege('service_role', 'public.rotate_blendcalc_api_key(uuid,uuid,text,text,text,text[],timestamp with time zone,uuid)', 'EXECUTE'),
	'the trusted server can rotate API credentials atomically'
);
select ok(
	not has_function_privilege('anon', 'public.blendcalc_api_key_scopes_are_well_formed(text[])', 'EXECUTE')
		and not has_function_privilege('authenticated', 'public.blendcalc_api_key_scopes_are_well_formed(text[])', 'EXECUTE')
		and has_function_privilege('service_role', 'public.blendcalc_api_key_scopes_are_well_formed(text[])', 'EXECUTE'),
	'API credential scope validation remains service-only'
);

select * from finish();

rollback;
