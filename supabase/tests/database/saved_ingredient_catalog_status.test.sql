begin;

select plan(11);

insert into auth.users (id, aud, role, email)
values (
	'74600000-0000-4000-8000-000000000001',
	'authenticated',
	'authenticated',
	'catalog-status@blendcalc.local'
);

insert into public.shared_product_submissions (
	id,
	submitted_by,
	barcode,
	product_name,
	brand_owner,
	category_option_id,
	food,
	consent_to_share,
	evidence_complete,
	evidence_paths,
	validation_report,
	status,
	verification_status
)
select
	status_fixture.id,
	'74600000-0000-4000-8000-000000000001',
	status_fixture.barcode,
	status_fixture.product_name,
	'QA Pantry',
	category.id,
	jsonb_build_object(
		'fdcId', status_fixture.fdc_id,
		'description', status_fixture.product_name,
		'barcode', status_fixture.barcode,
		'customFood', false,
		'sourceKey', 'unknown',
		'foodNutrients', jsonb_build_array(
			jsonb_build_object(
				'nutrientId', 1008,
				'nutrientName', 'Energy',
				'unitName', 'KCAL',
				'value', 100
			)
		)
	),
	true,
	true,
	jsonb_build_object(
		'front', status_fixture.barcode || '/front.png',
		'nutrition', status_fixture.barcode || '/nutrition.png',
		'barcode', status_fixture.barcode || '/barcode.png'
	),
	jsonb_build_object('valid', true, 'evidenceComplete', true),
	'pending',
	'manual_review'
from public.custom_food_category_options category
cross join (
	values
		(
			'74600000-0000-4000-8000-000000000002'::uuid,
			'04006381333948'::text,
			'QA Pending Catalog Product'::text,
			-746002::bigint
		),
		(
			'74600000-0000-4000-8000-000000000003'::uuid,
			'04006381334006'::text,
			'QA Rejected Catalog Product'::text,
			-746003::bigint
		)
) status_fixture(id, barcode, product_name, fdc_id)
where category.enabled
order by category.id
limit 2;

insert into public.user_food_list_items (user_id, list_type, fdc_id, food)
values
	(
		'74600000-0000-4000-8000-000000000001',
		'fridge',
		-746002,
		jsonb_build_object(
			'fdcId', -746002,
			'description', 'QA Pending Catalog Product',
			'barcode', '04006381333948',
			'customFood', false,
			'sourceKey', 'unknown',
			'foodNutrients', '[]'::jsonb
		)
	),
	(
		'74600000-0000-4000-8000-000000000001',
		'shopping',
		-746003,
		jsonb_build_object(
			'fdcId', -746003,
			'description', 'QA Rejected Catalog Product',
			'barcode', '04006381334006',
			'customFood', false,
			'sourceKey', 'unknown',
			'foodNutrients', '[]'::jsonb
		)
	);

select is(
	(
		select count(*)::integer
		from public.user_food_list_items item
		where item.user_id = '74600000-0000-4000-8000-000000000001'
			and item.trust_status = 'pending-review'
			and item.shared_product_submission_id is not null
	),
	2,
	'both evidence-backed submissions begin as Pending saved ingredients'
);

select ok(
	not exists (
		select 1
		from public.shared_products product
		where product.barcode in ('04006381333948', '04006381334006')
	),
	'pending submissions are unavailable from the active shared catalog'
);

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
	approved_submission_id
)
select
	'74600000-0000-4000-8000-000000000004',
	'04006381333948',
	'QA Pending Catalog Product',
	'QA Pantry',
	'qa pending catalog product qa pantry 04006381333948',
	category.id,
	jsonb_build_object(
		'fdcId', -746002,
		'description', 'QA Pending Catalog Product',
		'brandOwner', 'QA Pantry',
		'barcode', '04006381333948',
		'customFood', false,
		'sourceKey', 'shared-catalog',
		'foodNutrients', jsonb_build_array(
			jsonb_build_object(
				'nutrientId', 1008,
				'nutrientName', 'Energy',
				'unitName', 'KCAL',
				'value', 100
			)
		)
	),
	'community-reviewed',
	'catalog-status-qa',
	'moderator-reviewed',
	'74600000-0000-4000-8000-000000000002'
from public.custom_food_category_options category
where category.enabled
order by category.id
limit 1;

update public.shared_product_submissions
set
	status = 'approved',
	reviewed_at = now(),
	reviewed_by = '74600000-0000-4000-8000-000000000001'
where id = '74600000-0000-4000-8000-000000000002';

select ok(
	exists (
		select 1
		from public.user_food_list_items item
		where item.user_id = '74600000-0000-4000-8000-000000000001'
			and item.fdc_id = -746002
			and item.shared_product_id = '74600000-0000-4000-8000-000000000004'
			and item.shared_product_submission_id is null
			and item.source_key = 'shared-catalog'
			and item.trust_status = 'moderator-reviewed'
	),
	'approving a submission replaces Pending with the canonical catalog state'
);

select is(
	(
		select count(*)::integer
		from public.user_food_list_items item
		where item.user_id = '74600000-0000-4000-8000-000000000001'
			and item.food_identity_key = 'barcode:04006381333948'
	),
	1,
	'approval updates the original saved ingredient without creating a duplicate'
);

select ok(
	exists (
		select 1
		from public.shared_products product
		where product.barcode = '04006381333948'
			and product.status = 'active'
	),
	'the approved product is available from the active shared catalog'
);

update public.shared_product_submissions
set
	status = 'rejected',
	review_note = 'QA catalog status transition',
	reviewed_at = now(),
	reviewed_by = '74600000-0000-4000-8000-000000000001'
where id = '74600000-0000-4000-8000-000000000003';

select ok(
	exists (
		select 1
		from public.user_food_list_items item
		where item.user_id = '74600000-0000-4000-8000-000000000001'
			and item.fdc_id = -746003
			and item.list_type = 'shopping'
			and item.shared_product_id is null
			and item.shared_product_submission_id is null
			and item.trust_status <> 'pending-review'
	),
	'rejection removes Pending while retaining the user saved ingredient'
);

select is(
	(
		select count(*)::integer
		from public.user_food_list_items item
		where item.user_id = '74600000-0000-4000-8000-000000000001'
			and item.food_identity_key = 'barcode:04006381334006'
	),
	1,
	'rejection keeps exactly one Shopping List item'
);

select ok(
	not exists (
		select 1
		from public.shared_products product
		where product.barcode = '04006381334006'
	),
	'a rejected submission never enters the shared catalog'
);

select is(
	(
		select status
		from public.shared_product_submissions submission
		where submission.id = '74600000-0000-4000-8000-000000000003'
	),
	'rejected',
	'the rejected submission retains its review outcome'
);

select is(
	(
		select review_note
		from public.shared_product_submissions submission
		where submission.id = '74600000-0000-4000-8000-000000000003'
	),
	'QA catalog status transition',
	'the rejected submission retains its moderator note'
);

select is(
	(
		select count(*)::integer
		from public.user_food_list_items item
		where item.user_id = '74600000-0000-4000-8000-000000000001'
	),
	2,
	'catalog moderation never duplicates or deletes the user saved records'
);

select * from finish();

rollback;
