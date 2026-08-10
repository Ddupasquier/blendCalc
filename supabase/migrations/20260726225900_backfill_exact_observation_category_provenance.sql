create temporary table exact_observation_category_provenance_backfill
on commit drop
as
select distinct on (product.id)
	product.id as shared_product_id,
	observation.id as observation_id,
	observation.source,
	observation.source_reference,
	observation.normalized_food ->> 'foodCategory' as source_value,
	category.label as normalized_value
from public.shared_products product
join public.custom_food_category_options category
	on category.id = product.category_option_id
	and category.enabled
join public.shared_product_observations observation
	on observation.barcode = product.barcode
	and observation.source = product.source
	and observation.source_reference is not distinct from product.source_reference
join public.product_data_sources source
	on source.key = observation.source
	and source.enabled
	and source.canonical_storage_allowed
	and source.api_redistribution_allowed
where product.status = 'active'
	and nullif(btrim(observation.normalized_food ->> 'foodCategory'), '') is not null
	and lower(btrim(observation.normalized_food ->> 'foodCategory')) =
		lower(btrim(category.label))
	and not exists (
		select 1
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = product.id
			and provenance.field_path = 'categories'
			and provenance.selected
	)
order by
	product.id,
	observation.observed_at desc,
	observation.id desc;

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
	backfill.shared_product_id,
	backfill.observation_id,
	'categories',
	to_jsonb(backfill.source_value),
	to_jsonb(backfill.normalized_value),
	true,
	'source-verified',
	'exact-barcode'
from exact_observation_category_provenance_backfill backfill
on conflict (shared_product_id, observation_id, field_path) do update
set
	source_value = excluded.source_value,
	normalized_value = excluded.normalized_value,
	selected = true,
	confidence = excluded.confidence,
	verification_method = excluded.verification_method;

update public.shared_products product
set
	food = jsonb_set(
		product.food,
		'{fieldProvenance}',
		coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
			|| jsonb_build_object(
				'categories',
				jsonb_build_object(
					'source', backfill.source,
					'sourceReference', backfill.source_reference,
					'confidence', 'source-verified'
				)
			),
		true
	),
	canonical_provenance = jsonb_set(
		coalesce(product.canonical_provenance, '{}'::jsonb),
		'{categories}',
		jsonb_build_object(
			'source', backfill.source,
			'sourceReference', backfill.source_reference,
			'observationId', backfill.observation_id,
			'confidence', 'source-verified',
			'verificationMethod', 'exact-barcode'
		),
		true
	),
	last_verified_at = now(),
	updated_at = now()
from exact_observation_category_provenance_backfill backfill
where product.id = backfill.shared_product_id;

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
		jsonb_build_array('categories')
	),
	coalesce(latest.label_observed_at, now())
from public.shared_products product
join exact_observation_category_provenance_backfill backfill
	on backfill.shared_product_id = product.id
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
