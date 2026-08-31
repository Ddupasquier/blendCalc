begin;

select plan(16);

select has_table(
	'public',
	'food_nutrient_qualitative_evidence',
	'qualitative nutrient label evidence has normalized storage'
);

select has_column(
	'public',
	'food_nutrient_qualitative_evidence',
	'qualitative_status',
	'qualitative evidence preserves its bounded value state'
);

select has_column(
	'public',
	'food_nutrient_qualitative_evidence',
	'source_observation_id',
	'qualitative evidence retains its source observation'
);

select ok(
	has_table_privilege(
		'authenticated',
		'public.food_nutrient_qualitative_evidence',
		'select'
	),
	'authenticated users can read policy-approved qualitative evidence'
);

select ok(
	not has_table_privilege(
		'authenticated',
		'public.food_nutrient_qualitative_evidence',
		'insert'
	),
	'authenticated users cannot bypass parent-table writes'
);

select ok(
	public.blendcalc_api_v1_source_is_eligible('user-label'),
	'accepted user label data uses the reviewed shared-catalog publication policy'
);

select ok(
	public.blendcalc_api_v1_source_attribution_is_complete(
		'user-label',
		'catalog-submission:test-reviewed-label'
	),
	'accepted user label data requires a durable reviewed source reference'
);

select isnt(
	public.blendcalc_api_v1_source_attribution_is_complete(
		'user-label',
		'unreviewed-browser-value'
	),
	true,
	'unreviewed user label references cannot inherit shared-catalog publication rights'
);

select ok(
	'missing_required_nutrient:1079' = any(
		public.blendcalc_api_v1_product_readiness_reasons(
			(select id from public.shared_products where barcode = '00011110904416')
		)
	),
	'the fixture begins with dietary fiber genuinely unreported'
);

update public.shared_products product
set food = product.food || jsonb_build_object(
	'nutrientQualitativeFacts',
	jsonb_build_array(jsonb_build_object(
		'nutrientId', 1079,
		'nutrientName', 'Fiber, total dietary',
		'nutrientNumber', '291',
		'unitName', 'G',
		'status', 'below-reporting-threshold',
		'statement', '<1 g dietary fiber per serving',
		'maximumAmount', 1,
		'measurementBasis', jsonb_build_object(
			'kind', 'serving',
			'quantity', 1,
			'unitKey', 'serving',
			'servingLabel', '2 Tbsp (30 g)'
		),
		'source', observation.source,
		'sourceReference', observation.source_reference,
		'sourceObservationId', observation.id,
		'confidence', 'moderator-reviewed',
		'mappingStatus', 'canonical',
		'mappingMethod', 'reviewed-label-alias'
	))
)
from public.shared_product_observations observation
where product.barcode = '00011110904416'
	and observation.barcode = product.barcode;

select is(
	(
		select count(*)::integer
		from public.food_nutrient_qualitative_evidence evidence
		join public.shared_products product on product.id = evidence.shared_product_id
		where product.barcode = '00011110904416'
			and evidence.nutrient_id = 1079
			and evidence.qualitative_status = 'below-reporting-threshold'
			and evidence.maximum_amount = 1
	),
	1,
	'parent food JSON synchronizes one normalized bounded nutrient fact'
);

select is(
	(
		select count(*)::integer
		from public.food_nutrients nutrient
		join public.shared_products product on product.id = nutrient.shared_product_id
		where product.barcode = '00011110904416'
			and nutrient.nutrient_id = 1079
	),
	0,
	'a qualitative upper bound never becomes an exact numeric nutrient'
);

select ok(
	not ('missing_required_nutrient:1079' = any(
		public.blendcalc_api_v1_product_readiness_reasons(
			(select id from public.shared_products where barcode = '00011110904416')
		)
	)),
	'reviewed attributed qualitative evidence satisfies publication completeness'
);

select ok(
	not ('missing_required_nutrient:1079' = any(
		coalesce((
			select readiness.reasons
			from public.blendcalc_api_v1_product_readiness readiness
			where readiness.barcode = '00011110904416'
		), '{}'::text[])
	)),
	'the publication-readiness view uses qualitative evidence instead of its superseded numeric-only dependency'
);

update public.product_data_sources
set api_redistribution_allowed = false
where key = 'shared-catalog';

select ok(
	'missing_required_nutrient:1079' = any(
		public.blendcalc_api_v1_product_readiness_reasons(
			(select id from public.shared_products where barcode = '00011110904416')
		)
	),
	'reviewed label evidence stays internal while community redistribution rights are disabled'
);

update public.product_data_sources
set api_redistribution_allowed = true
where key = 'shared-catalog';

update public.shared_products product
set food = product.food - 'nutrientQualitativeFacts'
where product.barcode = '00011110904416';

select is(
	(
		select count(*)::integer
		from public.food_nutrient_qualitative_evidence evidence
		join public.shared_products product on product.id = evidence.shared_product_id
		where product.barcode = '00011110904416'
	),
	0,
	'removing qualitative facts from the parent also removes normalized evidence'
);

select ok(
	'missing_required_nutrient:1079' = any(
		public.blendcalc_api_v1_product_readiness_reasons(
			(select id from public.shared_products where barcode = '00011110904416')
		)
	),
	'omission returns to unknown instead of silently becoming zero'
);

select * from finish();

rollback;
