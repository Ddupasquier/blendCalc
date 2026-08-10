begin;

select plan(11);

select has_column(
	'public',
	'shared_product_submissions',
	'submission_intent',
	'catalog submissions record the user intent'
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
	status,
	evidence_complete,
	submission_kind,
	submission_intent
)
select
	'71000000-0000-4000-8000-000000000000'::uuid,
	user_row.id,
	'07100000000001',
	'Original Product',
	'Original Brand',
	category.id,
	jsonb_build_object(
		'description', 'Original Product',
		'foodCategory', category.label,
		'categories', jsonb_build_array(category.label),
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
	brand_owner,
	search_text,
	category_option_id,
	food,
	source,
	source_reference,
	confidence,
	canonical_provenance,
	approved_submission_id
)
select
	'71000000-0000-4000-8000-000000000001'::uuid,
	'07100000000001',
	'Original Product',
	'Original Brand',
	'original product original brand 07100000000001',
	category.id,
	jsonb_build_object(
		'description', 'Original Product',
		'brandOwner', 'Original Brand',
		'foodCategory', category.label,
		'categories', jsonb_build_array(category.label),
		'ingredients', 'Oats, cocoa',
		'foodNutrients', jsonb_build_array(
			jsonb_build_object(
				'nutrientId', 1003,
				'nutrientName', 'Protein',
				'unitName', 'G',
				'value', 10
			),
			jsonb_build_object(
				'nutrientId', 1004,
				'nutrientName', 'Total Fat',
				'unitName', 'G',
				'value', 4
			)
		)
	),
	'usda',
	'fdc:710001',
	'imported',
	jsonb_build_object(
		'productName',
		jsonb_build_object(
			'source', 'original-source',
			'confidence', 'source-verified',
			'verificationMethod', 'exact-barcode'
		),
		'ingredients',
		jsonb_build_object(
			'source', 'original-source',
			'confidence', 'source-verified',
			'verificationMethod', 'exact-barcode'
		)
	),
	'71000000-0000-4000-8000-000000000000'::uuid
from public.custom_food_category_options category
where category.enabled
order by category.id
limit 1;

insert into public.shared_product_revisions (
	id,
	shared_product_id,
	revision_number,
	category_option_id,
	food,
	source,
	source_reference
)
select
	'71000000-0000-4000-8000-000000000002'::uuid,
	product.id,
	1,
	product.category_option_id,
	product.food,
	product.source,
	product.source_reference
from public.shared_products product
where product.id = '71000000-0000-4000-8000-000000000001'::uuid;

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
select
	'71000000-0000-4000-8000-000000000003'::uuid,
	product.barcode,
	'usda',
	product.source_reference,
	'CC0-1.0',
	'{}'::jsonb,
	product.food,
	repeat('7', 64)
from public.shared_products product
where product.id = '71000000-0000-4000-8000-000000000001'::uuid;

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
values
(
	'71000000-0000-4000-8000-000000000001'::uuid,
	'71000000-0000-4000-8000-000000000003'::uuid,
	'productName',
	to_jsonb('Original Product'::text),
	to_jsonb('Original Product'::text),
	true,
	'source-verified',
	'exact-barcode'
),
(
	'71000000-0000-4000-8000-000000000001'::uuid,
	'71000000-0000-4000-8000-000000000003'::uuid,
	'ingredients',
	to_jsonb('Oats, cocoa'::text),
	to_jsonb('Oats, cocoa'::text),
	true,
	'source-verified',
	'exact-barcode'
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
	status,
	evidence_complete,
	submission_kind,
	submission_intent,
	target_shared_product_id,
	base_revision_id,
	change_summary
)
select
	'71000000-0000-4000-8000-000000000004'::uuid,
	user_row.id,
	product.barcode,
	'Corrected Product',
	product.brand_owner,
	product.category_option_id,
	jsonb_set(product.food, '{description}', to_jsonb('Corrected Product'::text)),
	true,
	'pending',
	true,
	'product_update',
	'catalog_correction',
	product.id,
	'71000000-0000-4000-8000-000000000002'::uuid,
	'{"changes":[{"field":"productName","label":"Product name","changeType":"changed","previousValue":"Original Product","submittedValue":"Corrected Product","severity":"medium"}]}'::jsonb
from public.shared_products product
cross join lateral (
	select id
	from auth.users
	where email = 'qa-user@blendcalc.local'
	limit 1
) user_row
where product.id = '71000000-0000-4000-8000-000000000001'::uuid;

select is(
	public.publish_shared_product_submission(
		'71000000-0000-4000-8000-000000000004'::uuid,
		(
			select jsonb_set(
				product.food,
				'{description}',
				to_jsonb('Corrected Product'::text)
			)
			from public.shared_products product
			where product.id = '71000000-0000-4000-8000-000000000001'::uuid
		),
		'Corrected Product',
		'Original Brand',
		'community-reviewed',
		'',
		'moderator-reviewed',
		(
			select id
			from auth.users
			where email = 'qa-moderator@blendcalc.local'
			limit 1
		),
		jsonb_build_array(
			jsonb_build_object(
				'key', 'user-label',
				'source', 'user-label',
				'sourceLicense', 'submitted-with-consent',
				'rawPayload', '{}'::jsonb,
				'normalizedFood', jsonb_build_object(
					'description', 'Corrected Product'
				),
				'contentHash', repeat('8', 64),
				'observedAt', '2026-07-30T12:00:00.000Z'
			)
		),
		jsonb_build_array(
			jsonb_build_object(
				'observationKey', 'user-label',
				'fieldPath', 'productName',
				'sourceValue', to_jsonb('Corrected Product'::text),
				'normalizedValue', to_jsonb('Corrected Product'::text),
				'confidence', 'moderator-reviewed',
				'verificationMethod', 'label-review'
			)
		),
		'[]'::jsonb
	)::text,
	'71000000-0000-4000-8000-000000000001',
	'the correction publishes to the existing shared product'
);

select is(
	(
		select product.food ->> 'ingredients'
		from public.shared_products product
		where product.id = '71000000-0000-4000-8000-000000000001'::uuid
	),
	'Oats, cocoa',
	'an accepted correction retains unsubmitted ingredient data'
);

select is(
	(
		select jsonb_array_length(product.food -> 'foodNutrients')
		from public.shared_products product
		where product.id = '71000000-0000-4000-8000-000000000001'::uuid
	),
	2,
	'an accepted correction retains unsubmitted nutrients'
);

select is(
	(
		select product.source
		from public.shared_products product
		where product.id = '71000000-0000-4000-8000-000000000001'::uuid
	),
	'usda',
	'a correction does not replace the whole-product source identity'
);

select is(
	(
		select product.source_reference
		from public.shared_products product
		where product.id = '71000000-0000-4000-8000-000000000001'::uuid
	),
	'fdc:710001',
	'a correction retains the whole-product source reference'
);

select ok(
	(
		select provenance.selected
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id =
				'71000000-0000-4000-8000-000000000001'::uuid
			and provenance.field_path = 'ingredients'
	),
	'unchanged field provenance remains selected'
);

select is(
	(
		select observation.source
		from public.shared_product_field_provenance provenance
		join public.shared_product_observations observation
			on observation.id = provenance.observation_id
		where provenance.shared_product_id =
				'71000000-0000-4000-8000-000000000001'::uuid
			and provenance.field_path = 'productName'
			and provenance.selected
	),
	'user-label',
	'the reviewed correction becomes the selected source only for its changed field'
);

select is(
	(
		select product.canonical_provenance -> 'ingredients' ->> 'source'
		from public.shared_products product
		where product.id = '71000000-0000-4000-8000-000000000001'::uuid
	),
	'original-source',
	'the canonical provenance snapshot retains untouched field lineage'
);

select is(
	(
		select product.canonical_provenance -> 'productName' ->> 'source'
		from public.shared_products product
		where product.id = '71000000-0000-4000-8000-000000000001'::uuid
	),
	'user-label',
	'the canonical provenance snapshot updates the corrected field lineage'
);

select is(
	(
		select count(*)
		from public.shared_product_revision_changes change
		join public.shared_product_revisions revision
			on revision.id = change.revision_id
		where revision.shared_product_id =
				'71000000-0000-4000-8000-000000000001'::uuid
			and revision.revision_number = 2
	),
	1::bigint,
	'the immutable revision records only the reviewed field change'
);

select * from finish();

rollback;
