begin;

select plan(15);

select has_table(
	'public',
	'shared_product_revision_changes',
	'catalog revision changes are queryable'
);
select has_function(
	'public',
	'catalog_change_summary_is_valid',
	array['jsonb', 'boolean'],
	'catalog change summaries have one authoritative validator'
);
select has_function(
	'public',
	'get_blendcalc_product_revision_history_v1',
	array['text', 'integer', 'integer'],
	'API v1 revision history has a bounded database read'
);
select ok(
	public.catalog_change_summary_is_valid(
		'{"changes":[{"field":"ingredients","label":"Ingredient statement","changeType":"changed","previousValue":"Tomatoes","submittedValue":"Tomatoes, onion","severity":"medium"}]}'::jsonb,
		true
	),
	'a complete structured product change is accepted'
);
select ok(
	not public.catalog_change_summary_is_valid(
		'{"changes":[]}'::jsonb,
		true
	),
	'an empty product-update summary is rejected'
);
select ok(
	not public.catalog_change_summary_is_valid(
		'{"changes":[{"field":"ingredients","label":"Ingredients","changeType":"changed","previousValue":"A","submittedValue":"B","severity":"low"},{"field":"ingredients","label":"Ingredients","changeType":"changed","previousValue":"B","submittedValue":"C","severity":"low"}]}'::jsonb,
		true
	),
	'duplicate field changes are rejected'
);
select ok(
		not has_function_privilege(
			'authenticated',
			'public.get_blendcalc_product_revision_history_v1(text,integer,integer)',
			'EXECUTE'
		),
	'authenticated clients cannot bypass the API revision sanitizer'
);
select ok(
	not has_function_privilege(
		'authenticated',
		'public.catalog_change_summary_is_valid(jsonb,boolean)',
		'EXECUTE'
	),
	'authenticated clients cannot call the internal change validator'
);
select ok(
	not has_table_privilege(
		'authenticated',
		'public.shared_product_revision_changes',
		'SELECT'
	),
	'authenticated clients cannot read internal change rows directly'
);

insert into public.shared_product_submissions (
	id,
	submitted_by,
	barcode,
	product_name,
	category_option_id,
	food,
	consent_to_share,
	submission_kind
)
select
	'66666666-6666-4666-8666-666666666666'::uuid,
	user_row.id,
	'09999999999999',
	'QA Revision Product',
	category.id,
	jsonb_build_object(
		'description',
		'QA Revision Product',
		'foodCategory',
		category.label,
		'foodNutrients',
		'[]'::jsonb
	),
	true,
	'new_product'
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
	confidence,
	approved_submission_id
)
select
	'11111111-1111-4111-8111-111111111111'::uuid,
	submission.barcode,
	submission.product_name,
	'qa revision product 09999999999999',
	submission.category_option_id,
	submission.food,
	'community-reviewed',
	'moderator-reviewed',
	submission.id
from public.shared_product_submissions submission
where submission.id = '66666666-6666-4666-8666-666666666666'::uuid;

insert into public.shared_product_revisions (
	id,
	shared_product_id,
	revision_number,
	category_option_id,
	food,
	source
)
select
	'22222222-2222-4222-8222-222222222222'::uuid,
	product.id,
	1,
	product.category_option_id,
	product.food,
	product.source
from public.shared_products product
where product.id = '11111111-1111-4111-8111-111111111111'::uuid;

update public.shared_product_submissions
set status = 'approved'
where id = '66666666-6666-4666-8666-666666666666'::uuid;

insert into public.shared_product_submissions (
	id,
	submitted_by,
	barcode,
	product_name,
	category_option_id,
	food,
	consent_to_share,
	submission_kind,
	target_shared_product_id,
	base_revision_id,
	change_summary,
	label_observed_at
)
select
	'33333333-3333-4333-8333-333333333333'::uuid,
	user_row.id,
	product.barcode,
	product.product_name,
	product.category_option_id,
	product.food,
	true,
	'product_update',
	product.id,
	'22222222-2222-4222-8222-222222222222'::uuid,
	'{"changes":[{"field":"ingredients","label":"Ingredient statement","changeType":"changed","previousValue":"Tomatoes","submittedValue":"Tomatoes, onion","severity":"medium"},{"field":"servings","label":"Serving size","changeType":"changed","previousValue":"100 g","submittedValue":"125 g","severity":"low"}]}'::jsonb,
	'2026-07-29T12:00:00.000Z'::timestamptz
from public.shared_products product
cross join lateral (
	select id
	from auth.users
	where email = 'qa-moderator@blendcalc.local'
	limit 1
) user_row
where product.id = '11111111-1111-4111-8111-111111111111'::uuid;

update public.shared_products
set approved_submission_id = '33333333-3333-4333-8333-333333333333'::uuid
where id = '11111111-1111-4111-8111-111111111111'::uuid;

insert into public.shared_product_revisions (
	id,
	shared_product_id,
	revision_number,
	category_option_id,
	food,
	source
)
select
	'44444444-4444-4444-8444-444444444444'::uuid,
	product.id,
	2,
	product.category_option_id,
	product.food,
	product.source
from public.shared_products product
where product.id = '11111111-1111-4111-8111-111111111111'::uuid;

select is(
	(
		select revision.submission_id::text
		from public.shared_product_revisions revision
		where revision.id = '44444444-4444-4444-8444-444444444444'::uuid
	),
	'33333333-3333-4333-8333-333333333333',
	'an approved update revision retains its submission'
);
select is(
	(
		select revision.supersedes_revision_id::text
		from public.shared_product_revisions revision
		where revision.id = '44444444-4444-4444-8444-444444444444'::uuid
	),
	'22222222-2222-4222-8222-222222222222',
	'an approved update revision supersedes the reviewed base revision'
);
select is(
	(
		select revision.label_observed_at
		from public.shared_product_revisions revision
		where revision.id = '44444444-4444-4444-8444-444444444444'::uuid
	),
	'2026-07-29T12:00:00.000Z'::timestamptz,
	'an approved update preserves the label observation date'
);
select is(
	(
		select count(*)
		from public.shared_product_revision_changes change
		where change.revision_id =
			'44444444-4444-4444-8444-444444444444'::uuid
	),
	2::bigint,
	'one immutable change row is written per submitted field'
);
select is(
	(
		select change.new_value #>> '{}'
		from public.shared_product_revision_changes change
		where change.revision_id =
				'44444444-4444-4444-8444-444444444444'::uuid
			and change.field_path = 'ingredients'
	),
	'Tomatoes, onion',
	'the queryable change keeps the accepted value'
);

update public.shared_product_submissions
set status = 'approved'
where id = '33333333-3333-4333-8333-333333333333'::uuid;

insert into public.shared_product_submissions (
	id,
	submitted_by,
	barcode,
	product_name,
	category_option_id,
	food,
	consent_to_share,
	submission_kind,
	target_shared_product_id,
	base_revision_id,
	change_summary
)
select
	'55555555-5555-4555-8555-555555555555'::uuid,
	user_row.id,
	product.barcode,
	product.product_name,
	product.category_option_id,
	product.food,
	true,
	'product_update',
	product.id,
	'22222222-2222-4222-8222-222222222222'::uuid,
	'{"changes":[{"field":"brand","label":"Brand","changeType":"changed","previousValue":null,"submittedValue":"Updated Brand","severity":"low"}]}'::jsonb
from public.shared_products product
cross join lateral (
	select id
	from auth.users
	where email = 'qa-moderator@blendcalc.local'
	limit 1
) user_row
where product.id = '11111111-1111-4111-8111-111111111111'::uuid;

select throws_ok(
	$$
		update public.shared_products
		set approved_submission_id =
			'55555555-5555-4555-8555-555555555555'::uuid
		where id = '11111111-1111-4111-8111-111111111111'::uuid
	$$,
	'P0001',
	'Catalog update is stale because this product changed after submission',
	'a stale update cannot replace a newer revision'
);

select * from finish();

rollback;
