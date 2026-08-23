begin;

select plan(23);

select ok(
	has_function_privilege(
		'authenticated',
		'public.run_catalog_health_repair(text,boolean,uuid)',
		'execute'
	),
	'authenticated sessions can reach the guarded repair router'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.run_catalog_health_repair(text,boolean,uuid)',
		'execute'
	),
	'anonymous sessions cannot run revision repairs'
);

select ok(
	not has_function_privilege(
		'authenticated',
		'private.run_catalog_revision_history_repair(text,boolean,uuid)',
		'execute'
	),
	'authenticated sessions cannot bypass the public repair router'
);

select ok(
	(
		select issue.automated_repair_allowed
		from public.app_issue_codes issue
		where issue.code = 'CATALOG_REVISION_MISSING'
	)
	and (
		select issue.automated_repair_allowed
		from public.app_issue_codes issue
		where issue.code = 'CATALOG_REVISION_EXPLANATION_MISSING'
	),
	'both evidence-backed revision repairs are enabled'
);

insert into auth.users (id, aud, role, email)
values
	('73300000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'revision-user@blendcalc.local'),
	('73300000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'revision-admin@blendcalc.local');

insert into public.app_role_assignments (user_id, role)
values ('73300000-0000-4000-8000-000000000002', 'admin');

insert into public.shared_product_submissions (
	id,
	submitted_by,
	barcode,
	product_name,
	category_option_id,
	food,
	matched_source,
	matched_reference,
	consent_to_share,
	status,
	verification_status,
	reviewed_by,
	reviewed_at,
	label_observed_at
)
values (
	'73300000-0000-4000-8000-000000000010',
	'73300000-0000-4000-8000-000000000001',
	'00000000007331',
	'Exact Submission Baseline',
	'qa-fruit',
	'{"description":"Exact Submission Baseline","brandOwner":"Evidence Brand"}'::jsonb,
	'usda',
	'7330010',
	true,
	'approved',
	'exact_identity',
	'73300000-0000-4000-8000-000000000002',
	'2026-08-20 10:00:00+00',
	'2026-08-19 09:00:00+00'
);

alter table public.shared_products disable trigger set_shared_product_category_from_submission;

insert into public.shared_products (
	id,
	barcode,
	product_name,
	brand_owner,
	search_text,
	category_option_id,
	food,
	source,
	source_reference,
	confidence,
	status,
	approved_submission_id,
	approved_by
)
values
	(
		'73300000-0000-4000-8000-000000000011',
		'00000000007331',
		'Exact Submission Baseline',
		'Evidence Brand',
		'exact submission baseline evidence brand 00000000007331',
		'qa-fruit',
		'{"description":"Exact Submission Baseline","brandOwner":"Evidence Brand"}'::jsonb,
		'usda',
		'7330010',
		'source-verified',
		'active',
		'73300000-0000-4000-8000-000000000010',
		'73300000-0000-4000-8000-000000000002'
	),
	(
		'73300000-0000-4000-8000-000000000021',
		'00000000007332',
		'Exact Observation Baseline',
		null,
		'exact observation baseline 00000000007332',
		'qa-fruit',
		'{"description":"Exact Observation Baseline"}'::jsonb,
		'usda',
		'7330020',
		'source-verified',
		'active',
		null,
		'73300000-0000-4000-8000-000000000002'
	),
	(
		'73300000-0000-4000-8000-000000000031',
		'00000000007333',
		'Unrecoverable Baseline',
		null,
		'unrecoverable baseline 00000000007333',
		'qa-fruit',
		'{"description":"Unrecoverable Baseline"}'::jsonb,
		'usda',
		'7330030',
		'source-verified',
		'active',
		null,
		'73300000-0000-4000-8000-000000000002'
	),
	(
		'73300000-0000-4000-8000-000000000041',
		'00000000007334',
		'Structured Revision',
		null,
		'structured revision 00000000007334',
		'qa-fruit',
		'{"description":"Structured Revision Updated"}'::jsonb,
		'usda',
		'7330040',
		'source-verified',
		'active',
		null,
		'73300000-0000-4000-8000-000000000002'
	),
	(
		'73300000-0000-4000-8000-000000000051',
		'00000000007335',
		'Unexplained Revision',
		null,
		'unexplained revision 00000000007335',
		'qa-fruit',
		'{"description":"Unexplained Revision Updated"}'::jsonb,
		'usda',
		'7330050',
		'source-verified',
		'active',
		null,
		'73300000-0000-4000-8000-000000000002'
	);

alter table public.shared_products enable trigger set_shared_product_category_from_submission;

insert into public.shared_product_observations (
	id,
	barcode,
	source,
	source_reference,
	source_license,
	raw_payload,
	normalized_food,
	content_hash,
	observed_at
)
select
	'73300000-0000-4000-8000-000000000020',
	'00000000007332',
	'usda',
	'7330020',
	'CC0-1.0',
	'{}'::jsonb,
	product.food,
	repeat('c', 64),
	'2026-08-18 08:00:00+00'
from public.shared_products product
where product.id = '73300000-0000-4000-8000-000000000021';

insert into public.shared_product_revisions (
	id,
	shared_product_id,
	revision_number,
	food,
	source,
	source_reference,
	created_by,
	change_summary,
	label_observed_at
)
values
	(
		'73300000-0000-4000-8000-000000000040',
		'73300000-0000-4000-8000-000000000041',
		1,
		'{"description":"Structured Revision Original"}'::jsonb,
		'usda',
		'7330040',
		'73300000-0000-4000-8000-000000000002',
		'{}'::jsonb,
		'2026-07-01 08:00:00+00'
	),
	(
		'73300000-0000-4000-8000-000000000042',
		'73300000-0000-4000-8000-000000000041',
		2,
		'{"description":"Structured Revision Updated"}'::jsonb,
		'usda',
		'7330040',
		'73300000-0000-4000-8000-000000000002',
		'{"changes":[{"field":"productName","label":"Product name","changeType":"changed","previousValue":"Structured Revision Original","submittedValue":"Structured Revision Updated","severity":"medium"}]}'::jsonb,
		'2026-08-01 08:00:00+00'
	),
	(
		'73300000-0000-4000-8000-000000000050',
		'73300000-0000-4000-8000-000000000051',
		1,
		'{"description":"Unexplained Revision Original"}'::jsonb,
		'usda',
		'7330050',
		'73300000-0000-4000-8000-000000000002',
		'{}'::jsonb,
		'2026-07-01 08:00:00+00'
	),
	(
		'73300000-0000-4000-8000-000000000052',
		'73300000-0000-4000-8000-000000000051',
		2,
		'{"description":"Unexplained Revision Updated"}'::jsonb,
		'usda',
		'7330050',
		'73300000-0000-4000-8000-000000000002',
		'{}'::jsonb,
		'2026-08-01 08:00:00+00'
	);

delete from public.shared_product_revision_changes
where revision_id = '73300000-0000-4000-8000-000000000042';

select ok(
	(
		select count(*) = 3
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.issue_code = 'CATALOG_REVISION_MISSING'
			and occurrence.shared_product_id in (
				'73300000-0000-4000-8000-000000000011',
				'73300000-0000-4000-8000-000000000021',
				'73300000-0000-4000-8000-000000000031'
			)
	)
	and (
		select count(*) = 2
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.issue_code = 'CATALOG_REVISION_EXPLANATION_MISSING'
			and occurrence.shared_product_id in (
				'73300000-0000-4000-8000-000000000041',
				'73300000-0000-4000-8000-000000000051'
			)
	),
	'revision gaps are normalized into actionable occurrences'
);

create temporary table revision_repair_test_state (
	key text primary key,
	value jsonb not null
);
grant all on table revision_repair_test_state to authenticated;

insert into revision_repair_test_state (key, value)
select
	fixture.key,
	to_jsonb((
		select occurrence.occurrence_key
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.shared_product_id = fixture.product_id
			and occurrence.issue_code = fixture.issue_code
		order by occurrence.detected_at
		limit 1
	))
from (
	values
		('submission-occurrence', '73300000-0000-4000-8000-000000000011'::uuid, 'CATALOG_REVISION_MISSING'),
		('observation-occurrence', '73300000-0000-4000-8000-000000000021'::uuid, 'CATALOG_REVISION_MISSING'),
		('unrecoverable-occurrence', '73300000-0000-4000-8000-000000000031'::uuid, 'CATALOG_REVISION_MISSING'),
		('structured-occurrence', '73300000-0000-4000-8000-000000000041'::uuid, 'CATALOG_REVISION_EXPLANATION_MISSING'),
		('unexplained-occurrence', '73300000-0000-4000-8000-000000000051'::uuid, 'CATALOG_REVISION_EXPLANATION_MISSING')
) fixture(key, product_id, issue_code);

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'73300000-0000-4000-8000-000000000001',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"73300000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.run_catalog_health_repair(
		(select value #>> '{}' from revision_repair_test_state where key = 'submission-occurrence'),
		false,
		null
	)$$,
	'42501',
	'MFA-verified catalog repair access is required.',
	'normal users cannot run revision repairs'
);

select set_config(
	'request.jwt.claim.sub',
	'73300000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"73300000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal1"}',
	true
);

select throws_ok(
	$$select public.run_catalog_health_repair(
		(select value #>> '{}' from revision_repair_test_state where key = 'submission-occurrence'),
		false,
		null
	)$$,
	'42501',
	'MFA-verified catalog repair access is required.',
	'revision repairs require MFA verification'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"73300000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

insert into revision_repair_test_state (key, value)
select 'submission-dry-run', public.run_catalog_health_repair(
	(select value #>> '{}' from revision_repair_test_state where key = 'submission-occurrence'),
	false,
	null
);

reset role;

select is(
	(select (value ->> 'candidateCount')::integer from revision_repair_test_state where key = 'submission-dry-run'),
	1,
	'an exact approved submission produces one baseline candidate'
);

select is(
	(select count(*)::integer from public.shared_product_revisions where shared_product_id = '73300000-0000-4000-8000-000000000011'),
	0,
	'a baseline dry run does not mutate revision history'
);

select throws_ok(
	$$select public.run_catalog_health_repair(
		(select value #>> '{}' from revision_repair_test_state where key = 'submission-occurrence'),
		true,
		null
	)$$,
	'A current successful dry run is required before applying this repair',
	'baseline apply requires its current dry run'
);

reset role;

set local role authenticated;

insert into revision_repair_test_state (key, value)
select 'submission-apply', public.run_catalog_health_repair(
	(select value #>> '{}' from revision_repair_test_state where key = 'submission-occurrence'),
	true,
	(select (value ->> 'runId')::uuid from revision_repair_test_state where key = 'submission-dry-run')
);

reset role;

select is(
	(select (value ->> 'changedCount')::integer from revision_repair_test_state where key = 'submission-apply'),
	1,
	'applying the approved-submission baseline records one change'
);

select ok(
	exists (
		select 1
		from public.shared_product_revisions revision
		where revision.shared_product_id = '73300000-0000-4000-8000-000000000011'
			and revision.revision_number = 1
			and revision.submission_id = '73300000-0000-4000-8000-000000000010'
			and revision.label_observed_at = '2026-08-19 09:00:00+00'
			and revision.change_summary #>> '{repairEvidence,kind}' = 'approved_submission'
	),
	'the reconstructed baseline retains its exact submission and observation date'
);

select ok(
	not exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.shared_product_id = '73300000-0000-4000-8000-000000000011'
			and occurrence.issue_code = 'CATALOG_REVISION_MISSING'
	),
	'the repaired baseline closes its normalized issue'
);

insert into revision_repair_test_state (key, value)
select 'observation-dry-run', public.run_catalog_health_repair(
	(select value #>> '{}' from revision_repair_test_state where key = 'observation-occurrence'),
	false,
	null
);

insert into revision_repair_test_state (key, value)
select 'observation-apply', public.run_catalog_health_repair(
	(select value #>> '{}' from revision_repair_test_state where key = 'observation-occurrence'),
	true,
	(select (value ->> 'runId')::uuid from revision_repair_test_state where key = 'observation-dry-run')
);

reset role;

select ok(
	exists (
		select 1
		from public.shared_product_revisions revision
		where revision.shared_product_id = '73300000-0000-4000-8000-000000000021'
			and revision.submission_id is null
			and revision.label_observed_at = '2026-08-18 08:00:00+00'
			and revision.change_summary #>> '{repairEvidence,kind}' = 'source_observation'
			and revision.change_summary #>> '{repairEvidence,id}' = '73300000-0000-4000-8000-000000000020'
	),
	'an exact stored observation can reconstruct a baseline without inventing a submission'
);

insert into revision_repair_test_state (key, value)
select 'unrecoverable-result', public.run_catalog_health_repair(
	(select value #>> '{}' from revision_repair_test_state where key = 'unrecoverable-occurrence'),
	false,
	null
);

reset role;

select ok(
	(select (value ->> 'unresolvedCount')::integer = 1 from revision_repair_test_state where key = 'unrecoverable-result')
	and not exists (
		select 1
		from public.shared_product_revisions revision
		where revision.shared_product_id = '73300000-0000-4000-8000-000000000031'
	),
	'a missing baseline without exact evidence remains unresolved and unchanged'
);

insert into revision_repair_test_state (key, value)
select 'structured-dry-run', public.run_catalog_health_repair(
	(select value #>> '{}' from revision_repair_test_state where key = 'structured-occurrence'),
	false,
	null
);

reset role;

select is(
	(select (value ->> 'candidateCount')::integer from revision_repair_test_state where key = 'structured-dry-run'),
	1,
	'a valid stored change summary produces the exact missing change-row candidate'
);

select is(
	(select count(*)::integer from public.shared_product_revision_changes where revision_id = '73300000-0000-4000-8000-000000000042'),
	0,
	'a change-row dry run does not mutate revision history'
);

insert into revision_repair_test_state (key, value)
select 'structured-apply', public.run_catalog_health_repair(
	(select value #>> '{}' from revision_repair_test_state where key = 'structured-occurrence'),
	true,
	(select (value ->> 'runId')::uuid from revision_repair_test_state where key = 'structured-dry-run')
);

reset role;

select ok(
	exists (
		select 1
		from public.shared_product_revision_changes revision_change
		where revision_change.revision_id = '73300000-0000-4000-8000-000000000042'
			and revision_change.field_path = 'productName'
			and revision_change.previous_value = '"Structured Revision Original"'::jsonb
			and revision_change.new_value = '"Structured Revision Updated"'::jsonb
			and revision_change.severity = 'medium'
	),
	'the apply step restores the exact structured field change'
);

select ok(
	not exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.shared_product_id = '73300000-0000-4000-8000-000000000041'
			and occurrence.issue_code = 'CATALOG_REVISION_EXPLANATION_MISSING'
	),
	'the restored change projection closes its normalized issue'
);

insert into revision_repair_test_state (key, value)
select 'unexplained-result', public.run_catalog_health_repair(
	(select value #>> '{}' from revision_repair_test_state where key = 'unexplained-occurrence'),
	false,
	null
);

reset role;

select ok(
	(select (value ->> 'unresolvedCount')::integer = 1 from revision_repair_test_state where key = 'unexplained-result')
	and not exists (
		select 1
		from public.shared_product_revision_changes revision_change
		where revision_change.revision_id = '73300000-0000-4000-8000-000000000052'
	),
	'unrecoverable field-level history stays explicitly unresolved'
);

select ok(
	exists (
		select 1
		from public.catalog_health_repair_runs run
		where run.issue_code = 'CATALOG_REVISION_MISSING'
			and run.mode = 'apply'
			and run.status = 'completed'
	)
	and exists (
		select 1
		from public.catalog_health_repair_runs run
		where run.issue_code = 'CATALOG_REVISION_EXPLANATION_MISSING'
			and run.mode = 'dry_run'
			and run.status = 'completed_with_unresolved'
	),
	'every revision repair outcome remains in the shared audit history'
);

set local role authenticated;

insert into revision_repair_test_state (key, value)
values ('dashboard', public.get_catalog_data_operations_health(30, 50));

reset role;

select is(
	(select (value #>> '{overview,revisionHistoryGaps}')::integer from revision_repair_test_state where key = 'dashboard'),
	2,
	'the data-operations summary counts only the two unresolved fixture products'
);

select ok(
	(select jsonb_array_length(value #> '{issues,revisions}') >= 2 from revision_repair_test_state where key = 'dashboard'),
	'the data-operations dashboard retains bounded unresolved revision links'
);

select * from finish();
rollback;
