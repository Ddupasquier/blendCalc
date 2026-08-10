update public.nutrient_unit_conversions
set
	multiplier = 0.025,
	conversion_method = 'moderator_verified',
	confidence = 1,
	observation_count = greatest(observation_count, 1),
	provenance = jsonb_build_object(
		'authority', 'U.S. Food and Drug Administration',
		'sourceReference', 'https://www.fda.gov/media/129863/download',
		'rule', '1 IU vitamin D equals 0.025 micrograms',
		'audit', '20260730130000_barcode_nutrition_audit_corrections'
	)
where nutrient_id = 1114
	and upper(from_unit_name) = 'IU'
	and upper(to_unit_name) in ('UG', 'ΜG', 'MCG');

create temporary table nutrition_audit_unsupported_nutrients
on commit drop
as
select
	nutrient.shared_product_id,
	nutrient.nutrient_id,
	nutrient.amount_per_100g,
	nutrient.unit_name
from public.food_nutrients nutrient
where nutrient.shared_product_id is not null
	and nutrient.amount_per_100g = 0
	and nutrient.value_origin = 'derived'
	and nutrient.source = 'unknown'
	and nutrient.source_observation_id is null
	and nutrient.shared_product_observation_id is null;

create temporary table nutrition_audit_removed_zero_products
on commit drop
as
select
	product.id as shared_product_id,
	product.food as previous_food,
	array_agg(unsupported.nutrient_id order by unsupported.nutrient_id)
		as removed_nutrient_ids
from public.shared_products product
join nutrition_audit_unsupported_nutrients unsupported
	on unsupported.shared_product_id = product.id
group by product.id, product.food;

update public.shared_products product
set
	food = jsonb_set(
		jsonb_set(
			jsonb_set(
				product.food,
				'{foodNutrients}',
				coalesce(
					(
						select jsonb_agg(nutrient.value order by nutrient.ordinality)
						from jsonb_array_elements(
							coalesce(product.food -> 'foodNutrients', '[]'::jsonb)
						) with ordinality as nutrient(value, ordinality)
						where not exists (
							select 1
							from nutrition_audit_unsupported_nutrients unsupported
							where unsupported.shared_product_id = product.id
								and unsupported.nutrient_id =
									(nutrient.value ->> 'nutrientId')::integer
						)
					),
					'[]'::jsonb
				),
				true
			),
			'{reportedNutrientIds}',
			coalesce(
				(
					select jsonb_agg(nutrient_id.value order by nutrient_id.ordinality)
					from jsonb_array_elements(
						coalesce(product.food -> 'reportedNutrientIds', '[]'::jsonb)
					) with ordinality as nutrient_id(value, ordinality)
					where not exists (
						select 1
						from nutrition_audit_unsupported_nutrients unsupported
						where unsupported.shared_product_id = product.id
							and unsupported.nutrient_id =
								(nutrient_id.value #>> '{}')::integer
					)
				),
				'[]'::jsonb
			),
			true
		),
		'{fieldProvenance}',
		coalesce(
			(
				select jsonb_object_agg(provenance.key, provenance.value)
				from jsonb_each(
					coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
				) provenance
				where not exists (
					select 1
					from nutrition_audit_unsupported_nutrients unsupported
					where unsupported.shared_product_id = product.id
						and provenance.key =
							'nutrient:' || unsupported.nutrient_id::text
				)
			),
			'{}'::jsonb
		),
		true
	),
	canonical_provenance = coalesce(
		(
			select jsonb_object_agg(provenance.key, provenance.value)
			from jsonb_each(
				coalesce(product.canonical_provenance, '{}'::jsonb)
			) provenance
			where not exists (
				select 1
				from nutrition_audit_unsupported_nutrients unsupported
				where unsupported.shared_product_id = product.id
					and provenance.key =
						'nutrient:' || unsupported.nutrient_id::text
			)
		),
		'{}'::jsonb
	),
	updated_at = now()
where exists (
	select 1
	from nutrition_audit_unsupported_nutrients unsupported
	where unsupported.shared_product_id = product.id
);

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
	product.source,
	product.source_reference,
	latest.id,
	jsonb_build_object(
		'audit', 'barcode-nutrition-accuracy',
		'changes',
		jsonb_build_array(
			jsonb_build_object(
				'field', 'nutrition',
				'label', 'Nutrition',
				'changeType', 'removed',
				'previousValue', to_jsonb(removed.removed_nutrient_ids),
				'submittedValue', coalesce(
					product.food -> 'reportedNutrientIds',
					'[]'::jsonb
				),
				'severity', 'high',
				'reason',
					'Removed zero values that were not reported by any source.'
			)
		)
	),
	coalesce(latest.label_observed_at, product.updated_at)
from nutrition_audit_removed_zero_products removed
join public.shared_products product
	on product.id = removed.shared_product_id
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

create temporary table nutrition_audit_almond_values (
	nutrient_id integer primary key,
	value_per_100g numeric not null,
	unit_name text not null,
	source_value numeric not null
) on commit drop;

insert into nutrition_audit_almond_values (
	nutrient_id,
	value_per_100g,
	unit_name,
	source_value
)
values
	(1003, 0.4167, 'G', 1),
	(1004, 1.0417, 'G', 2.5),
	(1005, 0.4167, 'G', 1),
	(1008, 12.5, 'KCAL', 30),
	(1079, 0.4167, 'G', 1),
	(1093, 70.8333, 'MG', 170),
	(1258, 0, 'G', 0),
	(2000, 0, 'G', 0);

create temporary table nutrition_audit_almond_product
on commit drop
as
select
	product.id as shared_product_id,
	product.food as previous_food,
	product.canonical_provenance as previous_canonical_provenance
from public.shared_products product
where product.barcode = '00041570054130'
	and product.source = 'usda'
	and product.source_reference = '2757275';

update public.shared_products product
set food = jsonb_set(
	product.food,
	'{foodNutrients}',
	coalesce(
		(
			select jsonb_agg(
				case
					when corrected.nutrient_id is null then nutrient.value
					else jsonb_set(
						jsonb_set(
							jsonb_set(
								jsonb_set(
									nutrient.value,
									'{value}',
									to_jsonb(corrected.value_per_100g),
									true
								),
								'{source}',
								to_jsonb('usda'::text),
								true
							),
							'{sourceReference}',
							to_jsonb('2757275'::text),
							true
						),
						'{valueOrigin}',
						to_jsonb('reported'::text),
						true
					)
				end
				order by nutrient.ordinality
			)
			from jsonb_array_elements(
				coalesce(product.food -> 'foodNutrients', '[]'::jsonb)
			) with ordinality as nutrient(value, ordinality)
			left join nutrition_audit_almond_values corrected
				on corrected.nutrient_id =
					(nutrient.value ->> 'nutrientId')::integer
		),
		'[]'::jsonb
	),
	true
)
where product.id in (
	select shared_product_id
	from nutrition_audit_almond_product
);

create temporary table nutrition_audit_almond_observation (
	observation_id uuid primary key
) on commit drop;

with corrected_product as (
	select product.*
	from public.shared_products product
	join nutrition_audit_almond_product target
		on target.shared_product_id = product.id
),
evidence as (
	select
		product.barcode,
		jsonb_build_object(
			'audit', 'barcode-nutrition-accuracy',
			'fdcId', 2757275,
			'dataType', 'Branded',
			'servingSize', 240,
			'servingSizeUnit', 'g',
			'labelNutrients', jsonb_build_array(
				jsonb_build_object('nutrientId', 1003, 'value', 1, 'unitName', 'G'),
				jsonb_build_object('nutrientId', 1004, 'value', 2.5, 'unitName', 'G'),
				jsonb_build_object('nutrientId', 1005, 'value', 1, 'unitName', 'G'),
				jsonb_build_object('nutrientId', 1008, 'value', 30, 'unitName', 'KCAL'),
				jsonb_build_object('nutrientId', 1079, 'value', 1, 'unitName', 'G'),
				jsonb_build_object('nutrientId', 1093, 'value', 170, 'unitName', 'MG'),
				jsonb_build_object('nutrientId', 1258, 'value', 0, 'unitName', 'G'),
				jsonb_build_object('nutrientId', 2000, 'value', 0, 'unitName', 'G')
			),
			'normalizedPer100g', (
				select jsonb_agg(
					jsonb_build_object(
						'nutrientId', corrected.nutrient_id,
						'value', corrected.value_per_100g,
						'unitName', corrected.unit_name
					)
					order by corrected.nutrient_id
				)
				from nutrition_audit_almond_values corrected
			),
			'sourceReference',
				'https://fdc.nal.usda.gov/food-details/2757275/nutrients'
		) as raw_payload,
		product.food as normalized_food
	from corrected_product product
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
		'usda',
		'2757275',
		'CC0-1.0',
		evidence.raw_payload,
		evidence.normalized_food,
		encode(
			extensions.digest(evidence.raw_payload::text, 'sha256'),
			'hex'
		),
		now()
	from evidence
	returning id
)
insert into nutrition_audit_almond_observation (observation_id)
select id
from inserted;

update public.shared_product_field_provenance provenance
set selected = false
where provenance.shared_product_id in (
		select shared_product_id
		from nutrition_audit_almond_product
	)
	and provenance.field_path in (
		select 'nutrient:' || corrected.nutrient_id::text
		from nutrition_audit_almond_values corrected
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
		'nutrientId', corrected.nutrient_id,
		'value', corrected.source_value,
		'unitName', corrected.unit_name,
		'basis', '240 g label serving'
	),
	jsonb_build_object(
		'value', corrected.value_per_100g,
		'unitName', corrected.unit_name,
		'basis', 'per 100 g'
	),
	true,
	'imported',
	'exact-barcode'
from nutrition_audit_almond_product target
cross join nutrition_audit_almond_observation observation
cross join nutrition_audit_almond_values corrected;

update public.shared_products product
set
	food = jsonb_set(
		product.food,
		'{fieldProvenance}',
		coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
			|| (
				select jsonb_object_agg(
					'nutrient:' || corrected.nutrient_id::text,
					jsonb_build_object(
						'source', 'usda',
						'sourceReference', '2757275',
						'confidence', 'imported'
					)
				)
				from nutrition_audit_almond_values corrected
			),
		true
	),
	canonical_provenance =
		coalesce(product.canonical_provenance, '{}'::jsonb)
		|| (
			select jsonb_object_agg(
				'nutrient:' || corrected.nutrient_id::text,
				jsonb_build_object(
					'source', 'usda',
					'sourceReference', '2757275',
					'observationId', observation.observation_id,
					'confidence', 'imported',
					'verificationMethod', 'exact-barcode'
				)
			)
			from nutrition_audit_almond_values corrected
			cross join nutrition_audit_almond_observation observation
		),
	last_verified_at = now(),
	updated_at = now()
where product.id in (
	select shared_product_id
	from nutrition_audit_almond_product
);

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
	product.source,
	product.source_reference,
	latest.id,
	jsonb_build_object(
		'audit', 'barcode-nutrition-accuracy',
		'changes',
		jsonb_build_array(
			jsonb_build_object(
				'field', 'nutrition',
				'label', 'Nutrition',
				'changeType', 'changed',
				'previousValue',
					target.previous_food -> 'foodNutrients',
				'submittedValue',
					product.food -> 'foodNutrients',
				'severity', 'high',
				'reason',
					'Corrected USDA 240 g label-serving values to the canonical per-100 g basis.'
			)
		)
	),
	coalesce(latest.label_observed_at, product.updated_at)
from nutrition_audit_almond_product target
join public.shared_products product
	on product.id = target.shared_product_id
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

create temporary table nutrition_audit_changed_products
on commit drop
as
select shared_product_id
from nutrition_audit_removed_zero_products
union
select shared_product_id
from nutrition_audit_almond_product;

update public.user_food_list_items item
set
	food = jsonb_set(
		jsonb_set(
			jsonb_set(
				item.food,
				'{foodNutrients}',
				coalesce(product.food -> 'foodNutrients', '[]'::jsonb),
				true
			),
			'{reportedNutrientIds}',
			coalesce(product.food -> 'reportedNutrientIds', '[]'::jsonb),
			true
		),
		'{fieldProvenance}',
		coalesce(
			(
				select jsonb_object_agg(provenance.key, provenance.value)
				from jsonb_each(
					coalesce(item.food -> 'fieldProvenance', '{}'::jsonb)
				) provenance
				where provenance.key not like 'nutrient:%'
			),
			'{}'::jsonb
		)
		|| coalesce(
			(
				select jsonb_object_agg(provenance.key, provenance.value)
				from jsonb_each(
					coalesce(product.food -> 'fieldProvenance', '{}'::jsonb)
				) provenance
				where provenance.key like 'nutrient:%'
			),
			'{}'::jsonb
		),
		true
	),
	updated_at = now()
from public.shared_products product
join nutrition_audit_changed_products changed
	on changed.shared_product_id = product.id
where item.shared_product_id = product.id;

do $$
declare
	v_remaining_unsupported_count integer;
	v_conversion_multiplier numeric;
	v_corrected_energy numeric;
begin
	select count(*)
	into v_remaining_unsupported_count
	from public.food_nutrients nutrient
	where nutrient.shared_product_id is not null
		and nutrient.amount_per_100g = 0
		and nutrient.value_origin = 'derived'
		and nutrient.source = 'unknown'
		and nutrient.source_observation_id is null
		and nutrient.shared_product_observation_id is null;

	if v_remaining_unsupported_count <> 0 then
		raise exception
			'Unsupported shared-catalog zero nutrient rows remain: %',
			v_remaining_unsupported_count;
	end if;

	select conversion.multiplier
	into v_conversion_multiplier
	from public.nutrient_unit_conversions conversion
	where conversion.nutrient_id = 1114
		and upper(conversion.from_unit_name) = 'IU'
		and upper(conversion.to_unit_name) in ('UG', 'ΜG', 'MCG')
	limit 1;

	if v_conversion_multiplier is distinct from 0.025 then
		raise exception
			'Vitamin D IU conversion was not corrected: %',
			v_conversion_multiplier;
	end if;

	select nutrient.amount_per_100g
	into v_corrected_energy
	from public.food_nutrients nutrient
join public.shared_products product
		on product.id = nutrient.shared_product_id
	where product.barcode = '00041570054130'
		and nutrient.nutrient_id = 1008;

	if exists (
		select 1
		from public.shared_products product
		where product.barcode = '00041570054130'
	) and v_corrected_energy is distinct from 12.5 then
		raise exception
			'Almondmilk per-100g energy was not corrected: %',
			v_corrected_energy;
	end if;
end;
$$;
