begin;

select plan(8);

insert into auth.users (id, aud, role, email)
values (
	'74300000-0000-4000-8000-000000000001',
	'authenticated',
	'authenticated',
	'private-classification@blendcalc.local'
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
	'74300000-0000-4000-8000-000000000002',
	'74300000-0000-4000-8000-000000000001',
	'04006381333948',
	'QA Pending Catalog Product',
	'QA Pantry',
	category.id,
	jsonb_build_object(
		'fdcId', -743002,
		'description', 'QA Pending Catalog Product',
		'barcode', '04006381333948',
		'customFood', false,
		'sourceKey', 'unknown',
		'foodNutrients', '[]'::jsonb
	),
	true,
	true,
	jsonb_build_object(
		'front', 'qa/front.png',
		'nutrition', 'qa/nutrition.png',
		'barcode', 'qa/barcode.png'
	),
	jsonb_build_object('valid', true, 'evidenceComplete', true),
	'pending',
	'manual_review'
from public.custom_food_category_options category
where category.enabled
order by category.id
limit 1;

insert into public.user_food_list_items (user_id, list_type, fdc_id, food)
select
	'74300000-0000-4000-8000-000000000001',
	'fridge',
	coalesce((product.food ->> 'fdcId')::bigint, -743001),
	product.food || jsonb_build_object(
		'customFood', true,
		'sourceKey', 'custom'
	)
from public.shared_products product
where product.barcode = '00021130462506'
	and product.status = 'active';

insert into public.user_food_list_items (user_id, list_type, fdc_id, food)
values
	(
		'74300000-0000-4000-8000-000000000001',
		'fridge',
		-743002,
		jsonb_build_object(
			'fdcId', -743002,
			'description', 'QA Pending Catalog Product',
			'barcode', '04006381333948',
			'customFood', true,
			'sourceKey', 'custom',
			'foodNutrients', '[]'::jsonb
		)
	),
	(
		'74300000-0000-4000-8000-000000000001',
		'fridge',
		-743003,
		jsonb_build_object(
			'fdcId', -743003,
			'description', 'Purple Homebrew',
			'customFood', true,
			'sourceKey', 'custom',
			'foodIdentityType', 'private-custom',
			'foodNutrients', '[]'::jsonb
		)
	);

select ok(
	exists (
		select 1
		from public.user_food_list_items item
		join public.shared_products product on product.id = item.shared_product_id
		where item.user_id = '74300000-0000-4000-8000-000000000001'
			and product.barcode = '00021130462506'
			and item.shared_product_submission_id is null
			and item.source_key = case product.source
				when 'community-reviewed' then 'shared-catalog'
				else product.source
			end
			and item.trust_status = case
				when product.confidence in (
					'source-verified',
					'corroborated',
					'moderator-reviewed'
				) then product.confidence
				else 'unverified'
			end
			and (item.food ->> 'customFood')::boolean is false
	),
	'an exact active catalog match clears stale custom state and keeps catalog identity'
);

select ok(
	exists (
		select 1
		from public.user_food_list_items item
		where item.user_id = '74300000-0000-4000-8000-000000000001'
			and item.fdc_id = -743002
			and item.shared_product_id is null
			and item.shared_product_submission_id =
				'74300000-0000-4000-8000-000000000002'
			and item.source_key = 'unknown'
			and item.trust_status = 'pending-review'
			and (item.food ->> 'customFood')::boolean is false
	),
	'a pending shareable submission is actionable but not classified as custom'
);

select ok(
	exists (
		select 1
		from public.user_food_list_items item
		where item.user_id = '74300000-0000-4000-8000-000000000001'
			and item.fdc_id = -743003
			and item.shared_product_id is null
			and item.shared_product_submission_id is null
			and item.source_key = 'custom'
			and item.trust_status = 'user-private'
			and (item.food ->> 'customFood')::boolean is true
	),
	'an unmatched detached private food remains custom'
);

select is(
	(
		select count(*)::integer
		from public.user_food_list_items item
		where item.user_id = '74300000-0000-4000-8000-000000000001'
			and (item.food ->> 'customFood')::boolean
	),
	1,
	'only the detached private food is classified as custom'
);

update public.user_food_list_items
set food = food
where user_id = '74300000-0000-4000-8000-000000000001';

select is(
	(
		select count(*)::integer
		from public.user_food_list_items item
		where item.user_id = '74300000-0000-4000-8000-000000000001'
			and item.shared_product_id is not null
			and (item.food ->> 'customFood')::boolean is false
	),
	1,
	'rehydrating catalog projections keeps the exact match non-custom'
);

select is(
	(
		select count(*)::integer
		from public.user_food_list_items item
		where item.user_id = '74300000-0000-4000-8000-000000000001'
			and item.shared_product_submission_id is not null
			and item.trust_status = 'pending-review'
			and (item.food ->> 'customFood')::boolean is false
	),
	1,
	'rehydrating catalog projections keeps the pending submission non-custom'
);

select is(
	(
		select count(*)::integer
		from public.user_food_list_items item
		where item.user_id = '74300000-0000-4000-8000-000000000001'
			and item.shared_product_id is null
			and item.shared_product_submission_id is null
			and item.trust_status = 'user-private'
			and (item.food ->> 'customFood')::boolean
	),
	1,
	'rehydrating catalog projections preserves the detached private classification'
);

select ok(
	not exists (
		select 1
		from public.user_food_list_items item
		where item.user_id = '74300000-0000-4000-8000-000000000001'
			and item.trust_status = 'pending-review'
			and item.source_key = 'custom'
	),
	'pending review never leaks into the Custom-only source projection'
);

select * from finish();

rollback;
