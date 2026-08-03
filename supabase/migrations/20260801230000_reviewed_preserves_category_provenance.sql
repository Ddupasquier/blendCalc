update public.custom_food_category_mappings
set
	category_option_id = 'jams',
	category_option_label = 'Jams',
	confidence = 'exact',
	match_reason = 'reviewed_canonical_mapping',
	updated_at = now()
where source_normalized_value = 'jam jelly and fruit spreads'
	and 'fdc-branded-detail' = any(sources);

create temporary table reviewed_preserves_category_provenance
on commit drop
as
select distinct on (product.id)
	product.id as shared_product_id,
	product.barcode,
	product.source,
	product.source_reference,
	source.canonical_license_name as source_license,
	category_observation.source_payload as raw_payload,
	category_observation.source_value,
	category.label as normalized_value,
	category_observation.last_seen_at as observed_at,
	product.category_option_id,
	null::uuid as observation_id
from public.shared_products product
join public.custom_food_category_options category
	on category.id = product.category_option_id
	and category.enabled
join public.custom_food_category_observations category_observation
	on category_observation.query = product.barcode
	and category_observation.source = 'fdc-branded-detail'
	and category_observation.source_reference = product.source_reference
	and category_observation.normalized_value = 'jam jelly and fruit spreads'
join public.custom_food_category_mappings category_mapping
	on category_mapping.source_normalized_value = category_observation.normalized_value
	and category_mapping.category_option_id = product.category_option_id
	and category_mapping.confidence = 'exact'
	and category_mapping.match_reason = 'reviewed_canonical_mapping'
join public.product_data_sources source
	on source.key = product.source
	and source.enabled
	and source.canonical_storage_allowed
	and source.api_redistribution_allowed
where product.status = 'active'
	and product.source = 'usda'
	and product.category_option_id = 'jams'
	and not exists (
		select 1
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = product.id
			and provenance.field_path = 'categories'
			and provenance.selected
	)
order by
	product.id,
	category_observation.last_seen_at desc,
	category_observation.id desc;

with inserted as (
	insert into public.shared_product_observations (
		barcode,
		source,
		source_reference,
		source_license,
		raw_payload,
		normalized_food,
		content_hash,
		observed_at
	)
	select
		repair.barcode,
		repair.source,
		repair.source_reference,
		repair.source_license,
		repair.raw_payload,
		jsonb_build_object(
			'foodCategory', repair.normalized_value,
			'categories', jsonb_build_array(repair.normalized_value),
			'sourceCategories', jsonb_build_array(repair.source_value),
			'categoryOptionId', repair.category_option_id
		),
		encode(
			extensions.digest(
				concat_ws(
					'|',
					repair.barcode,
					repair.source,
					repair.source_reference,
					repair.source_value,
					repair.category_option_id,
					'reviewed-canonical-category-v1'
				),
				'sha256'
			),
			'hex'
		),
		repair.observed_at
	from reviewed_preserves_category_provenance repair
	returning id, barcode, source, source_reference
)
update reviewed_preserves_category_provenance repair
set observation_id = inserted.id
from inserted
where inserted.barcode = repair.barcode
	and inserted.source = repair.source
	and inserted.source_reference = repair.source_reference;

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
select
	repair.shared_product_id,
	repair.observation_id,
	'categories',
	to_jsonb(repair.source_value),
	to_jsonb(repair.normalized_value),
	true,
	'imported',
	'exact-barcode'
from reviewed_preserves_category_provenance repair
where repair.observation_id is not null;

update public.shared_products product
set
	food = jsonb_set(
		jsonb_set(
			jsonb_set(
				product.food,
				'{foodCategory}',
				to_jsonb(repair.normalized_value),
				true
			),
			'{categories}',
			jsonb_build_array(repair.normalized_value),
			true
		),
		'{fieldProvenance}',
		coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
			|| jsonb_build_object(
				'categories',
				jsonb_build_object(
					'source', repair.source,
					'sourceReference', repair.source_reference,
					'confidence', 'imported'
				)
			),
		true
	),
	canonical_provenance = jsonb_set(
		coalesce(product.canonical_provenance, '{}'::jsonb),
		'{categories}',
		jsonb_build_object(
			'source', repair.source,
			'sourceReference', repair.source_reference,
			'observationId', repair.observation_id,
			'confidence', 'imported',
			'verificationMethod', 'exact-barcode'
		),
		true
	),
	updated_at = now()
from reviewed_preserves_category_provenance repair
where product.id = repair.shared_product_id;

insert into public.shared_product_revisions (
	shared_product_id,
	revision_number,
	food,
	source,
	source_reference,
	category_option_id,
	supersedes_revision_id,
	change_summary,
	label_observed_at
)
select
	product.id,
	coalesce(latest.revision_number, 0) + 1,
	product.food,
	product.source,
	product.source_reference,
	product.category_option_id,
	latest.id,
	jsonb_build_object(
		'provenanceBackfill',
		jsonb_build_array('categories'),
		'mappingMethod',
		'reviewed_canonical_mapping'
	),
	coalesce(latest.label_observed_at, repair.observed_at)
from public.shared_products product
join reviewed_preserves_category_provenance repair
	on repair.shared_product_id = product.id
left join lateral (
	select
		revision.id,
		revision.revision_number,
		revision.label_observed_at
	from public.shared_product_revisions revision
	where revision.shared_product_id = product.id
	order by revision.revision_number desc
	limit 1
) latest on true;

