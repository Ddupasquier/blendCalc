alter table public.food_compatibility_feedback
	add column feedback_type text not null default 'incorrect_warning',
	add column preference_type text,
	add column preference_value text,
	add column preference_tag_id uuid
		references public.compatibility_tags(id) on delete restrict,
	add column observed_label_date date,
	add column evidence_path text,
	add column evidence_sha256 text,
	add column shared_product_revision_id uuid
		references public.shared_product_revisions(id) on delete set null;

alter table public.food_compatibility_feedback
	alter column warning_id drop not null,
	alter column issue_code drop not null,
	drop constraint food_compatibility_feedback_report_reason_check,
	add constraint food_compatibility_feedback_type_check check (
		feedback_type in ('incorrect_warning', 'missing_warning')
	),
	add constraint food_compatibility_feedback_preference_type_check check (
		preference_type is null
		or preference_type in ('allergen', 'dietary_restriction')
	),
	add constraint food_compatibility_feedback_preference_value_check check (
		preference_value is null
		or (
			btrim(preference_value) <> ''
			and char_length(preference_value) <= 160
		)
	),
	add constraint food_compatibility_feedback_evidence_path_check check (
		evidence_path is null
		or (
			char_length(evidence_path) <= 500
			and split_part(evidence_path, '/', 1) = reported_by::text
		)
	),
	add constraint food_compatibility_feedback_evidence_sha256_check check (
		evidence_sha256 is null
		or evidence_sha256 ~ '^[a-f0-9]{64}$'
	),
	add constraint food_compatibility_feedback_report_reason_check check (
		report_reason in (
			'incorrect_match',
			'outdated_source_data',
			'wrong_evidence_type',
			'missing_warning',
			'other'
		)
	),
	add constraint food_compatibility_feedback_payload_check check (
		(
			feedback_type = 'incorrect_warning'
			and warning_id is not null
			and btrim(warning_id) <> ''
			and issue_code is not null
			and preference_type is null
			and preference_value is null
			and preference_tag_id is null
			and observed_label_date is null
			and evidence_path is null
			and evidence_sha256 is null
		)
		or (
			feedback_type = 'missing_warning'
			and warning_id is null
			and issue_code is null
			and preference_type is not null
			and preference_value is not null
			and preference_tag_id is not null
			and report_reason = 'missing_warning'
			and (
				(evidence_path is null and evidence_sha256 is null)
				or (evidence_path is not null and evidence_sha256 is not null)
			)
		)
	);

create index food_compatibility_feedback_type_queue_idx
	on public.food_compatibility_feedback (feedback_type, status, created_at);

create index food_compatibility_feedback_preference_idx
	on public.food_compatibility_feedback (
		preference_tag_id,
		status,
		created_at
	)
	where preference_tag_id is not null;

create index food_compatibility_feedback_revision_idx
	on public.food_compatibility_feedback (shared_product_revision_id)
	where shared_product_revision_id is not null;

comment on table public.food_compatibility_feedback is
	'Private user reports of incorrect or missing food-compatibility warnings. Reports retain the active policy, exact product identity, current catalog revision when available, and private evidence for privileged moderation review; they never mutate canonical product or policy data directly.';

comment on column public.food_compatibility_feedback.evidence_path is
	'Private product-submission-evidence storage path. Public catalog and API reads must not expose this value.';

comment on column public.food_compatibility_feedback.shared_product_revision_id is
	'Catalog revision current when the report was submitted, preserved for later comparison with label and source history.';
