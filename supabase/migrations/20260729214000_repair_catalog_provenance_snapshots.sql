with selected_provider_fields as (
	select
		provenance.shared_product_id,
		provenance.field_path,
		provenance.observation_id,
		provenance.confidence,
		provenance.verification_method,
		observation.source,
		observation.source_reference
	from public.shared_product_field_provenance provenance
	join public.shared_product_observations observation
		on observation.id = provenance.observation_id
	where provenance.selected
),
field_patches as (
	select
		selected.shared_product_id,
		jsonb_object_agg(
			selected.field_path,
			jsonb_strip_nulls(
				jsonb_build_object(
					'source', selected.source,
					'sourceReference', selected.source_reference,
					'confidence', selected.confidence
				)
			)
		) as food_patch,
		jsonb_object_agg(
			selected.field_path,
			jsonb_strip_nulls(
				jsonb_build_object(
					'source', selected.source,
					'sourceReference', selected.source_reference,
					'observationId', selected.observation_id,
					'confidence', selected.confidence,
					'verificationMethod', selected.verification_method
				)
			)
		) as canonical_patch
	from selected_provider_fields selected
	group by selected.shared_product_id
)
update public.shared_products product
set
	food = jsonb_set(
		product.food,
		'{fieldProvenance}',
		field_patches.food_patch,
		true
	),
	canonical_provenance = field_patches.canonical_patch,
	updated_at = now()
from field_patches
where product.id = field_patches.shared_product_id;
