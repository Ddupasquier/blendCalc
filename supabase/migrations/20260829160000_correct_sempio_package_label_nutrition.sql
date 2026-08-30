create temporary table corrected_sempio_label_nutrients (
	nutrient_id bigint primary key,
	serving_value numeric not null,
	amount_per_100g numeric not null,
	unit_name text not null
) on commit drop;

insert into corrected_sempio_label_nutrients (
	nutrient_id,
	serving_value,
	amount_per_100g,
	unit_name
)
values
	(1008, 40, 222.222222222222, 'KCAL'),
	(1004, 0, 0, 'G'),
	(1258, 0, 0, 'G'),
	(1257, 0, 0, 'G'),
	(1253, 0, 0, 'MG'),
	(1005, 8, 44.4444444444444, 'G'),
	(1079, 1, 5.55555555555556, 'G'),
	(2000, 5, 27.7777777777778, 'G'),
	(1235, 5, 27.7777777777778, 'G'),
	(1003, 1, 5.55555555555556, 'G'),
	(1093, 480, 2666.66666666667, 'MG');

do $$
declare
	v_missing_definition_count integer;
begin
	select count(*)
	into v_missing_definition_count
	from corrected_sempio_label_nutrients corrected
	left join public.nutrient_definitions definition
		on definition.nutrient_id = corrected.nutrient_id
	where definition.nutrient_id is null;

	if v_missing_definition_count <> 0 then
		raise exception
			'Sempio package-label correction is missing % nutrient definitions',
			v_missing_definition_count;
	end if;
end;
$$;

create temporary table corrected_sempio_product
on commit drop
as
select
	product.id as shared_product_id,
	product.food as previous_food,
	product.canonical_provenance as previous_canonical_provenance
from public.shared_products product
where product.barcode = '08801005523455'
	and product.status = 'active';

update public.shared_products product
set
	food = product.food || jsonb_build_object(
		'foodNutrients', (
			select jsonb_agg(
				jsonb_build_object(
					'nutrientId', corrected.nutrient_id,
					'nutrientName', definition.nutrient_name,
					'nutrientNumber', coalesce(definition.nutrient_number, ''),
					'unitName', corrected.unit_name,
					'value', corrected.amount_per_100g,
					'valueOrigin', 'reported',
					'valueStatus', case
						when corrected.serving_value = 0 then 'reported-zero'
						else 'reported'
					end,
					'mappingStatus', 'canonical',
					'source', 'user-label',
					'sourceReference', 'package-label:08801005523455:2026-08-29',
					'confidence', 'moderator-reviewed'
				)
				order by corrected.nutrient_id
			)
			from corrected_sempio_label_nutrients corrected
			join public.nutrient_definitions definition
				on definition.nutrient_id = corrected.nutrient_id
		),
		'reportedNutrientIds', (
			select jsonb_agg(corrected.nutrient_id order by corrected.nutrient_id)
			from corrected_sempio_label_nutrients corrected
		),
		'servingSize', 18,
		'servingSizeUnit', 'g',
		'householdServingFullText', '1 Tbsp (18 g)',
		'hasSourceServing', true,
		'foodServings', jsonb_build_array(
			jsonb_build_object(
				'label', '1 Tbsp (18 g)',
				'gramWeight', 18,
				'amount', 1,
				'unitKey', 'tbsp',
				'isPrimary', true,
				'measureType', 'Package serving',
				'isHouseholdMeasure', true,
				'sourceMeasureKey', 'package-label:08801005523455:serving',
				'origin', 'package-label',
				'gramWeightMethod', 'source-reported'
			)
		),
		'ingredients', 'Rice, Water, Corn Syrup, Red Pepper Powder, Salt, Soybeans, Alcohol, Wheat Extract, Soy Seasoning (Soybeans, Wheat Gluten, Salt, Alcohol, Yeast Extract, Maltodextrin), Concentrated Garlic Juice, Koji-Starter.',
		'ingredientList', jsonb_build_array(
			'Rice',
			'Water',
			'Corn Syrup',
			'Red Pepper Powder',
			'Salt',
			'Soybeans',
			'Alcohol',
			'Wheat Extract',
			'Soy Seasoning',
			'Wheat Gluten',
			'Yeast Extract',
			'Maltodextrin',
			'Concentrated Garlic Juice',
			'Koji-Starter'
		),
		'allergens', jsonb_build_array('wheat', 'soy'),
		'traces', '[]'::jsonb,
		'fieldProvenance', coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
			|| jsonb_build_object(
				'nutrition', jsonb_build_object(
					'source', 'user-label',
					'sourceReference', 'package-label:08801005523455:2026-08-29',
					'confidence', 'moderator-reviewed',
					'verificationMethod', 'package-label'
				),
				'serving', jsonb_build_object(
					'source', 'user-label',
					'sourceReference', 'package-label:08801005523455:2026-08-29',
					'confidence', 'moderator-reviewed',
					'verificationMethod', 'package-label'
				),
				'ingredients', jsonb_build_object(
					'source', 'user-label',
					'sourceReference', 'package-label:08801005523455:2026-08-29',
					'confidence', 'moderator-reviewed',
					'verificationMethod', 'package-label'
				),
				'allergens', jsonb_build_object(
					'source', 'user-label',
					'sourceReference', 'package-label:08801005523455:2026-08-29',
					'confidence', 'moderator-reviewed',
					'verificationMethod', 'package-label'
				)
			)
			|| (
				select jsonb_object_agg(
					'nutrient:' || corrected.nutrient_id::text,
					jsonb_build_object(
						'source', 'user-label',
						'sourceReference', 'package-label:08801005523455:2026-08-29',
						'confidence', 'moderator-reviewed',
						'verificationMethod', 'package-label'
					)
				)
				from corrected_sempio_label_nutrients corrected
			),
		'sourceMetadata', coalesce(product.food -> 'sourceMetadata', '{}'::jsonb)
			|| jsonb_build_object(
				'language', 'en',
				'marketCountries', jsonb_build_array('United States'),
				'sourceServing', jsonb_build_object(
					'amount', 18,
					'unit', 'g',
					'label', '1 Tbsp'
				),
				'labelObservedAt', '2026-08-29T00:00:00.000Z'
			)
	),
	last_verified_at = now(),
	updated_at = now()
where product.id in (
	select shared_product_id
	from corrected_sempio_product
);

create temporary table corrected_sempio_observation (
	observation_id uuid primary key
) on commit drop;

with evidence as (
	select
		product.barcode,
		jsonb_build_object(
			'evidenceType', 'package-label-review',
			'labelObservedAt', '2026-08-29T00:00:00.000Z',
			'serving', jsonb_build_object(
				'label', '1 Tbsp',
				'weightGrams', 18
			),
			'labelNutrients', (
				select jsonb_agg(
					jsonb_build_object(
						'nutrientId', corrected.nutrient_id,
						'value', corrected.serving_value,
						'unitName', corrected.unit_name
					)
					order by corrected.nutrient_id
				)
				from corrected_sempio_label_nutrients corrected
			),
			'contains', jsonb_build_array('wheat', 'soy')
		) as raw_payload,
		product.food as normalized_food
	from public.shared_products product
	join corrected_sempio_product target
		on target.shared_product_id = product.id
),
inserted as (
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
		evidence.barcode,
		'user-label',
		'package-label:08801005523455:2026-08-29',
		'User-provided package label; factual data retained without redistributing the image',
		evidence.raw_payload,
		evidence.normalized_food,
		encode(extensions.digest(evidence.raw_payload::text, 'sha256'), 'hex'),
		'2026-08-29T00:00:00.000Z'::timestamptz
	from evidence
	returning id
)
insert into corrected_sempio_observation (observation_id)
select id
from inserted;

update public.shared_product_field_provenance provenance
set selected = false
where provenance.shared_product_id in (
		select shared_product_id
		from corrected_sempio_product
	)
	and (
		provenance.field_path in ('nutrition', 'serving', 'ingredients', 'allergens')
		or provenance.field_path in (
			select 'nutrient:' || corrected.nutrient_id::text
			from corrected_sempio_label_nutrients corrected
		)
	)
	and provenance.selected;

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
	target.shared_product_id,
	observation.observation_id,
	'nutrient:' || corrected.nutrient_id::text,
	jsonb_build_object(
		'value', corrected.serving_value,
		'unitName', corrected.unit_name,
		'basis', '1 Tbsp (18 g) label serving'
	),
	jsonb_build_object(
		'value', corrected.amount_per_100g,
		'unitName', corrected.unit_name,
		'basis', 'per 100 g'
	),
	true,
	'moderator-reviewed',
	'label-review'
from corrected_sempio_product target
cross join corrected_sempio_observation observation
cross join corrected_sempio_label_nutrients corrected;

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
	target.shared_product_id,
	observation.observation_id,
	field.field_path,
	field.source_value,
	field.normalized_value,
	true,
	'moderator-reviewed',
	'label-review'
from corrected_sempio_product target
cross join corrected_sempio_observation observation
cross join lateral (
	values
		(
			'nutrition'::text,
			jsonb_build_object('basis', '1 Tbsp (18 g) package label'),
			jsonb_build_object('basis', 'per 100 g')
		),
		(
			'serving'::text,
			jsonb_build_object('label', '1 Tbsp', 'weightGrams', 18),
			jsonb_build_object('label', '1 Tbsp (18 g)', 'weightGrams', 18)
		),
		(
			'ingredients'::text,
			jsonb_build_object('reported', true),
			jsonb_build_object('reported', true)
		),
		(
			'allergens'::text,
			jsonb_build_array('wheat', 'soy'),
			jsonb_build_array('wheat', 'soy')
		)
) as field(field_path, source_value, normalized_value);

update public.shared_products product
set
	canonical_provenance =
		coalesce(product.canonical_provenance, '{}'::jsonb)
		|| jsonb_build_object(
			'nutrition', jsonb_build_object(
				'source', 'user-label',
				'sourceReference', 'package-label:08801005523455:2026-08-29',
				'observationId', observation.observation_id,
				'confidence', 'moderator-reviewed',
				'verificationMethod', 'package-label'
			),
			'serving', jsonb_build_object(
				'source', 'user-label',
				'sourceReference', 'package-label:08801005523455:2026-08-29',
				'observationId', observation.observation_id,
				'confidence', 'moderator-reviewed',
				'verificationMethod', 'package-label'
			),
			'ingredients', jsonb_build_object(
				'source', 'user-label',
				'sourceReference', 'package-label:08801005523455:2026-08-29',
				'observationId', observation.observation_id,
				'confidence', 'moderator-reviewed',
				'verificationMethod', 'package-label'
			),
			'allergens', jsonb_build_object(
				'source', 'user-label',
				'sourceReference', 'package-label:08801005523455:2026-08-29',
				'observationId', observation.observation_id,
				'confidence', 'moderator-reviewed',
				'verificationMethod', 'package-label'
			)
		)
		|| (
			select jsonb_object_agg(
				'nutrient:' || corrected.nutrient_id::text,
				jsonb_build_object(
					'source', 'user-label',
					'sourceReference', 'package-label:08801005523455:2026-08-29',
					'observationId', observation.observation_id,
					'confidence', 'moderator-reviewed',
					'verificationMethod', 'package-label'
				)
			)
			from corrected_sempio_label_nutrients corrected
		),
	updated_at = now()
from corrected_sempio_observation observation
where product.id in (
	select shared_product_id
	from corrected_sempio_product
);

with latest_revision as (
	select distinct on (revision.shared_product_id)
		revision.shared_product_id,
		revision.id,
		revision.revision_number
	from public.shared_product_revisions revision
	join corrected_sempio_product target
		on target.shared_product_id = revision.shared_product_id
	order by revision.shared_product_id, revision.revision_number desc
)
insert into public.shared_product_revisions (
		shared_product_id,
		revision_number,
		food,
		source,
		source_reference,
		supersedes_revision_id,
		change_summary,
		label_observed_at
	)
	select
		product.id,
		coalesce(latest.revision_number, 0) + 1,
		product.food,
		'community-reviewed',
		'package-label:08801005523455:2026-08-29',
		latest.id,
		jsonb_build_object(
			'audit', 'package-label-correction',
			'changes', jsonb_build_array(
				jsonb_build_object(
					'field', 'nutrition',
					'label', 'Nutrition',
					'changeType', 'changed',
					'previousValue', target.previous_food -> 'foodNutrients',
					'submittedValue', product.food -> 'foodNutrients',
					'severity', 'high',
					'reason', 'Replaced stale provider values with the reviewed current package label.'
				),
				jsonb_build_object(
					'field', 'serving',
					'label', 'Serving',
					'changeType', 'changed',
					'previousValue', jsonb_build_object(
						'label', target.previous_food ->> 'householdServingFullText',
						'weightGrams', target.previous_food -> 'servingSize'
					),
					'submittedValue', jsonb_build_object(
						'label', product.food ->> 'householdServingFullText',
						'weightGrams', product.food -> 'servingSize'
					),
					'severity', 'high',
					'reason', 'Corrected the package serving from 30 g to 18 g.'
				)
			)
		),
		'2026-08-29T00:00:00.000Z'::timestamptz
	from public.shared_products product
	join corrected_sempio_product target
		on target.shared_product_id = product.id
	left join latest_revision latest
		on latest.shared_product_id = product.id;

update public.shared_product_conflicts conflict
set
	status = 'resolved',
	resolution_note = 'Resolved against the reviewed current package label dated 2026-08-29.',
	resolved_at = now()
where conflict.shared_product_id in (
		select shared_product_id
		from corrected_sempio_product
	)
	and conflict.status = 'open'
	and conflict.field_path in (
		select 'nutrient:' || corrected.nutrient_id::text
		from corrected_sempio_label_nutrients corrected
	);

update public.user_food_list_items item
set
	food = item.food || jsonb_build_object(
		'foodNutrients', product.food -> 'foodNutrients',
		'reportedNutrientIds', product.food -> 'reportedNutrientIds',
		'servingSize', product.food -> 'servingSize',
		'servingSizeUnit', product.food -> 'servingSizeUnit',
		'householdServingFullText', product.food -> 'householdServingFullText',
		'hasSourceServing', product.food -> 'hasSourceServing',
		'foodServings', product.food -> 'foodServings',
		'ingredients', product.food -> 'ingredients',
		'ingredientList', product.food -> 'ingredientList',
		'allergens', product.food -> 'allergens',
		'traces', product.food -> 'traces',
		'fieldProvenance', coalesce(item.food -> 'fieldProvenance', '{}'::jsonb)
			|| coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
	),
	updated_at = now()
from public.shared_products product
join corrected_sempio_product target
	on target.shared_product_id = product.id
where item.shared_product_id = product.id;

do $$
declare
	v_serving_weight numeric;
	v_total_sugars numeric;
	v_added_sugars numeric;
	v_open_conflict_count integer;
begin
	select
		(product.food ->> 'servingSize')::numeric,
		(
			select (nutrient.value ->> 'value')::numeric
			from jsonb_array_elements(product.food -> 'foodNutrients') nutrient(value)
			where (nutrient.value ->> 'nutrientId')::bigint = 2000
		),
		(
			select (nutrient.value ->> 'value')::numeric
			from jsonb_array_elements(product.food -> 'foodNutrients') nutrient(value)
			where (nutrient.value ->> 'nutrientId')::bigint = 1235
		)
	into v_serving_weight, v_total_sugars, v_added_sugars
	from public.shared_products product
	where product.barcode = '08801005523455'
		and product.status = 'active';

	if v_serving_weight is not null and v_serving_weight is distinct from 18 then
		raise exception 'Sempio serving weight was not corrected: %', v_serving_weight;
	end if;

	if v_total_sugars is not null
		and abs(v_total_sugars - 27.7777777777778) > 0.000001 then
		raise exception 'Sempio total sugars were not corrected: %', v_total_sugars;
	end if;

	if v_added_sugars is not null
		and abs(v_added_sugars - 27.7777777777778) > 0.000001 then
		raise exception 'Sempio added sugars were not corrected: %', v_added_sugars;
	end if;

	select count(*)
	into v_open_conflict_count
	from public.shared_product_conflicts conflict
	join public.shared_products product
		on product.id = conflict.shared_product_id
	where product.barcode = '08801005523455'
		and conflict.status = 'open'
		and conflict.field_path in ('nutrient:2000', 'nutrient:1235');

	if v_open_conflict_count <> 0 then
		raise exception
			'Sempio sugar conflicts remain open: %',
			v_open_conflict_count;
	end if;
end;
$$;
