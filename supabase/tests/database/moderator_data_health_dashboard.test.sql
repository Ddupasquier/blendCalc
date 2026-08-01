begin;

select plan(13);

select ok(
	not has_function_privilege(
		'anon',
		'public.get_moderator_data_health(integer, integer)',
		'execute'
	),
	'anonymous clients cannot execute the moderator data-health read'
);

select ok(
	has_function_privilege(
		'authenticated',
		'public.get_moderator_data_health(integer, integer)',
		'execute'
	),
	'authenticated sessions can reach the role-gated function'
);

select ok(
	not has_function_privilege(
		'service_role',
		'public.get_moderator_data_health(integer, integer)',
		'execute'
	),
	'the service role does not bypass the named moderator read'
);

insert into auth.users (id, aud, role, email)
values
	(
		'71000000-0000-4000-8000-000000000001',
		'authenticated',
		'authenticated',
		'data-health-user@blendcalc.local'
	),
	(
		'71000000-0000-4000-8000-000000000002',
		'authenticated',
		'authenticated',
		'data-health-moderator@blendcalc.local'
	);

insert into public.app_role_assignments (user_id, role)
values ('71000000-0000-4000-8000-000000000002', 'moderator');

set local role authenticated;
select set_config(
	'request.jwt.claim.sub',
	'71000000-0000-4000-8000-000000000001',
	true
);

select throws_ok(
	$$select public.get_moderator_data_health(30, 20)$$,
	'42501',
	'Moderator access is required.',
	'ordinary authenticated users cannot read moderator data health'
);

select set_config(
	'request.jwt.claim.sub',
	'71000000-0000-4000-8000-000000000002',
	true
);

reset role;

select is(
	(public.get_moderator_data_health(999, 999) ->> 'metricWindowDays')::integer,
	90,
	'the metric window is bounded'
);

select is(
	(public.get_moderator_data_health(999, 999) ->> 'issueLimit')::integer,
	50,
	'the issue-list limit is bounded'
);

select is(
	(public.get_moderator_data_health(30, 20) #>> '{overview,activeProducts}')::bigint,
	(select count(*) from public.shared_products product where product.status = 'active'),
	'active product count matches its reproducible audit query'
);

select is(
	(public.get_moderator_data_health(30, 20) #>> '{overview,unresolvedConflicts}')::bigint,
	(select count(*) from public.shared_product_conflicts conflict where conflict.status = 'open'),
	'unresolved conflict count matches its reproducible audit query'
);

select is(
	(public.get_moderator_data_health(30, 20) #>> '{overview,nutrientMappingReviewGaps}')::bigint,
	(
		select count(*)
		from public.nutrient_source_mappings mapping
		where mapping.review_status <> 'approved'
			or mapping.reviewed_at is null
			or nullif(btrim(mapping.review_reference), '') is null
	),
	'nutrient mapping gap count matches its reproducible audit query'
);

select is(
	jsonb_array_length(public.get_moderator_data_health(30, 20) -> 'datasets'),
	(select count(*)::integer from public.generic_food_datasets),
	'each registered dataset has one bounded summary'
);

select ok(
	not exists (
		select 1
		from jsonb_array_elements(
			public.get_moderator_data_health(30, 20) -> 'sources'
		) source_summary
		where source_summary ? 'details'
			or source_summary ? 'provenance'
	),
	'source summaries omit raw evaluation details and provenance payloads'
);

select ok(
	not exists (
		select 1
		from jsonb_array_elements(
			public.get_moderator_data_health(30, 20) -> 'datasets'
		) dataset_summary
		where dataset_summary ? 'downloadUrl'
			or dataset_summary ? 'metadata'
	),
	'dataset summaries omit download locations and metadata payloads'
);

select is(
	(public.get_moderator_data_health(30, 20) #>> '{policy,version}')::integer,
	(
		select policy.version_number
		from public.food_compatibility_policy_versions policy
		where policy.status = 'active'
		order by policy.version_number desc
		limit 1
	),
	'the policy summary identifies the active immutable policy'
);

select * from finish();

rollback;
