begin;

select plan(13);

select has_table(
	'public',
	'shared_product_mass_volume_conversion_policies',
	'reviewed mass-volume conversions have a dedicated policy table'
);

select has_column(
	'public',
	'food_servings',
	'mass_volume_conversion_policy_id',
	'calculated shared-product servings retain their reviewed conversion policy'
);

create temporary table exact_volume_test_product on commit drop as
select
	product.id as shared_product_id,
	observation.id as observation_id
from public.shared_products product
join lateral (
	select candidate.id
	from public.shared_product_observations candidate
	where candidate.barcode = product.barcode
	order by candidate.observed_at desc, candidate.id
	limit 1
) observation on true
where product.status = 'active'
order by product.id
limit 1;

delete from public.shared_product_field_provenance provenance
where provenance.shared_product_id in (
	select target.shared_product_id from exact_volume_test_product target
)
	and provenance.field_path in ('serving', 'servingWeightGrams');

delete from public.food_servings serving
where serving.shared_product_id in (
	select target.shared_product_id from exact_volume_test_product target
);

select ok(
	'missing_evidence_backed_primary_serving' = any(
		public.blendcalc_api_v1_product_readiness_reasons(
			(select shared_product_id from exact_volume_test_product)
		)
	),
	'a product with no serving retains the primary-serving issue'
);

select ok(
	not 'missing_serving_provenance' = any(
		public.blendcalc_api_v1_product_readiness_reasons(
			(select shared_product_id from exact_volume_test_product)
		)
	),
	'a product with zero serving rows is not mislabeled as automatically repairable provenance'
);

insert into public.food_servings (
	shared_product_id,
	source_observation_id,
	serving_order,
	label,
	gram_weight,
	milliliter_volume,
	amount,
	unit_key,
	is_primary,
	measure_type,
	is_household_measure,
	source_measure_key,
	origin,
	gram_weight_method,
	source,
	source_reference,
	confidence
)
select
	target.shared_product_id,
	target.observation_id,
	1,
	'500 mL package',
	null,
	500,
	500,
	'ml',
	true,
	'Package amount',
	false,
	'packageQuantity',
	'package-label',
	'unknown',
	observation.source,
	observation.source_reference,
	'imported'
from exact_volume_test_product target
join public.shared_product_observations observation
	on observation.id = target.observation_id;

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
	target.observation_id,
	'serving',
	jsonb_build_object('amount', 500, 'unit', 'ml'),
	jsonb_build_object(
		'label', '500 mL package',
		'milliliterVolume', 500,
		'amount', 500,
		'unitKey', 'ml'
	),
	true,
	'imported',
	'exact-barcode'
from exact_volume_test_product target;

select ok(
	public.shared_product_has_exact_primary_serving(
		(select shared_product_id from exact_volume_test_product)
	),
	'an exact native package volume is a usable primary serving without grams'
);

select ok(
	public.shared_product_primary_serving_has_complete_provenance(
		(select shared_product_id from exact_volume_test_product)
	),
	'the package-volume serving links its selected observation'
);

select ok(
	not 'missing_evidence_backed_primary_serving' = any(
		public.blendcalc_api_v1_product_readiness_reasons(
			(select shared_product_id from exact_volume_test_product)
		)
	),
	'an exact volume clears the primary-serving issue without a density guess'
);

select ok(
	not 'missing_serving_provenance' = any(
		public.blendcalc_api_v1_product_readiness_reasons(
			(select shared_product_id from exact_volume_test_product)
		)
	),
	'complete volume evidence clears the serving-provenance issue'
);

select throws_ok(
	$$
		insert into public.food_servings (
			shared_product_id,
			source_observation_id,
			serving_order,
			label,
			gram_weight,
			milliliter_volume,
			is_primary,
			origin,
			gram_weight_method,
			calculation_basis,
			source,
			source_reference,
			confidence
		)
		select
			target.shared_product_id,
			target.observation_id,
			2,
			'100 mL calculated',
			100,
			100,
			false,
			'calculated-conversion',
			'calculated-conversion',
			'unreviewed density',
			observation.source,
			observation.source_reference,
			'imported'
		from exact_volume_test_product target
		join public.shared_product_observations observation
			on observation.id = target.observation_id
	$$,
	'P0001',
	'Calculated mass from volume requires an active reviewed conversion policy',
	'volume never becomes mass without a reviewed DB policy'
);

select throws_ok(
	$$
		insert into public.shared_product_mass_volume_conversion_policies (
			shared_product_id,
			source_observation_id,
			grams_per_milliliter,
			calculation_basis,
			evidence_reference,
			reviewed_at
		)
		select
			target.shared_product_id,
			other_observation.id,
			1,
			'Unrelated product evidence',
			'qa:unrelated-observation',
			now()
		from exact_volume_test_product target
		join public.shared_product_observations target_observation
			on target_observation.id = target.observation_id
		join lateral (
			select observation.id
			from public.shared_product_observations observation
			where observation.barcode <> target_observation.barcode
			order by observation.id
			limit 1
		) other_observation on true
	$$,
	'P0001',
	'Conversion policy evidence must match the shared product barcode',
	'conversion policy evidence cannot come from another product'
);

insert into public.shared_product_mass_volume_conversion_policies (
	id,
	shared_product_id,
	source_observation_id,
	grams_per_milliliter,
	calculation_basis,
	evidence_reference,
	reviewed_at
)
select
	'73200000-0000-4000-8000-000000000001'::uuid,
	target.shared_product_id,
	target.observation_id,
	1.01,
	'Product-specific measured mass-volume relationship: 1.01 g/mL',
	'qa:measured-density',
	now()
from exact_volume_test_product target;

select lives_ok(
	$$
		insert into public.food_servings (
			shared_product_id,
			source_observation_id,
			serving_order,
			label,
			gram_weight,
			milliliter_volume,
			is_primary,
			origin,
			gram_weight_method,
			calculation_basis,
			mass_volume_conversion_policy_id,
			source,
			source_reference,
			confidence
		)
		select
			target.shared_product_id,
			target.observation_id,
			2,
			'100 mL measured conversion',
			101,
			100,
			false,
			'calculated-conversion',
			'calculated-conversion',
			'placeholder replaced by policy',
			'73200000-0000-4000-8000-000000000001'::uuid,
			observation.source,
			observation.source_reference,
			'imported'
		from exact_volume_test_product target
		join public.shared_product_observations observation
			on observation.id = target.observation_id
	$$,
	'an exact product-specific policy permits the reviewed conversion'
);

select is(
	(
		select calculation_basis
		from public.food_servings
		where mass_volume_conversion_policy_id =
			'73200000-0000-4000-8000-000000000001'::uuid
	),
	'Product-specific measured mass-volume relationship: 1.01 g/mL',
	'the serving stores the authoritative policy calculation basis'
);

select ok(
	not exists (
		select 1
		from public.food_servings
		where shared_product_id = (
			select shared_product_id from exact_volume_test_product
		)
			and is_primary
			and gram_weight is not null
	),
	'the primary package volume remains native and never receives invented grams'
);

select * from finish();

rollback;
