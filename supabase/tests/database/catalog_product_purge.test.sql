begin;

select plan(21);

select ok(
	has_function_privilege(
		'authenticated',
		'public.preview_catalog_product_purge(text)',
		'execute'
	),
	'authenticated sessions can reach the guarded purge preview'
);
select ok(
	not has_function_privilege(
		'anon',
		'public.preview_catalog_product_purge(text)',
		'execute'
	),
	'anonymous sessions cannot preview destructive product purges'
);
select ok(
	has_function_privilege(
		'service_role',
		'public.service_purge_catalog_product_by_barcode(text,text,text)',
		'execute'
	),
	'the maintained operations CLI can reach its service-role purge boundary'
);
select ok(
	not has_table_privilege(
		'authenticated',
		'public.catalog_product_purge_audit',
		'select'
	),
	'authenticated clients cannot browse destructive-operation audit rows'
);

insert into auth.users (id, aud, role, email)
values
	(
		'99920000-0000-4000-8000-000000000001',
		'authenticated',
		'authenticated',
		'purge-user@blendcalc.local'
	),
	(
		'99920000-0000-4000-8000-000000000002',
		'authenticated',
		'authenticated',
		'purge-admin@blendcalc.local'
	);

insert into public.app_role_assignments (user_id, role)
values ('99920000-0000-4000-8000-000000000002', 'admin');

insert into public.shared_product_submissions (
	id,
	submitted_by,
	barcode,
	product_name,
	brand_owner,
	food,
	consent_to_share,
	status,
	verification_status,
	category_option_id,
	submission_kind,
	target_shared_product_id,
	base_revision_id,
	change_summary,
	submission_intent
)
select
	'99920000-0000-4000-8000-000000000011',
	'99920000-0000-4000-8000-000000000002',
	product.barcode,
	product.product_name,
	product.brand_owner,
	product.food,
	true,
	'approved',
	'manual_review',
	product.category_option_id,
	'product_update',
	product.id,
	revision.id,
	'{"changes":[{"field":"productName","label":"Product name","changeType":"changed","severity":"low","previousValue":"Peanut Butter","submittedValue":"Peanut Butter Test"}]}'::jsonb,
	'catalog_correction'
from public.shared_products product
join public.shared_product_revisions revision
	on revision.shared_product_id = product.id
where product.id = '81000000-0000-4000-8000-000000000031'
order by revision.revision_number desc
limit 1;

insert into public.catalog_provider_product_snapshots (
	id,
	shared_product_id,
	provider_key,
	source_reference,
	observation_id,
	content_hash,
	normalized_snapshot,
	observed_at
)
select
	'99920000-0000-4000-8000-000000000012',
	product.id,
	observation.source,
	coalesce(observation.source_reference, product.source_reference),
	observation.id,
	repeat('b', 64),
	product.food,
	now()
from public.shared_products product
join public.shared_product_observations observation
	on observation.barcode = product.barcode
where product.id = '81000000-0000-4000-8000-000000000031'
limit 1;

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"99920000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.preview_catalog_product_purge('00869759000149')$$,
	'42501',
	'MFA-verified catalog repair access is required.',
	'ordinary users cannot preview a product purge'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"99920000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal1"}',
	true
);
select throws_ok(
	$$select public.preview_catalog_product_purge('00869759000149')$$,
	'42501',
	'MFA-verified catalog repair access is required.',
	'data operators must verify MFA before previewing a purge'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"99920000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);
select ok(
	(public.preview_catalog_product_purge('00869759000149') ->> 'found')::boolean,
	'an MFA-verified data operator can preview the exact product graph'
);
select ok(
	not (public.preview_catalog_product_purge('00869759000149') ? 'targets'),
	'the guarded preview does not expose internal database identifiers'
);
select is(
	(
		public.preview_catalog_product_purge('00869759000149')
		-> 'counts'
		->> 'submissions'
	)::integer,
	1,
	'the preview includes the immutable update submission'
);
select is(
	(
		public.preview_catalog_product_purge('00869759000149')
		-> 'counts'
		->> 'providerSnapshots'
	)::integer,
	1,
	'the preview includes the immutable provider snapshot'
);
select throws_ok(
	$$select public.purge_catalog_product_by_barcode('00869759000149', '00011110904416', 'A deliberately mismatched confirmation.')$$,
	'22023',
	'The confirmation UPC / GTIN does not match.',
	'a mismatched UPC confirmation cannot delete anything'
);
select throws_ok(
	$$select public.preview_catalog_product_purge('00869759000148')$$,
	'22023',
	'The UPC / GTIN check digit is invalid.',
	'an invalid UPC check digit is rejected before selection'
);

reset role;
set local role service_role;
select throws_ok(
	$$select public.service_purge_catalog_product_by_barcode('00869759000149', '00869759000149', 'Remove product 00869759000149 from the catalog.')$$,
	'22023',
	'Do not include the UPC / GTIN in the audit reason.',
	'the non-identifying audit reason cannot retain the deleted UPC'
);
select throws_ok(
	$$delete from public.catalog_provider_product_snapshots where id = '99920000-0000-4000-8000-000000000012'$$,
	'P0001',
	'Catalog monitor evidence is immutable',
	'provider snapshot immutability remains active outside the protected purge'
);
select ok(
	(
		public.service_purge_catalog_product_by_barcode(
			'00869759000149',
			'00869759000149',
			'Disposable database test for the complete product graph.'
		) ->> 'deleted'
	)::boolean,
	'the protected service operation completes the exact purge'
);

reset role;
select is(
	(select count(*) from public.shared_products where barcode = '00869759000149'),
	0::bigint,
	'the catalog product is deleted'
);
select is(
	(select count(*) from public.shared_product_submissions where barcode = '00869759000149'),
	0::bigint,
	'the immutable update submission is deleted'
);
select is(
	(select count(*) from public.catalog_provider_product_snapshots where id = '99920000-0000-4000-8000-000000000012'),
	0::bigint,
	'the immutable provider snapshot is deleted'
);
select is(
	(select count(*) from public.shared_product_observations where barcode = '00869759000149'),
	0::bigint,
	'the source observation is deleted'
);
select is(
	(select count(*) from public.user_food_list_items where public.food_normalized_barcode(food) = '00869759000149'),
	0::bigint,
	'user-owned list copies are deleted as disclosed'
);
select ok(
	not exists (
		select 1
		from public.catalog_product_purge_audit audit
		where row_to_json(audit)::text like '%00869759000149%'
			or row_to_json(audit)::text like '%81000000-0000-4000-8000-000000000031%'
	),
	'the audit proves completion without retaining the deleted product identity'
);

select * from finish();
rollback;
