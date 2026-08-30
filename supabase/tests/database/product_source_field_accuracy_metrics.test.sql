begin;

select plan(6);

select has_table(
	'public',
	'product_source_field_daily_metrics',
	'field-level source outcomes have a dedicated table'
);

select has_function(
	'public',
	'record_product_source_field_daily_metrics',
	array['jsonb'],
	'field-level source outcomes use one batched recorder'
);

select ok(
	has_function_privilege(
		'service_role',
		'public.record_product_source_field_daily_metrics(jsonb)',
		'EXECUTE'
	),
	'the service role can record field outcomes'
);

select ok(
	not has_function_privilege(
		'authenticated',
		'public.record_product_source_field_daily_metrics(jsonb)',
		'EXECUTE'
	),
	'application users cannot record operational field outcomes'
);

select lives_ok(
	$statement$
		select public.record_product_source_field_daily_metrics(
			jsonb_build_array(
				jsonb_build_object(
					'source_key', 'usda',
					'field_path', 'nutrient:2000',
					'evaluated_count', 2,
					'selected_count', 1,
					'internally_invalid_count', 0,
					'cross_source_disagreement_count', 1,
					'submitted_label_disagreement_count', 1,
					'confirmed_label_correction_count', 0
				)
			)
		)
	$statement$,
	'the recorder accepts one privacy-safe metric batch'
);

select results_eq(
	$$
		select
			evaluated_count,
			selected_count,
			cross_source_disagreement_count,
			submitted_label_disagreement_count
		from public.product_source_field_daily_metrics
		where source_key = 'usda'
			and field_path = 'nutrient:2000'
			and metric_date = (timezone('utc', now()))::date
	$$,
	$$ values (2::bigint, 1::bigint, 1::bigint, 1::bigint) $$,
	'the recorder preserves separate evaluated, selected, and disagreement counts'
);

select * from finish();

rollback;
