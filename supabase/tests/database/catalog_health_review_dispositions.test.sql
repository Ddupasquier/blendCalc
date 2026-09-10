begin;

select plan(24);

select ok(
	has_function_privilege(
		'authenticated',
		'public.finish_catalog_health_product_review(uuid,text)',
		'execute'
	),
	'authenticated sessions can reach the guarded finish-review workflow'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.finish_catalog_health_product_review(uuid,text)',
		'execute'
	),
	'anonymous sessions cannot finish product reviews'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.catalog_health_review_dispositions',
		'select'
	),
	'authenticated clients cannot read disposition audit rows directly'
);

insert into auth.users (id, aud, role, email)
values
	('72900000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'disposition-user@blendcalc.local'),
	('72900000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'disposition-admin@blendcalc.local');

insert into public.app_role_assignments (user_id, role)
values ('72900000-0000-4000-8000-000000000002', 'admin');

insert into public.food_servings (
	shared_product_id,
	serving_order,
	label,
	gram_weight,
	is_primary,
	source,
	confidence
)
values (
	'81000000-0000-4000-8000-000000000041',
	1,
	'1 bottle',
	355,
	true,
	'unknown',
	'unknown'
);

create temporary table catalog_health_disposition_test_state (
	key text primary key,
	value text not null
);

insert into catalog_health_disposition_test_state (key, value)
select 'serving-occurrence', occurrence.occurrence_key
from public.catalog_health_actionable_issue_occurrences occurrence
where occurrence.shared_product_id = '81000000-0000-4000-8000-000000000041'
	and occurrence.issue_code = 'CATALOG_SERVING_PROVENANCE_MISSING';

grant select, insert on table catalog_health_disposition_test_state to authenticated;

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72900000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.finish_catalog_health_product_review('81000000-0000-4000-8000-000000000041', 'No approved source provides the missing information.')$$,
	'42501',
	'MFA-verified catalog repair access is required.',
	'ordinary users cannot finish catalog-health product reviews'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72900000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal1"}',
	true
);

select throws_ok(
	$$select public.finish_catalog_health_product_review('81000000-0000-4000-8000-000000000041', 'No approved source provides the missing information.')$$,
	'42501',
	'MFA-verified catalog repair access is required.',
	'data operators must verify MFA before finishing a review'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72900000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select ok(
	exists (
		select 1
		from jsonb_array_elements(
			public.get_blendcalc_api_catalog_product_readiness_passport(
				'81000000-0000-4000-8000-000000000041'
			) -> 'issues'
		) issue
		where issue ->> 'sourceReason' like 'missing_required_nutrient:%'
			and nullif(issue #>> '{parameters,displayName}', '') is not null
	),
	'missing required nutrients include their canonical human-readable name'
);

select ok(
	exists (
		select 1
		from jsonb_array_elements(
			public.get_catalog_data_operations_health() #> '{issues,publication}'
		) product_issue
		cross join lateral jsonb_array_elements(
			product_issue -> 'reasonDetails'
		) reason
		where reason ->> 'reason' like 'missing_required_nutrient:%'
			and nullif(reason #>> '{parameters,displayName}', '') is not null
	),
	'the data-operations queue names missing nutrients for human review'
);

select ok(
	exists (
		select 1
		from jsonb_array_elements(
			public.get_catalog_data_operations_health() #> '{issues,publication}'
		) product_issue
		where jsonb_typeof(product_issue -> 'reasons') = 'array'
			and jsonb_typeof(product_issue -> 'reasons' -> 0) = 'string'
	),
	'the schema-first migration preserves the deployed dashboard reasons contract'
);

reset role;

select ok(
	(
		select count(*)
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.shared_product_id = '81000000-0000-4000-8000-000000000041'
			and occurrence.source_scope = 'blendcalc_api_publication'
	) > 0,
	'the fixture has raw API-publication readiness issues'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72900000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.finish_catalog_health_product_review('81000000-0000-4000-8000-000000000041', 'No approved source provides the missing information.')$$,
	'P0001',
	'Run every available safe repair check before finishing this review.',
	'the product review cannot finish before every safe check is inconclusive'
);

select lives_ok(
	$$select public.run_catalog_health_repair((select value from catalog_health_disposition_test_state where key = 'serving-occurrence'), false, null)$$,
	'an available safe repair can be checked without changing the product'
);

reset role;

select is(
	(
		select repair_run.candidate_count
		from public.catalog_health_repair_runs repair_run
		where repair_run.requested_by = '72900000-0000-4000-8000-000000000002'
			and repair_run.occurrence_key = (
				select value
				from catalog_health_disposition_test_state
				where key = 'serving-occurrence'
			)
		order by repair_run.started_at desc
		limit 1
	),
	0,
	'the safe check is recorded as inconclusive'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72900000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

insert into catalog_health_disposition_test_state (key, value)
select
	'action-count-before',
	public.get_privileged_tool_action_summary()
		->> 'pendingCatalogDataOperations';

select lives_ok(
	$$select public.finish_catalog_health_product_review('81000000-0000-4000-8000-000000000041', 'The current label and approved sources do not provide the missing evidence.')$$,
	'an inconclusive product review can be deliberately finished'
);

reset role;

select is(
	(
		select count(*)
		from public.catalog_health_review_dispositions disposition
		where disposition.shared_product_id = '81000000-0000-4000-8000-000000000041'
			and disposition.outcome = 'accepted_withheld'
	),
	1::bigint,
	'the finish action records one append-only accepted-withheld outcome'
);

select is(
	(
		select count(*)
		from public.catalog_health_actionable_issue_occurrences occurrence
		where occurrence.shared_product_id = '81000000-0000-4000-8000-000000000041'
			and occurrence.source_scope = 'blendcalc_api_publication'
	),
	0::bigint,
	'the exact reviewed issue snapshot leaves the actionable work queue'
);

select ok(
	(
		select count(*)
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.shared_product_id = '81000000-0000-4000-8000-000000000041'
			and occurrence.source_scope = 'blendcalc_api_publication'
	) > 0,
	'raw readiness diagnostics remain intact for audit and reevaluation'
);

select is(
	(
		select readiness.publishable
		from public.blendcalc_api_v1_product_readiness readiness
		where readiness.shared_product_id = '81000000-0000-4000-8000-000000000041'
	),
	false,
	'finishing the review does not publish the product through blendCalcAPI v1'
);

select is(
	(
		select product.status
		from public.shared_products product
		where product.id = '81000000-0000-4000-8000-000000000041'
	),
	'active',
	'finishing the review keeps the product available inside blendCalc'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72900000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select is(
	(
		public.get_privileged_tool_action_summary()
			->> 'pendingCatalogDataOperations'
	)::integer,
	(
		select value::integer - 1
		from catalog_health_disposition_test_state
		where key = 'action-count-before'
	),
	'the Profile launcher actionable count removes the finished product'
);

select ok(
	public.get_blendcalc_api_catalog_product_readiness_passport(
		'81000000-0000-4000-8000-000000000041'
	) -> 'reviewDisposition' is not null
	and jsonb_array_length(
		public.get_blendcalc_api_catalog_product_readiness_passport(
			'81000000-0000-4000-8000-000000000041'
		) -> 'issues'
	) = 0,
	'the passport explains the completed disposition without showing actionable issues'
);

reset role;

update public.shared_products product
set updated_at = product.updated_at + interval '1 second'
where product.id = '81000000-0000-4000-8000-000000000041';

select is(
	(
		select count(*)
		from public.catalog_health_review_dispositions disposition
		where disposition.shared_product_id = '81000000-0000-4000-8000-000000000041'
	),
	1::bigint,
	'the historical disposition remains immutable after product evidence changes'
);

select ok(
	(
		select count(*)
		from public.catalog_health_actionable_issue_occurrences occurrence
		where occurrence.shared_product_id = '81000000-0000-4000-8000-000000000041'
			and occurrence.source_scope = 'blendcalc_api_publication'
	) > 0,
	'changed product evidence automatically reopens the current issue snapshot'
);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72900000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select ok(
	public.get_blendcalc_api_catalog_product_readiness_passport(
		'81000000-0000-4000-8000-000000000041'
	) -> 'reviewDisposition' = 'null'::jsonb
	and jsonb_array_length(
		public.get_blendcalc_api_catalog_product_readiness_passport(
			'81000000-0000-4000-8000-000000000041'
		) -> 'issues'
	) > 0,
	'the reopened passport returns to actionable work without deleting history'
);

select is(
	(
		public.get_privileged_tool_action_summary()
			->> 'pendingCatalogDataOperations'
	)::integer,
	(
		select value::integer
		from catalog_health_disposition_test_state
		where key = 'action-count-before'
	),
	'the Profile launcher actionable count restores the changed product'
);

select * from finish();

rollback;
