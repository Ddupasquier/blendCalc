begin;

select plan(24);

select has_schema('blendcalc_api', 'the isolated blendCalcAPI schema exists');
select has_table('blendcalc_api', 'publication_generations', 'publication generations are durable');
select has_table('blendcalc_api', 'publication_products', 'public product snapshots are durable');
select has_view('blendcalc_api', 'active_publication_products', 'only the active generation is readable');
select has_function(
	'blendcalc_api',
	'search_active_publication_products',
	array['text', 'text[]', 'integer', 'integer'],
	'the isolated catalog owns its server-only search contract'
);
select has_function(
	'blendcalc_api',
	'search_publication_generation_products',
	array['uuid', 'text', 'text[]', 'integer', 'integer'],
	'candidate generations can be checked before activation'
);

select ok(
	not has_schema_privilege('anon', 'blendcalc_api', 'usage')
		and not has_schema_privilege('authenticated', 'blendcalc_api', 'usage'),
	'browser roles cannot access the isolated API schema'
);

select ok(
	has_schema_privilege('service_role', 'blendcalc_api', 'usage')
		and has_table_privilege('service_role', 'blendcalc_api.publication_products', 'select'),
	'the trusted server role can operate the publication read model'
);

select is(
	(
		select count(*)::integer
		from pg_class table_contract
		join pg_namespace schema_contract
			on schema_contract.oid = table_contract.relnamespace
		where schema_contract.nspname = 'blendcalc_api'
			and table_contract.relkind = 'r'
			and table_contract.relname in (
				'publication_generations',
				'publication_products',
				'publication_product_revisions',
				'publication_categories',
				'publication_source_attributions',
				'publication_generation_events'
			)
			and table_contract.relrowsecurity
			and table_contract.relforcerowsecurity
	),
	6,
	'every isolated publication table forces row level security'
);

create temporary table generation_ids (
	name text primary key,
	id uuid not null
);

with inserted_generation as (
	insert into blendcalc_api.publication_generations (
		source_project_ref,
		source_catalog_hash,
		expected_product_count,
		expected_revision_count,
		expected_category_count,
		expected_attribution_count,
		source_snapshot_at
	)
	values (
		'source-project',
		repeat('a', 64),
		1,
		0,
		0,
		0,
		now()
	)
	returning id
)
insert into generation_ids (name, id)
select 'first', id
from inserted_generation;

select throws_ok(
	format(
		'select blendcalc_api.mark_publication_generation_ready(%L::uuid)',
		(select id from generation_ids where name = 'first')
	),
	'P0001',
	'publication_generation_count_mismatch',
	'an incomplete generation cannot become ready'
);

insert into blendcalc_api.publication_products (
	generation_id,
	source_product_id,
	source_revision_id,
	gtin14,
	product_name,
	search_text,
	detail_payload,
	search_payload,
	content_sha256,
	source_updated_at
)
select
	id,
	'00000000-0000-0000-0000-000000000001',
	'00000000-0000-0000-0000-000000000011',
	'00000000000001',
	'First product',
	'first product',
	'{"name":"First product"}',
	'{"name":"First product"}',
	repeat('b', 64),
	now()
from generation_ids
where name = 'first';

select lives_ok(
	format(
		'select blendcalc_api.mark_publication_generation_ready(%L::uuid)',
		(select id from generation_ids where name = 'first')
	),
	'a complete generation becomes ready'
);

select lives_ok(
	format(
		'select blendcalc_api.activate_publication_generation(%L::uuid)',
		(select id from generation_ids where name = 'first')
	),
	'a ready generation becomes active'
);

select is(
	(select count(*)::integer from blendcalc_api.active_publication_products),
	1,
	'the active generation exposes its product'
);

select is(
	(
		select count(*)::integer
		from blendcalc_api.search_active_publication_products(
			'first',
			array['first'],
			15,
			0
		)
	),
	1,
	'search reads only the active complete generation'
);

with inserted_generation as (
	insert into blendcalc_api.publication_generations (
		source_project_ref,
		source_catalog_hash,
		expected_product_count,
		expected_revision_count,
		expected_category_count,
		expected_attribution_count,
		source_snapshot_at
	)
	values (
		'source-project',
		repeat('c', 64),
		1,
		0,
		0,
		0,
		now()
	)
	returning id
)
insert into generation_ids (name, id)
select 'second', id
from inserted_generation;

insert into blendcalc_api.publication_products (
	generation_id,
	source_product_id,
	source_revision_id,
	gtin14,
	product_name,
	search_text,
	detail_payload,
	search_payload,
	content_sha256,
	source_updated_at
)
select
	id,
	'00000000-0000-0000-0000-000000000002',
	'00000000-0000-0000-0000-000000000022',
	'00000000000002',
	'Second product',
	'second product',
	'{"name":"Second product"}',
	'{"name":"Second product"}',
	repeat('d', 64),
	now()
from generation_ids
where name = 'second';

select lives_ok(
	format(
		'select blendcalc_api.mark_publication_generation_ready(%L::uuid)',
		(select id from generation_ids where name = 'second')
	),
	'a replacement generation becomes ready'
);

select lives_ok(
	format(
		'select blendcalc_api.activate_publication_generation(%L::uuid)',
		(select id from generation_ids where name = 'second')
	),
	'a replacement generation activates atomically'
);

select is(
	(select gtin14 from blendcalc_api.active_publication_products),
	'00000000000002',
	'withdrawn products disappear when the complete replacement activates'
);

select lives_ok(
	format(
		'select blendcalc_api.activate_publication_generation(%L::uuid)',
		(select id from generation_ids where name = 'first')
	),
	'a retired generation remains available for immediate rollback'
);

select is(
	(select gtin14 from blendcalc_api.active_publication_products),
	'00000000000001',
	'rollback restores the previous complete generation'
);

select is(
	(select count(*)::integer from blendcalc_api.publication_generations where status = 'active'),
	1,
	'exactly one generation is active'
);

with inserted_generation as (
	insert into blendcalc_api.publication_generations (
		source_project_ref,
		source_catalog_hash,
		expected_product_count,
		expected_revision_count,
		expected_category_count,
		expected_attribution_count,
		source_snapshot_at
	)
	values ('source-project', repeat('e', 64), 0, 0, 0, 0, now())
	returning id
)
insert into generation_ids (name, id)
select 'empty', id
from inserted_generation;

select lives_ok(
	format(
		'select blendcalc_api.mark_publication_generation_ready(%L::uuid)',
		(select id from generation_ids where name = 'empty')
	),
	'an intentionally empty generation can become ready'
);

select lives_ok(
	format(
		'select blendcalc_api.activate_publication_generation(%L::uuid)',
		(select id from generation_ids where name = 'empty')
	),
	'an intentionally empty generation can withdraw the complete catalog'
);

select is(
	(select count(*)::integer from blendcalc_api.active_publication_products),
	0,
	'an empty active generation exposes no stale products'
);

select cmp_ok(
	(select count(*)::integer from blendcalc_api.publication_generation_events),
	'>=',
	8,
	'generation state transitions retain an audit trail'
);

select * from finish();

rollback;
