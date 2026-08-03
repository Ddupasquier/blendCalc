begin;

select plan(14);

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
	'52004000-0000-4000-8000-000000000000'::uuid,
	user_row.id,
	'05200400000001',
	'QA External Enrichment Product',
	category.id,
	jsonb_build_object(
		'description', 'QA External Enrichment Product',
		'foodCategory', category.label,
		'categories', jsonb_build_array(category.label),
		'foodNutrients', jsonb_build_array(
			jsonb_build_object(
				'nutrientId', 1003,
				'nutrientName', 'Protein',
				'unitName', 'G',
				'value', 8
			)
		),
		'image', jsonb_build_object(
			'imageUrl', 'https://example.invalid/original.webp'
		),
		'hasSourceServing', false,
		'foodServings', '[]'::jsonb
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
	'52004000-0000-4000-8000-000000000001'::uuid,
	submission.barcode,
	submission.product_name,
	'qa external enrichment product 05200400000001',
	submission.category_option_id,
	submission.food,
	'community-reviewed',
	'qa:external-enrichment',
	'moderator-reviewed',
	'{}'::jsonb,
	'active',
	submission.id
from public.shared_product_submissions submission
where submission.id = '52004000-0000-4000-8000-000000000000'::uuid;

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
	'52004000-0000-4000-8000-000000000002'::uuid,
	product.id,
	1,
	product.category_option_id,
	product.food,
	product.source,
	product.source_reference
from public.shared_products product
where product.id = '52004000-0000-4000-8000-000000000001'::uuid;

create temporary table qa_external_enrichment_result (
	applied_fields text[] not null
) on commit drop;

insert into qa_external_enrichment_result (applied_fields)
select public.apply_shared_product_external_enrichment(
	'52004000-0000-4000-8000-000000000001'::uuid,
	'05200400000001',
	jsonb_build_object(
		'description', 'Conflicting Provider Name',
		'foodCategory', 'Conflicting Provider Category',
		'categories', jsonb_build_array('Conflicting Provider Category'),
		'foodNutrients', jsonb_build_array(
			jsonb_build_object(
				'nutrientId', 1003,
				'nutrientName', 'Protein',
				'unitName', 'G',
				'value', 999
			)
		),
		'image', jsonb_build_object(
			'imageUrl', 'https://example.invalid/replacement.webp'
		),
		'hasSourceServing', true,
		'servingSize', 30,
		'servingSizeUnit', 'G',
		'householdServingFullText', '2 tbsp',
		'customServingLabel', '2 tbsp',
		'customServingWeightGrams', 30,
		'foodServings', jsonb_build_array(
			jsonb_build_object(
				'label', '2 tbsp (30 g)',
				'gramWeight', 30,
				'amount', 2,
				'unitKey', 'tbsp',
				'isPrimary', true,
				'measureType', 'Package serving',
				'isHouseholdMeasure', true,
				'sourceMeasureKey', 'usda:qa-serving',
				'origin', 'package-label',
				'gramWeightMethod', 'source-reported'
			)
		),
		'fieldProvenance', jsonb_build_object(
			'serving', jsonb_build_object(
				'source', 'usda',
				'sourceReference', 'fdc:qa-serving',
				'confidence', 'source-verified',
				'verificationMethod', 'exact-barcode'
			)
		)
	),
	(
		select category_option_id
		from public.shared_products
		where id = '52004000-0000-4000-8000-000000000001'::uuid
	),
	array['nutrition', 'image', 'categories', 'serving']::text[],
	jsonb_build_array(
		jsonb_build_object(
			'key', 'usda-serving',
			'trackedField', 'serving',
			'source', 'usda',
			'sourceReference', 'fdc:qa-serving',
			'sourceLicense', 'CC0-1.0',
			'contentHash', repeat('a', 64),
			'observedAt', '2026-08-02T12:00:00Z',
			'rawPayload', jsonb_build_object('servingSize', 30)
		)
	),
	jsonb_build_array(
		jsonb_build_object(
			'fieldPath', 'serving',
			'observationKey', 'usda-serving',
			'source', 'usda',
			'sourceReference', 'fdc:qa-serving',
			'sourceValue', jsonb_build_object('servingSize', 30),
			'normalizedValue', jsonb_build_object('gramWeight', 30),
			'confidence', 'source-verified',
			'verificationMethod', 'exact-barcode'
		)
	)
);

select is(
	(select applied_fields from qa_external_enrichment_result),
	array['serving']::text[],
	'only the missing serving field is applied'
);
select is(
	(
		select food -> 'foodNutrients' -> 0 ->> 'value'
		from public.shared_products
		where id = '52004000-0000-4000-8000-000000000001'::uuid
	),
	'8',
	'existing nutrition is not replaced'
);
select is(
	(
		select food -> 'image' ->> 'imageUrl'
		from public.shared_products
		where id = '52004000-0000-4000-8000-000000000001'::uuid
	),
	'https://example.invalid/original.webp',
	'existing image data is not replaced'
);
select is(
	(
		select food ->> 'description'
		from public.shared_products
		where id = '52004000-0000-4000-8000-000000000001'::uuid
	),
	'QA External Enrichment Product',
	'existing product identity is not replaced'
);
select is(
	(
		select food ->> 'hasSourceServing'
		from public.shared_products
		where id = '52004000-0000-4000-8000-000000000001'::uuid
	),
	'true',
	'the missing source serving is stored canonically'
);
select is(
	(
		select count(*)
		from public.food_servings
		where shared_product_id = '52004000-0000-4000-8000-000000000001'::uuid
			and gram_weight = 30
	),
	1::bigint,
	'the accepted serving refreshes the normalized serving projection'
);
select is(
	(
		select count(*)
		from public.shared_product_observations
		where barcode = '05200400000001'
			and source = 'usda'
			and source_reference = 'fdc:qa-serving'
	),
	1::bigint,
	'the accepted field records one source observation'
);
select is(
	(
		select count(*)
		from public.shared_product_field_provenance
		where shared_product_id = '52004000-0000-4000-8000-000000000001'::uuid
			and field_path = 'serving'
			and selected
	),
	1::bigint,
	'the accepted field records one selected provenance row'
);
select is(
	(
		select canonical_provenance -> 'serving' ->> 'verificationMethod'
		from public.shared_products
		where id = '52004000-0000-4000-8000-000000000001'::uuid
	),
	'exact-barcode',
	'the canonical product retains the field verification method'
);
select is(
	(
		select count(*)
		from public.shared_product_revisions
		where shared_product_id = '52004000-0000-4000-8000-000000000001'::uuid
	),
	2::bigint,
	'the accepted field creates exactly one new revision'
);

truncate qa_external_enrichment_result;

insert into qa_external_enrichment_result (applied_fields)
select public.apply_shared_product_external_enrichment(
	'52004000-0000-4000-8000-000000000001'::uuid,
	'05200400000001',
	jsonb_build_object(
		'hasSourceServing', true,
		'servingSize', 30,
		'servingSizeUnit', 'G',
		'customServingWeightGrams', 30,
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
	null,
	array['serving']::text[],
	jsonb_build_array(
		jsonb_build_object(
			'key', 'usda-serving',
			'trackedField', 'serving',
			'source', 'usda',
			'sourceReference', 'fdc:qa-serving',
			'sourceLicense', 'CC0-1.0',
			'contentHash', repeat('a', 64),
			'rawPayload', jsonb_build_object('servingSize', 30)
		)
	),
	jsonb_build_array(
		jsonb_build_object(
			'fieldPath', 'serving',
			'observationKey', 'usda-serving',
			'source', 'usda',
			'sourceReference', 'fdc:qa-serving',
			'sourceValue', jsonb_build_object('servingSize', 30),
			'normalizedValue', jsonb_build_object('gramWeight', 30),
			'confidence', 'source-verified',
			'verificationMethod', 'exact-barcode'
		)
	)
);

select is(
	(select applied_fields from qa_external_enrichment_result),
	'{}'::text[],
	'a repeat request applies no already-complete field'
);
select is(
	(
		select count(*)
		from public.shared_product_observations
		where barcode = '05200400000001'
			and source = 'usda'
			and source_reference = 'fdc:qa-serving'
	),
	1::bigint,
	'a repeat request creates no duplicate observation'
);
select is(
	(
		select count(*)
		from public.shared_product_field_provenance
		where shared_product_id = '52004000-0000-4000-8000-000000000001'::uuid
			and field_path = 'serving'
			and selected
	),
	1::bigint,
	'a repeat request creates no duplicate selected provenance'
);
select is(
	(
		select count(*)
		from public.shared_product_revisions
		where shared_product_id = '52004000-0000-4000-8000-000000000001'::uuid
	),
	2::bigint,
	'a repeat request creates no duplicate revision'
);

select * from finish();

rollback;
