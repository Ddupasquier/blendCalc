begin;

select plan(31);

select ok(
	has_function_privilege(
		'authenticated',
		'public.get_dataset_import_evidence_workspace(text)',
		'execute'
	),
	'authenticated sessions can reach the guarded dataset evidence workspace'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.preview_dataset_import_evidence(text,text,timestamptz,text,text)',
		'execute'
	),
	'authenticated sessions can reach the guarded dataset evidence preview'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.apply_dataset_import_evidence(uuid,text)',
		'execute'
	),
	'authenticated sessions can reach the guarded dataset evidence apply function'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.get_dataset_import_evidence_workspace(text)',
		'execute'
	),
	'anonymous sessions cannot open dataset evidence work'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.generic_food_dataset_import_evidence_runs',
		'select'
	),
	'authenticated clients cannot read dataset evidence history directly'
);

select ok(
	has_table_privilege(
		'service_role',
		'public.generic_food_dataset_import_evidence_runs',
		'select'
	),
	'trusted server workflows can read dataset evidence history'
);

insert into auth.users (id, aud, role, email)
values
	('77600000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'dataset-user@blendcalc.local'),
	('77600000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'dataset-admin@blendcalc.local');

insert into public.app_role_assignments (user_id, role)
values ('77600000-0000-4000-8000-000000000002', 'admin');

create temporary table dataset_evidence_test_state (
	key text primary key,
	value uuid not null
);
grant all on table dataset_evidence_test_state to authenticated;

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'77600000-0000-4000-8000-000000000001',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"77600000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.get_dataset_import_evidence_workspace('cnf-2026')$$,
	'42501',
	'MFA-verified dataset evidence access is required.',
	'normal users cannot open dataset evidence work'
);

select throws_ok(
	$$select public.preview_dataset_import_evidence(
		'cnf-2026',
		'2026',
		'2026-09-10T20:00:00Z',
		repeat('a', 64),
		'https://example.test/import-log'
	)$$,
	'42501',
	'MFA-verified dataset evidence access is required.',
	'normal users cannot preview dataset evidence'
);

select set_config(
	'request.jwt.claim.sub',
	'77600000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"77600000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal1"}',
	true
);

select throws_ok(
	$$select public.get_dataset_import_evidence_workspace('cnf-2026')$$,
	'42501',
	'MFA-verified dataset evidence access is required.',
	'admins must verify MFA before opening dataset evidence work'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"77600000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select lives_ok(
	$$select public.get_dataset_import_evidence_workspace('cnf-2026')$$,
	'MFA-verified admins can open dataset evidence work'
);

select is(
	public.get_dataset_import_evidence_workspace('cnf-2026') ->> 'actionRequired',
	'true',
	'the workspace identifies an actionable incomplete import'
);

select is(
	jsonb_array_length(
		public.get_dataset_import_evidence_workspace('cnf-2026') -> 'missingEvidence'
	),
	2,
	'the workspace names both missing canonical evidence fields'
);

select throws_ok(
	$$select public.preview_dataset_import_evidence(
		'cnf-2026',
		'wrong-release',
		'2026-09-10T20:00:00Z',
		repeat('a', 64),
		'https://example.test/import-log'
	)$$,
	'P0001',
	'The confirmed release version does not match the stored dataset release.',
	'a preview cannot target the wrong release'
);

select throws_ok(
	$$select public.preview_dataset_import_evidence(
		'cnf-2026',
		'2026',
		'2026-09-10T20:00:00Z',
		'not-a-checksum',
		'https://example.test/import-log'
	)$$,
	'P0001',
	'The source file checksum must be a 64-character SHA-256 value.',
	'a preview rejects an invalid checksum'
);

select is(
	public.preview_dataset_import_evidence(
		'cnf-2026',
		'2026',
		null,
		null,
		'https://example.test/import-log'
	) ->> 'outcome',
	'no_change',
	'an incomplete preview reports an explicit no-change outcome'
);

reset role;

select ok(
	exists (
		select 1
		from public.generic_food_datasets dataset
		where dataset.key = 'cnf-2026'
			and dataset.imported_at is null
			and dataset.source_file_sha256 is null
	),
	'a no-change preview leaves canonical evidence untouched'
);

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'77600000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"77600000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

insert into dataset_evidence_test_state (key, value)
select
	'cnf-preview',
	(public.preview_dataset_import_evidence(
		'cnf-2026',
		'2026',
		'2026-09-10T20:00:00Z',
		repeat('a', 64),
		'https://example.test/import-log'
	) ->> 'previewId')::uuid;

reset role;

select is(
	(
		select run.outcome
		from public.generic_food_dataset_import_evidence_runs run
		join dataset_evidence_test_state state
			on state.key = 'cnf-preview' and state.value = run.id
	),
	'candidate',
	'a complete preview records a candidate outcome'
);

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'77600000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"77600000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select is(
	(
		select public.preview_dataset_import_evidence(
			'cofid-2021',
			'2021',
			'2026-09-10T21:00:00Z',
			repeat('b', 64),
			'https://example.test/cofid-import-log'
		) ->> 'willClearFinding'
	),
	'true',
	'a complete preview states that the exact health finding will clear'
);

reset role;

select is(
	(
		select dataset.imported_at
		from public.generic_food_datasets dataset
		where dataset.key = 'cnf-2026'
	),
	null,
	'previewing a valid change still does not edit canonical evidence'
);

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'77600000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"77600000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.apply_dataset_import_evidence(
		(select state.value from dataset_evidence_test_state state where state.key = 'cnf-preview'),
		'short'
	)$$,
	'P0001',
	'A private review note between 10 and 2000 characters is required.',
	'apply requires a meaningful private audit note'
);

select is(
	public.apply_dataset_import_evidence(
		(select state.value from dataset_evidence_test_state state where state.key = 'cnf-preview'),
		'Compared the retained import log and local SHA-256 output.'
	) ->> 'findingCleared',
	'true',
	'applying a current preview confirms that the health finding cleared'
);

reset role;

select ok(
	exists (
		select 1
		from public.generic_food_datasets dataset
		where dataset.key = 'cnf-2026'
			and dataset.imported_at = '2026-09-10T20:00:00Z'::timestamptz
			and dataset.source_file_sha256 = repeat('a', 64)
	),
	'apply records the canonical import time and SHA-256'
);

select is(
	(
		select dataset.metadata -> 'importEvidence' ->> 'sourceReference'
		from public.generic_food_datasets dataset
		where dataset.key = 'cnf-2026'
	),
	'https://example.test/import-log',
	'the canonical dataset metadata retains the evidence reference'
);

select is(
	(
		select count(*)::integer
		from public.generic_food_dataset_import_evidence_runs run
		where run.dataset_key = 'cnf-2026'
			and run.mode in ('preview', 'apply')
			and run.outcome in ('candidate', 'applied')
	),
	2,
	'the successful preview and apply remain in append-only audit history'
);

select ok(
	not exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.subject_type = 'generic_food_dataset'
			and occurrence.subject_key = 'cnf-2026'
			and occurrence.issue_code = 'DATASET_IMPORT_EVIDENCE_MISSING'
	),
	'the proven dataset finding disappears from the owning health view'
);

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'77600000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"77600000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.apply_dataset_import_evidence(
		(select state.value from dataset_evidence_test_state state where state.key = 'cnf-preview'),
		'Trying to apply the same preview a second time.'
	)$$,
	'P0001',
	'This evidence preview has already been applied.',
	'a preview cannot be applied twice'
);

select is(
	public.get_dataset_import_evidence_workspace('cnf-2026') ->> 'actionRequired',
	'false',
	'the refreshed workspace reports no remaining action'
);

select is(
	public.get_dataset_import_evidence_workspace('cnf-2026')
		-> 'latestDecision' ->> 'reviewNote',
	'Compared the retained import log and local SHA-256 output.',
	'the completed workspace retains the private decision receipt'
);

select is(
	public.preview_dataset_import_evidence(
		'cnf-2026',
		'2026',
		'2026-09-10T20:00:00Z',
		repeat('a', 64),
		'https://example.test/import-log'
	) ->> 'outcome',
	'already_complete',
	'a direct revisit reports an already-complete outcome instead of another change'
);

insert into dataset_evidence_test_state (key, value)
select
	'cofid-stale',
	(public.preview_dataset_import_evidence(
		'cofid-2021',
		'2021',
		'2026-09-10T21:00:00Z',
		repeat('b', 64),
		'https://example.test/cofid-import-log'
	) ->> 'previewId')::uuid;

reset role;
update public.generic_food_datasets
set display_name = display_name || ' updated'
where key = 'cofid-2021';

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'77600000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"77600000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.apply_dataset_import_evidence(
		(select state.value from dataset_evidence_test_state state where state.key = 'cofid-stale'),
		'This stale preview should not change canonical evidence.'
	)$$,
	'P0001',
	'The dataset changed after this preview. Preview the current evidence again.',
	'apply rejects a stale dataset snapshot'
);

reset role;
delete from public.app_role_permissions
where role = 'admin'
	and permission = 'data_operations.catalog_health.repair';

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'77600000-0000-4000-8000-000000000002',
	true
);
select set_config(
	'request.jwt.claims',
	'{"sub":"77600000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.get_dataset_import_evidence_workspace('cofid-2021')$$,
	'42501',
	'MFA-verified dataset evidence access is required.',
	'an elevated account without the exact repair permission cannot open the workflow'
);

select * from finish();
rollback;
