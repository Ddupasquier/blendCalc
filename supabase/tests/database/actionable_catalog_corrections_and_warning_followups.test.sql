begin;

select plan(14);

select ok(
	has_function_privilege(
		'authenticated',
		'public.review_food_compatibility_feedback(uuid,text,text,text)',
		'execute'
	),
	'authenticated sessions can reach the guarded warning-review workflow'
);

select ok(
	not has_function_privilege(
		'anon',
		'public.review_food_compatibility_feedback(uuid,text,text,text)',
		'execute'
	),
	'anonymous clients cannot review food-warning reports'
);

insert into auth.users (id, aud, role, email)
values
	('72200000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'follow-up-user@blendcalc.local'),
	('72200000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'follow-up-moderator@blendcalc.local');

insert into public.app_role_assignments (user_id, role)
values ('72200000-0000-4000-8000-000000000002', 'moderator');

insert into public.food_compatibility_feedback (
	id,
	reported_by,
	policy_version_id,
	shared_product_id,
	shared_product_revision_id,
	source_key,
	source_id,
	barcode,
	food_description,
	feedback_type,
	preference_type,
	preference_value,
	preference_tag_id,
	fact_snapshot,
	report_reason,
	report_details,
	report_fingerprint
)
select
	'72200000-0000-4000-8000-000000000010',
	'72200000-0000-4000-8000-000000000001',
	public.active_food_compatibility_policy_version_id(),
	product.id,
	revision.id,
	'shared-catalog',
	product.id::text,
	product.barcode,
	product.product_name,
	'missing_warning',
	'allergen',
	tag.slug,
	tag.id,
	'{}'::jsonb,
	'missing_warning',
	'The current package label shows this allergen, but no warning appeared.',
	repeat('a', 64)
from public.shared_products product
join lateral (
	select candidate.id
	from public.shared_product_revisions candidate
	where candidate.shared_product_id = product.id
	order by candidate.revision_number desc
	limit 1
) revision on true
join public.compatibility_tags tag on tag.slug = 'milk'
where product.id = '84000000-0000-4000-8000-000000000681';

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"72200000-0000-4000-8000-000000000001","role":"authenticated","app_role":"user","aal":"aal2"}',
	true
);

select throws_ok(
	$$select public.review_food_compatibility_feedback(
		'72200000-0000-4000-8000-000000000010',
		'confirmed',
		'product_correction',
		'The package evidence supports a correction.'
	)$$,
	'42501',
	'MFA-verified food-warning review access is required.',
	'normal users cannot review warning reports'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72200000-0000-4000-8000-000000000002","role":"authenticated","app_role":"moderator","aal":"aal1"}',
	true
);

select throws_ok(
	$$select public.review_food_compatibility_feedback(
		'72200000-0000-4000-8000-000000000010',
		'confirmed',
		'product_correction',
		'The package evidence supports a correction.'
	)$$,
	'42501',
	'MFA-verified food-warning review access is required.',
	'food-warning reviewers must verify MFA'
);

select set_config(
	'request.jwt.claims',
	'{"sub":"72200000-0000-4000-8000-000000000002","role":"authenticated","app_role":"moderator","aal":"aal2"}',
	true
);

select is(
	(
		public.review_food_compatibility_feedback(
			'72200000-0000-4000-8000-000000000010',
			'confirmed',
			'product_correction',
			'The package evidence supports a correction.'
		) ->> 'reviewed'
	)::boolean,
	true,
	'an AAL2 warning reviewer can confirm a product correction'
);

reset role;

select is(
	(
		select feedback.follow_up_status
		from public.food_compatibility_feedback feedback
		where feedback.id = '72200000-0000-4000-8000-000000000010'
	),
	'open',
	'confirmed correction reports remain open until the product is corrected'
);

select is(
	(
		select origin.status
		from public.catalog_correction_origins origin
		where origin.food_compatibility_feedback_id =
			'72200000-0000-4000-8000-000000000010'
	),
	'waiting_for_correction',
	'product feedback creates one prefilled correction origin'
);

select ok(
	(
		select
			origin.prefilled_food = product.food
			and origin.base_revision_id = feedback.shared_product_revision_id
		from public.catalog_correction_origins origin
		join public.food_compatibility_feedback feedback
			on feedback.id = origin.food_compatibility_feedback_id
		join public.shared_products product
			on product.id = origin.shared_product_id
		where origin.food_compatibility_feedback_id =
			'72200000-0000-4000-8000-000000000010'
	),
	'correction origins preserve the exact current food and reported revision'
);

insert into public.shared_product_submissions (
	id,
	submitted_by,
	barcode,
	product_name,
	brand_owner,
	food,
	consent_to_share,
	status,
	verification_status,
	validation_report,
	evidence_paths,
	evidence_complete,
	category_option_id,
	submission_kind,
	target_shared_product_id,
	base_revision_id,
	change_summary,
	label_observed_at,
	submission_intent
)
select
	'72200000-0000-4000-8000-000000000020',
	'72200000-0000-4000-8000-000000000002',
	product.barcode,
	product.product_name,
	product.brand_owner,
	jsonb_set(product.food, '{ingredients}', to_jsonb('Updated ingredient statement'::text)),
	true,
	'pending',
	'manual_review',
	'{}'::jsonb,
	'{}'::jsonb,
	true,
	product.category_option_id,
	'product_update',
	product.id,
	revision.id,
	jsonb_build_object(
		'version', 1,
		'observedAt', now(),
		'baseRevisionNumber', revision.revision_number,
		'changes', jsonb_build_array(jsonb_build_object(
			'field', 'ingredients',
			'label', 'Ingredient statement',
			'changeType', 'changed',
			'severity', 'medium',
			'previousValue', product.food -> 'ingredients',
			'submittedValue', 'Updated ingredient statement'
		)),
		'sourceChecks', '[]'::jsonb
	),
	now(),
	'catalog_correction'
from public.shared_products product
join public.shared_product_revisions revision
	on revision.id = (
		select candidate.id
		from public.shared_product_revisions candidate
		where candidate.shared_product_id = product.id
		order by candidate.revision_number desc
		limit 1
	)
where product.id = '84000000-0000-4000-8000-000000000681';

select is(
	(
		select origin.status
		from public.catalog_correction_origins origin
		where origin.food_compatibility_feedback_id =
			'72200000-0000-4000-8000-000000000010'
	),
	'linked',
	'a matching catalog correction automatically links its originating warning report'
);

select is(
	(
		select origin.submission_id
		from public.catalog_correction_origins origin
		where origin.food_compatibility_feedback_id =
			'72200000-0000-4000-8000-000000000010'
	),
	'72200000-0000-4000-8000-000000000020'::uuid,
	'the origin records the exact correction submission'
);

insert into public.shared_product_revisions (
	id,
	shared_product_id,
	revision_number,
	food,
	source,
	source_reference,
	created_by,
	submission_id,
	supersedes_revision_id,
	change_summary,
	label_observed_at
)
select
	'72200000-0000-4000-8000-000000000030',
	submission.target_shared_product_id,
	(select max(revision_number) + 1
		from public.shared_product_revisions
		where shared_product_id = submission.target_shared_product_id),
	submission.food,
	'community-reviewed',
	submission.barcode,
	'72200000-0000-4000-8000-000000000002',
	submission.id,
	submission.base_revision_id,
	submission.change_summary,
	submission.label_observed_at
from public.shared_product_submissions submission
where submission.id = '72200000-0000-4000-8000-000000000020';

update public.shared_product_submissions
set status = 'approved',
	reviewed_by = '72200000-0000-4000-8000-000000000002',
	reviewed_at = now(),
	review_note = 'Approved from current package evidence.'
where id = '72200000-0000-4000-8000-000000000020';

select is(
	(
		select origin.status
		from public.catalog_correction_origins origin
		where origin.food_compatibility_feedback_id =
			'72200000-0000-4000-8000-000000000010'
	),
	'resolved',
	'approval resolves the linked correction origin'
);

select is(
	(
		select origin.resolved_revision_id
		from public.catalog_correction_origins origin
		where origin.food_compatibility_feedback_id =
			'72200000-0000-4000-8000-000000000010'
	),
	'72200000-0000-4000-8000-000000000030'::uuid,
	'the correction origin records the immutable revision that resolved it'
);

select is(
	(
		select feedback.follow_up_status
		from public.food_compatibility_feedback feedback
		where feedback.id = '72200000-0000-4000-8000-000000000010'
	),
	'completed',
	'approved corrections complete the originating warning follow-up'
);

select ok(
	to_regclass('public.food_warning_policy_review_cases') is not null
	and to_regclass('public.catalog_correction_origins') is not null,
	'warning-policy and catalog-correction follow-ups have separate durable ownership'
);

select * from finish();

rollback;
