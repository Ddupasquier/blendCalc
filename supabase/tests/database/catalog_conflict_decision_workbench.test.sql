begin;

select plan(19);

select ok(
	has_function_privilege(
		'authenticated',
		'public.finish_catalog_conflict_review(uuid,jsonb)',
		'execute'
	),
	'an authenticated session can reach the guarded conflict workbench boundary'
);
select ok(
	not has_function_privilege(
		'anon',
		'public.finish_catalog_conflict_review(uuid,jsonb)',
		'execute'
	),
	'an anonymous session cannot finish catalog conflict work'
);

insert into auth.users (id, aud, role, email)
values
	(
		'99930000-0000-4000-8000-000000000001',
		'authenticated',
		'authenticated',
		'workbench-user@blendcalc.local'
	),
	(
		'99930000-0000-4000-8000-000000000002',
		'authenticated',
		'authenticated',
		'workbench-admin@blendcalc.local'
	);

insert into public.app_role_assignments (user_id, role)
values ('99930000-0000-4000-8000-000000000002', 'admin');

insert into public.shared_product_conflicts (
	id,
	shared_product_id,
	barcode,
	field_path,
	observed_values,
	severity,
	created_at
)
values
	(
		'99930000-0000-4000-8000-000000000011',
		'81000000-0000-4000-8000-000000000001',
		'00021130462506',
		'nutrient:1003',
		'[{
			"value": 3.5,
			"unitName": "G",
			"basis": "per 100 g",
			"source": "usda",
			"sourceReference": "00021130462506"
		}]'::jsonb,
		'high',
		'2026-09-11T12:00:00Z'
	),
	(
		'99930000-0000-4000-8000-000000000012',
		'81000000-0000-4000-8000-000000000001',
		'00021130462506',
		'nutrient:1093',
		'[{
			"value": 15,
			"unitName": "MG",
			"basis": "per 100 g",
			"source": "open-food-facts",
			"sourceReference": "00021130462506"
		}]'::jsonb,
		'high',
		'2026-09-11T12:01:00Z'
	),
	(
		'99930000-0000-4000-8000-000000000013',
		'81000000-0000-4000-8000-000000000001',
		'00021130462506',
		'nutrient:1004',
		'[{
			"value": 1.2,
			"unitName": "G",
			"basis": "per 100 g",
			"source": "open-food-facts",
			"sourceReference": "00021130462506"
		}]'::jsonb,
		'high',
		'2026-09-11T12:02:00Z'
	),
	(
		'99930000-0000-4000-8000-000000000014',
		'81000000-0000-4000-8000-000000000001',
		'00021130462506',
		'nutrient:1005',
		'[{
			"value": 62,
			"unitName": "G",
			"basis": "per 100 g",
			"source": "open-food-facts",
			"sourceReference": "00021130462506"
		}]'::jsonb,
		'high',
		'2026-09-11T12:03:00Z'
	);

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"99930000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.finish_catalog_conflict_review(
		'81000000-0000-4000-8000-000000000001',
		'[]'::jsonb
	)$$,
	'42501',
	'MFA-verified catalog-review access is required.',
	'ordinary users cannot record catalog conflict outcomes'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"99930000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);

reset role;
select is(
	(
		select count(*)
		from public.catalog_actionable_product_conflicts
		where shared_product_id = '81000000-0000-4000-8000-000000000001'
	),
	4::bigint,
	'the workbench presents one actionable item for each real field conflict'
);

set local role authenticated;
select throws_ok(
	$$select public.finish_catalog_conflict_review(
		'81000000-0000-4000-8000-000000000001',
		'[
			{
				"conflictId": "99930000-0000-4000-8000-000000000012",
				"outcome": "use_observation",
				"observationIndex": 0,
				"note": "This deliberately selects evidence that lacks redistribution rights."
			},
			{
				"conflictId": "99930000-0000-4000-8000-000000000011",
				"outcome": "keep_current",
				"note": "The stored value remains the strongest available evidence for this field."
			},
			{
				"conflictId": "99930000-0000-4000-8000-000000000013",
				"outcome": "insufficient_evidence",
				"note": "The current evidence cannot support a conclusive field decision today."
			},
			{
				"conflictId": "99930000-0000-4000-8000-000000000014",
				"outcome": "keep_current",
				"note": "The stored package-label value is the strongest available evidence."
			}
		]'::jsonb
	)$$,
	'22023',
	'The selected provider value cannot be redistributed through blendCalcAPI v1.',
	'provider evidence without redistribution rights cannot become an API correction'
);

create temporary table workbench_result as
select public.finish_catalog_conflict_review(
	'81000000-0000-4000-8000-000000000001',
	'[
		{
			"conflictId": "99930000-0000-4000-8000-000000000011",
			"outcome": "use_observation",
			"observationIndex": 0,
			"note": "The Open Food Facts product record directly reports protein per 100 g."
		},
		{
			"conflictId": "99930000-0000-4000-8000-000000000012",
			"outcome": "use_other",
			"replacementValue": 12.5,
			"evidenceReference": "package-label:test-fixture",
			"note": "The package label reports 12.5 mg sodium on the normalized 100 g basis."
		},
		{
			"conflictId": "99930000-0000-4000-8000-000000000013",
			"outcome": "insufficient_evidence",
			"note": "The current sources conflict and no legible package label is available."
		},
		{
			"conflictId": "99930000-0000-4000-8000-000000000014",
			"outcome": "keep_current",
			"note": "The stored package-label value has a more direct and recent evidence record."
		}
	]'::jsonb
) as result;

reset role;
select is(
	(select (result ->> 'replacementCount')::integer from workbench_result),
	2,
	'two evidence-backed replacements are recorded together'
);
select is(
	(select (result ->> 'insufficientEvidenceCount')::integer from workbench_result),
	1,
	'the inconclusive evidence snapshot receives a terminal queue outcome'
);
select is(
	(
		select count(*)
		from public.catalog_actionable_product_conflicts
		where shared_product_id = '81000000-0000-4000-8000-000000000001'
	),
	0::bigint,
	'finishing removes every decided conflict from the actionable catalog queue'
);
select is(
	(
		select count(*)
		from public.shared_product_conflicts
		where id in (
			'99930000-0000-4000-8000-000000000011',
			'99930000-0000-4000-8000-000000000012'
		)
			and status = 'open'
	),
	2::bigint,
	'replacement conflicts remain open until the correction is approved'
);
select is(
	(
		select count(*)
		from public.catalog_conflict_review_dispositions
		where conflict_id = '99930000-0000-4000-8000-000000000013'
	),
	1::bigint,
	'the insufficient-evidence decision is retained for its exact evidence fingerprint'
);
select is(
	(
		select count(*)
		from public.shared_product_submissions
		where target_shared_product_id = '81000000-0000-4000-8000-000000000001'
			and status = 'pending'
			and submission_intent = 'catalog_correction'
	),
	1::bigint,
	'all replacement decisions create one correction submission'
);
select is(
	(
		select count(*)
		from public.catalog_correction_origins
		where shared_product_id = '81000000-0000-4000-8000-000000000001'
			and status = 'linked'
	),
	2::bigint,
	'the one pending submission links both replacement conflicts'
);
select is(
	(
		select (nutrient ->> 'value')::numeric
		from public.shared_product_submissions submission,
			jsonb_array_elements(submission.food -> 'foodNutrients') nutrient
		where submission.target_shared_product_id = '81000000-0000-4000-8000-000000000001'
			and submission.status = 'pending'
			and (nutrient ->> 'nutrientId')::bigint = 1003
	),
	3.5::numeric,
	'the pending correction contains the selected provider value'
);
select is(
	(
		select (nutrient ->> 'value')::numeric
		from public.shared_product_submissions submission,
			jsonb_array_elements(submission.food -> 'foodNutrients') nutrient
		where submission.target_shared_product_id = '81000000-0000-4000-8000-000000000001'
			and submission.status = 'pending'
			and (nutrient ->> 'nutrientId')::bigint = 1093
	),
	12.5::numeric,
	'the pending correction contains the separately evidenced replacement value'
);

reset role;
update public.shared_product_submissions
set status = 'rejected',
	reviewed_by = '99930000-0000-4000-8000-000000000002',
	reviewed_at = now(),
	review_note = 'The test correction was rejected to prove the queue returns.'
where target_shared_product_id = '81000000-0000-4000-8000-000000000001'
	and status = 'pending'
	and submission_intent = 'catalog_correction';
select is(
	(
		select count(*)
		from public.catalog_actionable_product_conflicts
		where shared_product_id = '81000000-0000-4000-8000-000000000001'
	),
	2::bigint,
	'rejecting the correction returns its two unresolved conflicts to catalog review'
);
select is(
	(
		select count(*)
		from public.catalog_correction_origins
		where shared_product_id = '81000000-0000-4000-8000-000000000001'
			and status = 'waiting_for_correction'
	),
	2::bigint,
	'rejected correction origins are ready for a better replacement submission'
);

reset role;
update public.shared_product_conflicts
set observed_values = observed_values || '[{
	"value": 0.8,
	"unitName": "G",
	"basis": "per 100 g",
	"source": "usda",
	"sourceReference": "new-evidence"
}]'::jsonb
where id = '99930000-0000-4000-8000-000000000013';

select is(
	(
		select count(*)
		from public.catalog_actionable_product_conflicts
		where shared_product_id = '81000000-0000-4000-8000-000000000001'
	),
	3::bigint,
	'new material evidence changes the fingerprint and reopens the inconclusive conflict'
);
set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"99930000-0000-4000-8000-000000000002","role":"authenticated","app_role":"admin","aal":"aal2"}',
	true
);
select ok(
	cardinality(public.get_catalog_product_api_withholding_reasons(
		'81000000-0000-4000-8000-000000000001'
	)) > 0,
	'the workbench exposes the exact reasons the product remains withheld'
);
reset role;
select is(
	(
		select count(*)
		from public.shared_product_conflicts
		where shared_product_id = '81000000-0000-4000-8000-000000000001'
			and status = 'resolved'
	),
	1::bigint,
	'only the explicit keep-current outcome resolves its source conflict immediately'
);

select * from finish();
rollback;
