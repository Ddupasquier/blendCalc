begin;

select plan(25);

select ok(
	has_function_privilege(
		'authenticated',
		'public.run_catalog_health_repair(text,boolean,uuid)',
		'execute'
	),
	'authenticated sessions can reach the guarded repair workflow'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.run_catalog_health_repair(text,boolean,uuid)',
		'execute'
	),
	'anonymous sessions cannot run catalog repairs'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.catalog_health_repair_runs',
		'select'
	),
	'authenticated clients cannot read repair audit rows directly'
);

select ok(
	has_table_privilege(
		'service_role',
		'public.catalog_health_repair_runs',
		'select'
	),
	'trusted server workflows can read repair audit rows'
);

select is(
	(
		select issue.automated_repair_allowed
		from public.app_issue_codes issue
		where issue.code = 'CATALOG_REVISION_MISSING'
	),
	true,
	'revision repair is enabled after its dedicated evidence-only handler is installed'
);

insert into auth.users (id, aud, role, email)
values
	('72300000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'repair-user@blendcalc.local'),
	('72300000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'repair-admin@blendcalc.local');

insert into public.app_role_assignments (user_id, role)
values ('72300000-0000-4000-8000-000000000002', 'admin');

insert into public.shared_product_observations (
	id,
	barcode,
	source,
	source_reference,
	source_license,
	raw_payload,
	normalized_food,
	content_hash
)
values (
	'72300000-0000-4000-8000-000000000010',
	'00011110904416',
	'usda',
	'9999999',
	'CC0-1.0',
	'{}'::jsonb,
	'{}'::jsonb,
	repeat('b', 64)
);

insert into public.food_servings (
	shared_product_observation_id,
	serving_order,
	label,
	gram_weight,
	is_primary,
	source,
	source_reference,
	confidence
)
values (
	'72300000-0000-4000-8000-000000000010',
	1,
	'1 bottle',
	355,
	true,
	'usda',
	'9999999',
	'source-verified'
);

insert into public.food_servings (
	shared_product_id,
	serving_order,
	label,
	gram_weight,
	is_primary,
	source,
	confidence
)
values
	(
		'81000000-0000-4000-8000-000000000041',
		1,
		'1 bottle',
		355,
		true,
		'unknown',
		'unknown'
	),
	(
		'82500000-0000-4000-8000-000000000001',
		1,
		'1 can',
		355,
		true,
		'unknown',
		'unknown'
	),
	(
		'82500000-0000-4000-8000-000000000011',
		1,
		'1 can',
		355,
		true,
		'unknown',
		'unknown'
	);

delete from public.shared_product_field_provenance provenance
where provenance.shared_product_id = '81000000-0000-4000-8000-000000000001'
	and provenance.field_path in ('productName', 'nutrient:1003')
	and provenance.selected;

select ok(
	exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.shared_product_id = '81000000-0000-4000-8000-000000000041'
			and occurrence.issue_code = 'CATALOG_SERVING_PROVENANCE_MISSING'
	),
	'the fixture exposes one repairable serving-provenance issue'
);

select ok(
	exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.shared_product_id = '81000000-0000-4000-8000-000000000001'
			and occurrence.issue_code = 'CATALOG_FIELD_PROVENANCE_MISSING'
			and occurrence.parameters ->> 'key' = 'productName'
	)
	and exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.shared_product_id = '81000000-0000-4000-8000-000000000001'
			and occurrence.issue_code = 'CATALOG_NUTRIENT_PROVENANCE_MISSING'
	),
	'the fixtures expose repairable field and nutrient provenance issues'
);

create temporary table catalog_health_repair_test_state (
	key text primary key,
	value text not null
);
insert into catalog_health_repair_test_state (key, value)
select
	fixture.key,
	(
		select occurrence.occurrence_key
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.shared_product_id = fixture.shared_product_id
			and occurrence.issue_code = 'CATALOG_SERVING_PROVENANCE_MISSING'
	)
from (
	values
		('repairable', '81000000-0000-4000-8000-000000000041'::uuid),
		('unresolved-status', '82500000-0000-4000-8000-000000000001'::uuid),
		('unresolved-reason', '82500000-0000-4000-8000-000000000011'::uuid)
) fixture(key, shared_product_id);
insert into catalog_health_repair_test_state (key, value)
select
	'field-provenance',
	occurrence.occurrence_key
from public.catalog_health_issue_occurrences occurrence
where occurrence.shared_product_id = '81000000-0000-4000-8000-000000000001'
	and occurrence.issue_code = 'CATALOG_FIELD_PROVENANCE_MISSING'
	and occurrence.parameters ->> 'key' = 'productName';
insert into catalog_health_repair_test_state (key, value)
select
	'nutrient-provenance',
	occurrence.occurrence_key
from public.catalog_health_issue_occurrences occurrence
where occurrence.shared_product_id = '81000000-0000-4000-8000-000000000001'
	and occurrence.issue_code = 'CATALOG_NUTRIENT_PROVENANCE_MISSING';
insert into catalog_health_repair_test_state (key, value)
select
	'canonical-source-before-dry-run',
	coalesce(serving.source_observation_id::text, 'null')
from public.food_servings serving
where serving.shared_product_id = '81000000-0000-4000-8000-000000000041'
	and serving.is_primary;
grant select on table catalog_health_repair_test_state to authenticated;

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'72300000-0000-4000-8000-000000000001',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"72300000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.run_catalog_health_repair(
		(
			select state.value
			from catalog_health_repair_test_state state
			where state.key = 'repairable'
		),
		false,
		null
	)$$,
	'42501',
	'MFA-verified catalog repair access is required.',
	'normal users cannot run catalog repairs'
);

select set_config(
	'request.jwt.claim.sub',
	'72300000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"72300000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal1"}',
	true
);

select throws_ok(
	$$select public.run_catalog_health_repair(
		(
			select state.value
			from catalog_health_repair_test_state state
			where state.key = 'repairable'
		),
		false,
		null
	)$$,
	'42501',
	'MFA-verified catalog repair access is required.',
	'data operators must verify MFA before running repairs'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72300000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.run_catalog_health_repair(
		(
			select state.value
			from catalog_health_repair_test_state state
			where state.key = 'repairable'
		),
		true,
		null
	)$$,
	'P0001',
	'A current successful dry run is required before applying this repair',
	'an apply operation cannot bypass its dry run'
);

create temporary table catalog_health_repair_test_results (
	mode text primary key,
	payload jsonb not null
);
grant all on table catalog_health_repair_test_results to authenticated;

insert into catalog_health_repair_test_results (mode, payload)
select
	'dry_run',
	public.run_catalog_health_repair(
		(
			select state.value
			from catalog_health_repair_test_state state
			where state.key = 'repairable'
		),
		false,
		null
	);

select is(
	(
		select result.payload ->> 'status'
		from catalog_health_repair_test_results result
		where result.mode = 'dry_run'
	),
	'completed',
	'an exact evidence dry run completes'
);

select is(
	(
		select (result.payload ->> 'candidateCount')::integer
		from catalog_health_repair_test_results result
		where result.mode = 'dry_run'
	),
	1,
	'the dry run reports the exact serving candidate'
);

reset role;

select is(
	(
		select coalesce(serving.source_observation_id::text, 'null')
		from public.food_servings serving
		where serving.shared_product_id = '81000000-0000-4000-8000-000000000041'
			and serving.is_primary
	),
	(
		select state.value
		from catalog_health_repair_test_state state
		where state.key = 'canonical-source-before-dry-run'
	),
	'a dry run does not mutate canonical serving provenance'
);

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'72300000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"72300000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

insert into catalog_health_repair_test_results (mode, payload)
select
	'apply',
	public.run_catalog_health_repair(
		(
			select state.value
			from catalog_health_repair_test_state state
			where state.key = 'repairable'
		),
		true,
		(
			select (result.payload ->> 'runId')::uuid
			from catalog_health_repair_test_results result
			where result.mode = 'dry_run'
		)
	);

select is(
	(
		select (result.payload ->> 'changedCount')::integer
		from catalog_health_repair_test_results result
		where result.mode = 'apply'
	),
	1,
	'the apply operation records one changed serving'
);

insert into catalog_health_repair_test_results (mode, payload)
select
	'field-dry-run',
	public.run_catalog_health_repair(
		(
			select state.value
			from catalog_health_repair_test_state state
			where state.key = 'field-provenance'
		),
		false,
		null
	);

select is(
	(
		select (result.payload ->> 'candidateCount')::integer
		from catalog_health_repair_test_results result
		where result.mode = 'field-dry-run'
	),
	1,
	'the field dry run finds one exact matching observation'
);

insert into catalog_health_repair_test_results (mode, payload)
select
	'field-apply',
	public.run_catalog_health_repair(
		(
			select state.value
			from catalog_health_repair_test_state state
			where state.key = 'field-provenance'
		),
		true,
		(
			select (result.payload ->> 'runId')::uuid
			from catalog_health_repair_test_results result
			where result.mode = 'field-dry-run'
		)
	);

select is(
	(
		select (result.payload ->> 'changedCount')::integer
		from catalog_health_repair_test_results result
		where result.mode = 'field-apply'
	),
	1,
	'the field repair selects exact source provenance'
);

insert into catalog_health_repair_test_results (mode, payload)
select
	'nutrient-dry-run',
	public.run_catalog_health_repair(
		(
			select state.value
			from catalog_health_repair_test_state state
			where state.key = 'nutrient-provenance'
		),
		false,
		null
	);

select is(
	(
		select (result.payload ->> 'candidateCount')::integer
		from catalog_health_repair_test_results result
		where result.mode = 'nutrient-dry-run'
	),
	1,
	'the nutrient dry run finds one exact matching observation'
);

insert into catalog_health_repair_test_results (mode, payload)
select
	'nutrient-apply',
	public.run_catalog_health_repair(
		(
			select state.value
			from catalog_health_repair_test_state state
			where state.key = 'nutrient-provenance'
		),
		true,
		(
			select (result.payload ->> 'runId')::uuid
			from catalog_health_repair_test_results result
			where result.mode = 'nutrient-dry-run'
		)
	);

select is(
	(
		select (result.payload ->> 'changedCount')::integer
		from catalog_health_repair_test_results result
		where result.mode = 'nutrient-apply'
	),
	1,
	'the nutrient repair selects exact source provenance'
);

reset role;

select is(
	(
		select serving.source_observation_id
		from public.food_servings serving
		where serving.shared_product_id = '81000000-0000-4000-8000-000000000041'
			and serving.is_primary
	),
	'72300000-0000-4000-8000-000000000010'::uuid,
	'the canonical serving links the exact source observation'
);

select ok(
	exists (
		select 1
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = '81000000-0000-4000-8000-000000000041'
			and provenance.field_path = 'servingWeightGrams'
			and provenance.observation_id = '72300000-0000-4000-8000-000000000010'
			and provenance.selected
	),
	'the repair records selected serving-weight provenance'
);

select ok(
	exists (
		select 1
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = '81000000-0000-4000-8000-000000000001'
			and provenance.field_path = 'productName'
			and provenance.observation_id = '81000000-0000-4000-8000-000000000003'
			and provenance.selected
	),
	'the field repair restores product-name provenance from its exact observation'
);

select ok(
	exists (
		select 1
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = '81000000-0000-4000-8000-000000000001'
			and provenance.field_path = 'nutrient:1003'
			and provenance.observation_id = '81000000-0000-4000-8000-000000000003'
			and provenance.selected
	),
	'the nutrient repair restores exact normalized nutrient provenance'
);

select ok(
	exists (
		select 1
		from public.catalog_health_repair_runs applied_run
		join public.catalog_health_repair_runs dry_run
			on dry_run.id = applied_run.dry_run_id
		where applied_run.id = (
			select (result.payload ->> 'runId')::uuid
			from catalog_health_repair_test_results result
			where result.mode = 'apply'
		)
			and applied_run.mode = 'apply'
			and applied_run.status = 'completed'
			and dry_run.mode = 'dry_run'
	),
	'the apply audit row retains its successful dry-run evidence'
);

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'72300000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"72300000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select is(
	public.run_catalog_health_repair(
		(
			select state.value
			from catalog_health_repair_test_state state
			where state.key = 'unresolved-status'
		),
		false,
		null
	) ->> 'status',
	'completed_with_unresolved',
	'a product without source evidence remains unresolved instead of receiving invented provenance'
);

select is(
	(
		public.run_catalog_health_repair(
			(
				select state.value
				from catalog_health_repair_test_state state
				where state.key = 'unresolved-reason'
			),
			false,
			null
		) -> 'items' -> 0 ->> 'reasonCode'
	),
	'no_exact_redistributable_observation',
	'unresolved audit output explains that no matching serving evidence exists'
);

select * from finish();

rollback;
