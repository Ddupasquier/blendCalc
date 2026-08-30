begin;

select plan(3);

insert into public.shared_product_submissions (
	id,
	submitted_by,
	barcode,
	product_name,
	category_option_id,
	food,
	consent_to_share,
	status,
	evidence_complete,
	submission_kind,
	submission_intent
)
select
	'73100000-0000-4000-8000-000000000001'::uuid,
	user_row.id,
	'07310000000001',
	'QA Serving Provenance Product',
	category.id,
	jsonb_build_object(
		'description', 'QA Serving Provenance Product',
		'foodCategory', category.label,
		'foodNutrients', '[]'::jsonb
	),
	true,
	'approved',
	true,
	'new_product',
	'catalog_share'
from public.custom_food_category_options category
cross join lateral (
	select id
	from auth.users
	where email = 'qa-moderator@blendcalc.local'
	limit 1
) user_row
where category.enabled
order by category.id
limit 1;

insert into public.shared_products (
	id,
	barcode,
	product_name,
	search_text,
	category_option_id,
	food,
	source,
	source_reference,
	confidence,
	canonical_provenance,
	status,
	approved_submission_id
)
select
	'73100000-0000-4000-8000-000000000002'::uuid,
	submission.barcode,
	submission.product_name,
	'qa serving provenance product 07310000000001',
	submission.category_option_id,
	submission.food,
	'community-reviewed',
	'qa:serving-provenance',
	'moderator-reviewed',
	'{}'::jsonb,
	'active',
	submission.id
from public.shared_product_submissions submission
where submission.id = '73100000-0000-4000-8000-000000000001'::uuid;

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
	'73100000-0000-4000-8000-000000000003'::uuid,
	'07310000000001',
	'open-food-facts',
	'07310000000001',
	'ODbL-1.0',
	'{}'::jsonb,
	jsonb_build_object(
		'description', 'QA Serving Provenance Product',
		'foodServings', jsonb_build_array(
			jsonb_build_object(
				'label', '2 tbsp (30 g)',
				'gramWeight', 30,
				'amount', 2,
				'unitKey', 'tbsp',
				'isPrimary', true
			)
		)
	),
	repeat('a', 64)
);

insert into public.shared_product_field_provenance (
	shared_product_id,
	observation_id,
	field_path,
	source_value,
	normalized_value,
	selected,
	confidence,
	verification_method
)
values (
	'73100000-0000-4000-8000-000000000002'::uuid,
	'73100000-0000-4000-8000-000000000003'::uuid,
	'servingWeightGrams',
	'30'::jsonb,
	'30'::jsonb,
	true,
	'imported',
	'exact-barcode'
);

insert into public.food_servings (
	shared_product_id,
	serving_order,
	label,
	gram_weight,
	amount,
	unit_key,
	is_primary,
	source,
	confidence
)
values (
	'73100000-0000-4000-8000-000000000002'::uuid,
	1,
	'2 tbsp (30 g)',
	30,
	2,
	'tbsp',
	true,
	'unknown',
	'unknown'
);

select results_eq(
	$$
		select source
		from public.food_servings
		where shared_product_id = '73100000-0000-4000-8000-000000000002'::uuid
	$$,
	$$ values ('open-food-facts'::text) $$,
	'current servingWeightGrams provenance supplies the normalized serving source'
);

select results_eq(
	$$
		select source_reference
		from public.food_servings
		where shared_product_id = '73100000-0000-4000-8000-000000000002'::uuid
	$$,
	$$ values ('07310000000001'::text) $$,
	'the normalized serving retains the exact source reference'
);

select results_eq(
	$$
		select source_observation_id
		from public.food_servings
		where shared_product_id = '73100000-0000-4000-8000-000000000002'::uuid
	$$,
	$$ values ('73100000-0000-4000-8000-000000000003'::uuid) $$,
	'the normalized serving links the exact supporting observation'
);

select * from finish();

rollback;
