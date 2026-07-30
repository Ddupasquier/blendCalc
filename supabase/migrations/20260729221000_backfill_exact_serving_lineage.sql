with serving_candidates as (
	select
		product.id as shared_product_id,
		serving.id as serving_id,
		observation.id as observation_id,
		observation.source,
		observation.source_reference,
		observation.observed_at,
		exists (
			select 1
			from jsonb_array_elements(
				case
					when jsonb_typeof(observation.normalized_food -> 'foodServings') = 'array'
						then observation.normalized_food -> 'foodServings'
					else '[]'::jsonb
				end
			) source_serving(value)
			where jsonb_typeof(source_serving.value -> 'gramWeight') = 'number'
				and (source_serving.value ->> 'gramWeight')::numeric = serving.gram_weight
				and lower(btrim(source_serving.value ->> 'label')) =
					lower(btrim(serving.label))
		) as exact_label_match
	from public.shared_products product
	join public.food_servings serving
		on serving.shared_product_id = product.id
	join public.shared_product_observations observation
		on observation.barcode = product.barcode
		and observation.source <> 'user-label'
		and observation.source_reference is not null
		and observation.normalized_food is not null
	where product.status = 'active'
		and not exists (
			select 1
			from public.shared_product_field_provenance provenance
			where provenance.shared_product_id = product.id
				and provenance.field_path = 'serving'
				and provenance.selected
		)
		and (
			exists (
				select 1
				from jsonb_array_elements(
					case
						when jsonb_typeof(observation.normalized_food -> 'foodServings') = 'array'
							then observation.normalized_food -> 'foodServings'
						else '[]'::jsonb
					end
				) source_serving(value)
				where jsonb_typeof(source_serving.value -> 'gramWeight') = 'number'
					and (source_serving.value ->> 'gramWeight')::numeric =
						serving.gram_weight
			)
			or (
				jsonb_typeof(
					observation.normalized_food -> 'customServingWeightGrams'
				) = 'number'
				and (
					observation.normalized_food ->> 'customServingWeightGrams'
				)::numeric = serving.gram_weight
			)
		)
),
ranked_candidates as (
	select
		candidate.*,
		row_number() over (
			partition by candidate.shared_product_id
			order by
				candidate.exact_label_match desc,
				candidate.observed_at desc,
				candidate.observation_id
		) as candidate_rank
	from serving_candidates candidate
),
inserted_provenance as (
	insert into public.shared_product_field_provenance (
		shared_product_id,
		observation_id,
		field_path,
		source_value,
		normalized_value,
		confidence,
		verification_method,
		selected
	)
	select
		candidate.shared_product_id,
		candidate.observation_id,
		'serving',
		jsonb_build_object(
			'label', serving.label,
			'gramWeight', serving.gram_weight,
			'amount', serving.amount,
			'unitKey', serving.unit_key
		),
		jsonb_build_object(
			'label', serving.label,
			'gramWeight', serving.gram_weight,
			'amount', serving.amount,
			'unitKey', serving.unit_key
		),
		'imported',
		'exact-barcode',
		true
	from ranked_candidates candidate
	join public.food_servings serving
		on serving.id = candidate.serving_id
	where candidate.candidate_rank = 1
	returning shared_product_id, observation_id
)
update public.food_servings serving
set
	source_observation_id = provenance.observation_id,
	source = observation.source,
	source_reference = observation.source_reference,
	confidence = provenance.confidence
from public.shared_product_field_provenance provenance
join public.shared_product_observations observation
	on observation.id = provenance.observation_id
where provenance.shared_product_id = serving.shared_product_id
	and provenance.field_path = 'serving'
	and provenance.selected;

update public.shared_products product
set
	food = product.food || jsonb_build_object(
		'fieldProvenance',
		coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
			|| jsonb_build_object(
				'serving',
				jsonb_build_object(
					'source', observation.source,
					'sourceReference', observation.source_reference,
					'confidence', provenance.confidence
				)
			)
	),
	updated_at = now()
from public.shared_product_field_provenance provenance
join public.shared_product_observations observation
	on observation.id = provenance.observation_id
where provenance.shared_product_id = product.id
	and provenance.field_path = 'serving'
	and provenance.selected
	and not (
		coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
			? 'serving'
	);
