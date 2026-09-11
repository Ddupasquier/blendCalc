begin;

select plan(13);

select has_function(
	'private',
	'catalog_revision_snapshot_change_summary',
	array['jsonb', 'jsonb'],
	'exact stored revision snapshots have a deterministic comparison function'
);

select has_function(
	'public',
	'get_catalog_product_revision_context',
	array['uuid'],
	'privileged product readiness has a bounded revision context reader'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.get_catalog_product_revision_context(uuid)',
		'execute'
	),
	'authenticated sessions can reach the guarded revision context reader'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.get_catalog_product_revision_context(uuid)',
		'execute'
	),
	'anonymous sessions cannot read revision context'
);

insert into public.shared_product_revisions (
	id,
	shared_product_id,
	revision_number,
	category_option_id,
	food,
	source,
	source_reference,
	change_summary,
	label_observed_at,
	created_at
)
select
	'74100000-0000-4000-8000-000000000002',
	revision.shared_product_id,
	2,
	revision.category_option_id,
	jsonb_set(
		revision.food,
		'{fieldProvenance}',
		coalesce(revision.food -> 'fieldProvenance', '{}'::jsonb)
			|| jsonb_build_object(
				'ingredients',
				jsonb_build_object(
					'source', 'usda',
					'confidence', 'source-verified',
					'sourceReference', 'qa-revision-source'
				)
			),
		true
	),
	revision.source,
	revision.source_reference,
	'{}'::jsonb,
	'2026-09-11T12:00:00Z',
	'2026-09-11T12:00:00Z'
from public.shared_product_revisions revision
where revision.shared_product_id = '81000000-0000-4000-8000-000000000061'
	and revision.revision_number = 1;

select ok(
	public.catalog_change_summary_is_valid(
		(
			select revision.change_summary
			from public.shared_product_revisions revision
			where revision.id = '74100000-0000-4000-8000-000000000002'
		),
		true
	),
	'a later revision without a supplied summary receives a valid exact summary'
);

select is(
	(
		select revision.supersedes_revision_id
		from public.shared_product_revisions revision
		where revision.id = '74100000-0000-4000-8000-000000000002'
	),
	(
		select revision.id
		from public.shared_product_revisions revision
		where revision.shared_product_id = '81000000-0000-4000-8000-000000000061'
			and revision.revision_number = 1
	),
	'a later revision is linked to its exact predecessor'
);

select ok(
	exists (
		select 1
		from public.shared_product_revision_changes change
		where change.revision_id = '74100000-0000-4000-8000-000000000002'
			and change.field_path like 'fieldProvenance.ingredients.%'
			and change.field_label like 'Ingredient evidence%'
	),
	'the exact provenance difference is stored in human-readable change rows'
);

select ok(
	not exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.shared_product_id = '81000000-0000-4000-8000-000000000061'
			and occurrence.issue_code = 'CATALOG_REVISION_EXPLANATION_MISSING'
	),
	'a reconstructable revision does not enter the manual review queue'
);

insert into auth.users (id, aud, role, email)
values
	('74100000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'revision-user@blendcalc.local'),
	('74100000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'revision-admin@blendcalc.local');

insert into public.app_role_assignments (user_id, role)
values ('74100000-0000-4000-8000-000000000011', 'admin');

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"74100000-0000-4000-8000-000000000010","role":"authenticated","app_role":"user","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.get_catalog_product_revision_context('81000000-0000-4000-8000-000000000061')$$,
	'42501',
	'MFA-verified catalog access is required.',
	'ordinary users cannot read privileged revision context'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"74100000-0000-4000-8000-000000000011","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

select is(
	public.get_catalog_product_revision_context(
		'81000000-0000-4000-8000-000000000061'
	) #>> '{0,number}',
	'2',
	'the newest revision appears first in the privileged history'
);

select ok(
	exists (
		select 1
		from jsonb_array_elements(
			public.get_catalog_product_revision_context(
				'81000000-0000-4000-8000-000000000061'
			) #> '{0,changes}'
		) change
		where change ->> 'fieldLabel' like 'Ingredient evidence%'
			and change ->> 'changeType' in ('added', 'changed')
	),
	'the reader explains the exact revision distinction in words'
);

reset role;

select throws_ok(
	$$
		insert into public.shared_product_revisions (
			id,
			shared_product_id,
			revision_number,
			category_option_id,
			food,
			source,
			source_reference,
			change_summary,
			label_observed_at,
			created_at
		)
		select
			'74100000-0000-4000-8000-000000000003',
			revision.shared_product_id,
			3,
			revision.category_option_id,
			revision.food,
			revision.source,
			revision.source_reference,
			'{}'::jsonb,
			'2026-09-11T12:05:00Z',
			'2026-09-11T12:05:00Z'
		from public.shared_product_revisions revision
		where revision.id = '74100000-0000-4000-8000-000000000002'
	$$,
	'P0001',
	'Catalog revision 3 duplicates revision 2 without a stored change',
	'truly duplicate revision snapshots are rejected instead of creating repeat work'
);

select is(
	(
		select count(*)::integer
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.issue_code = 'CATALOG_REVISION_EXPLANATION_MISSING'
	),
	0,
	'the migration backfills all reconstructable local revision explanations'
);

select * from finish();
rollback;
