create temporary table invalid_fuzzy_category_provenance
on commit drop
as
select distinct on (product.id)
	product.id as shared_product_id,
	product.category_option_id as previous_category_option_id,
	category.label as previous_category_label,
	latest.id as previous_revision_id,
	coalesce(latest.revision_number, 0) as previous_revision_number,
	latest.label_observed_at,
	product.source,
	product.source_reference
from public.shared_products product
join public.shared_product_field_provenance provenance
	on provenance.shared_product_id = product.id
	and provenance.field_path = 'categories'
	and provenance.selected
join public.shared_product_observations observation
	on observation.id = provenance.observation_id
join public.custom_food_category_options category
	on category.id = product.category_option_id
left join lateral (
	select
		revision.id,
		revision.revision_number,
		revision.label_observed_at
	from public.shared_product_revisions revision
	where revision.shared_product_id = product.id
	order by revision.revision_number desc
	limit 1
) latest on true
where observation.raw_payload ->> 'matchMethod' = 'description-token-match'
order by product.id;

update public.shared_product_field_provenance provenance
set selected = false
from invalid_fuzzy_category_provenance invalid
where provenance.shared_product_id = invalid.shared_product_id
	and provenance.field_path = 'categories'
	and provenance.selected;

update public.shared_products product
set
	category_option_id = null,
	food = jsonb_set(
		product.food - 'foodCategory' - 'categories',
		'{fieldProvenance}',
		coalesce(product.food -> 'fieldProvenance', '{}'::jsonb) - 'categories',
		true
	),
	canonical_provenance =
		coalesce(product.canonical_provenance, '{}'::jsonb) - 'categories',
	updated_at = now()
from invalid_fuzzy_category_provenance invalid
where product.id = invalid.shared_product_id;

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
	invalid.previous_revision_number + 1,
	product.food,
	invalid.source,
	invalid.source_reference,
	null,
	invalid.previous_revision_id,
	jsonb_build_object(
		'version', 1,
		'observedAt', now(),
		'baseRevisionNumber', invalid.previous_revision_number,
		'changes',
		jsonb_build_array(
			jsonb_build_object(
				'field', 'categories',
				'label', 'Category',
				'changeType', 'removed',
				'previousValue', invalid.previous_category_label,
				'submittedValue', null,
				'severity', 'high'
			)
		),
		'sourceChecks', '[]'::jsonb,
		'correctionReason', 'Removed category inferred from a non-barcode product match.'
	),
	coalesce(invalid.label_observed_at, now())
from invalid_fuzzy_category_provenance invalid
join public.shared_products product
	on product.id = invalid.shared_product_id;

create temporary table downgraded_provider_field_provenance
on commit drop
as
select
	provenance.shared_product_id,
	provenance.field_path,
	provenance.observation_id,
	provenance.verification_method
from public.shared_product_field_provenance provenance
join public.shared_product_observations observation
	on observation.id = provenance.observation_id
where provenance.confidence = 'source-verified'
	and provenance.verification_method = 'exact-barcode'
	and observation.source in ('usda', 'open-food-facts');

update public.shared_product_field_provenance provenance
set confidence = 'imported'
from downgraded_provider_field_provenance downgraded
where provenance.shared_product_id = downgraded.shared_product_id
	and provenance.observation_id = downgraded.observation_id
	and provenance.field_path = downgraded.field_path;

with field_patches as (
	select
		downgraded.shared_product_id,
		jsonb_object_agg(
			downgraded.field_path,
			coalesce(
				product.food -> 'fieldProvenance' -> downgraded.field_path,
				'{}'::jsonb
			) || jsonb_build_object('confidence', 'imported')
		) as food_patch,
		jsonb_object_agg(
			downgraded.field_path,
			coalesce(
				product.canonical_provenance -> downgraded.field_path,
				'{}'::jsonb
			) || jsonb_build_object(
				'observationId', downgraded.observation_id,
				'confidence', 'imported',
				'verificationMethod', downgraded.verification_method
			)
		) as canonical_patch
	from downgraded_provider_field_provenance downgraded
	join public.shared_products product
		on product.id = downgraded.shared_product_id
	group by downgraded.shared_product_id
)
update public.shared_products product
set
	food = jsonb_set(
		product.food,
		'{fieldProvenance}',
		coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
			|| field_patches.food_patch,
		true
	),
	canonical_provenance =
		coalesce(product.canonical_provenance, '{}'::jsonb)
			|| field_patches.canonical_patch,
	updated_at = now()
from field_patches
where product.id = field_patches.shared_product_id;

comment on table public.shared_product_field_provenance is
	'Selected field evidence. Exact barcode identifies the provider product record but does not by itself verify every supplied field; provider-reported field values therefore remain imported unless separately corroborated or reviewed.';
