create temporary table api_v1_ingredient_provenance_backfill
on commit drop
as
select distinct on (product.id)
	product.id as shared_product_id,
	observation.id as observation_id,
	observation.source,
	observation.source_reference,
	jsonb_build_object(
		'ingredients', product.food -> 'ingredients',
		'ingredientList', coalesce(product.food -> 'ingredientList', '[]'::jsonb)
	) as field_value
from public.shared_products product
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
	and nullif(btrim(product.food ->> 'ingredients'), '') is not null
	and lower(btrim(coalesce(
		observation.normalized_food ->> 'ingredients',
		observation.raw_payload ->> 'ingredients'
	))) = lower(btrim(product.food ->> 'ingredients'))
	and not exists (
		select 1
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = product.id
			and provenance.field_path = 'ingredients'
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
	'ingredients',
	backfill.field_value,
	backfill.field_value,
	true,
	'source-verified',
	'exact-barcode'
from api_v1_ingredient_provenance_backfill backfill
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
				'ingredients',
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
		'{ingredients}',
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
from api_v1_ingredient_provenance_backfill backfill
where product.id = backfill.shared_product_id;

create temporary table api_v1_category_provenance_backfill
on commit drop
as
select distinct on (product.id)
	product.id as shared_product_id,
	product.barcode,
	case
		when category_observation.source = 'fdc-branded-detail' then 'usda'
		else category_observation.source
	end as source,
	category_observation.source_reference,
	source.canonical_license_name as source_license,
	category_observation.source_payload as raw_payload,
	jsonb_build_object(
		'foodCategory', category.label,
		'categories', jsonb_build_array(category_observation.source_value)
	) as normalized_food,
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
join public.custom_food_category_mappings category_mapping
	on category_mapping.source_normalized_value =
		category_observation.normalized_value
	and category_mapping.category_option_id = product.category_option_id
	and category_mapping.confidence = 'exact'
join public.product_data_sources source
	on source.key = case
		when category_observation.source = 'fdc-branded-detail' then 'usda'
		else category_observation.source
	end
	and source.enabled
	and source.canonical_storage_allowed
	and source.api_redistribution_allowed
where product.status = 'active'
	and nullif(btrim(category_observation.source_reference), '') is not null
	and not exists (
		select 1
		from public.shared_product_field_provenance provenance
		where provenance.shared_product_id = product.id
			and provenance.field_path = 'categories'
			and provenance.selected
	)
order by
	product.id,
	case category_observation.source
		when 'fdc-branded-detail' then 0
		else 1
	end,
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
		backfill.barcode,
		backfill.source,
		backfill.source_reference,
		backfill.source_license,
		backfill.raw_payload,
		backfill.normalized_food,
		encode(
			extensions.digest(
				concat_ws(
					'|',
					backfill.barcode,
					backfill.source,
					backfill.source_reference,
					backfill.source_value,
					backfill.category_option_id
				),
				'sha256'
			),
			'hex'
		),
		backfill.observed_at
	from api_v1_category_provenance_backfill backfill
	returning id, barcode, source, source_reference
)
update api_v1_category_provenance_backfill backfill
set observation_id = inserted.id
from inserted
where inserted.barcode = backfill.barcode
	and inserted.source = backfill.source
	and inserted.source_reference = backfill.source_reference;

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
from api_v1_category_provenance_backfill backfill
where backfill.observation_id is not null
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
from api_v1_category_provenance_backfill backfill
where product.id = backfill.shared_product_id
	and backfill.observation_id is not null;

create temporary table api_v1_provenance_backfilled_products
on commit drop
as
select
	backfilled.shared_product_id,
	array_agg(distinct backfilled.field_path order by backfilled.field_path)
		as field_paths
from (
	select
		ingredient.shared_product_id,
		'ingredients'::text as field_path
	from api_v1_ingredient_provenance_backfill ingredient
	union all
	select
		category.shared_product_id,
		'categories'::text as field_path
	from api_v1_category_provenance_backfill category
	where category.observation_id is not null
) backfilled
group by backfilled.shared_product_id;

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
		to_jsonb(backfill.field_paths)
	),
	coalesce(latest.label_observed_at, now())
from public.shared_products product
join api_v1_provenance_backfilled_products backfill
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
