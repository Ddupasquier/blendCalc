alter table public.food_compatibility_feedback
	add column decision_method text,
	add column decision_metadata jsonb not null default '{}'::jsonb
		check (jsonb_typeof(decision_metadata) = 'object');

update public.food_compatibility_feedback
set decision_method = 'human',
	decision_metadata = jsonb_build_object(
		'ruleVersion', 1,
		'decidedBy', 'human-review'
	)
where status in ('confirmed', 'dismissed');

alter table public.food_compatibility_feedback
	add constraint food_compatibility_feedback_decision_method_check
		check (
			decision_method is null
			or decision_method in ('human', 'system_exact_evidence')
		);

alter table public.food_compatibility_feedback
	drop constraint food_compatibility_feedback_review_check,
	add constraint food_compatibility_feedback_review_check check (
		(
			status = 'pending'
			and decision_method is null
			and reviewed_by is null
			and reviewed_at is null
		)
		or (
			status in ('confirmed', 'dismissed')
			and decision_method = 'human'
			and reviewed_by is not null
			and reviewed_at is not null
		)
		or (
			status = 'dismissed'
			and decision_method = 'system_exact_evidence'
			and reviewed_by is null
			and reviewed_at is not null
		)
	);

create or replace function public.prepare_food_compatibility_feedback_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	if old.status <> 'pending' and (
		new.status,
		new.resolution_action,
		new.reviewed_by,
		new.reviewed_at,
		new.review_note,
		new.decision_method,
		new.decision_metadata
	) is distinct from (
		old.status,
		old.resolution_action,
		old.reviewed_by,
		old.reviewed_at,
		old.review_note,
		old.decision_method,
		old.decision_metadata
	) then
		raise exception 'Food-warning decisions are immutable';
	end if;

	if old.status = 'pending'
		and new.status in ('confirmed', 'dismissed')
		and new.decision_method is null then
		if new.reviewed_by is null then
			raise exception 'Resolved food-warning reports require a decision method';
		end if;
		new.decision_method := 'human';
		new.decision_metadata := jsonb_build_object(
			'ruleVersion', 1,
			'decidedBy', 'human-review',
			'policyVersionId', new.policy_version_id,
			'productRevisionId', new.shared_product_revision_id
		);
	end if;

	return new;
end;
$$;

drop trigger if exists prepare_food_compatibility_feedback_decision
	on public.food_compatibility_feedback;
create trigger prepare_food_compatibility_feedback_decision
	before update on public.food_compatibility_feedback
	for each row execute function public.prepare_food_compatibility_feedback_decision();

create or replace function public.apply_deterministic_food_warning_decision(
	p_feedback_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_feedback public.food_compatibility_feedback%rowtype;
	v_current_revision_id uuid;
	v_active_policy_id uuid;
	v_fact jsonb;
	v_fact_label text;
	v_matching_fact_id uuid;
	v_matching_tag_id uuid;
	v_supports_warning boolean := false;
	v_matched_facts jsonb := '[]'::jsonb;
begin
	select feedback.*
	into v_feedback
	from public.food_compatibility_feedback feedback
	where feedback.id = p_feedback_id
		and feedback.status = 'pending'
	for update;

	if not found
		or v_feedback.feedback_type <> 'incorrect_warning'
		or v_feedback.report_reason <> 'incorrect_match'
		or v_feedback.shared_product_id is null
		or v_feedback.shared_product_revision_id is null
		or v_feedback.evidence_path is not null
		or v_feedback.evidence_sha256 is not null
		or v_feedback.issue_code not in (
			'FOOD_INTRINSIC_ALLERGEN',
			'FOOD_ALLERGEN_CONTAINS',
			'FOOD_ALLERGEN_MAY_CONTAIN',
			'FOOD_INGREDIENT_PRESENT',
			'FOOD_RESTRICTION_CONFLICT'
		)
		or jsonb_typeof(v_feedback.fact_snapshot -> 'facts') <> 'array'
		or jsonb_array_length(v_feedback.fact_snapshot -> 'facts') = 0 then
		return false;
	end if;

	select policy.id
	into v_active_policy_id
	from public.food_compatibility_policy_versions policy
	where policy.status = 'active'
	order by policy.version_number desc
	limit 1;

	if v_active_policy_id is distinct from v_feedback.policy_version_id then
		return false;
	end if;

	select revision.id
	into v_current_revision_id
	from public.shared_product_revisions revision
	where revision.shared_product_id = v_feedback.shared_product_id
	order by revision.revision_number desc
	limit 1;

	if v_current_revision_id is distinct from v_feedback.shared_product_revision_id then
		return false;
	end if;

	v_fact_label := public.compatibility_normalize_text(
		v_feedback.issue_params ->> 'factLabel'
	);
	if v_fact_label = '' then
		return false;
	end if;

	for v_fact in
		select snapshot.value
		from jsonb_array_elements(v_feedback.fact_snapshot -> 'facts') snapshot(value)
	loop
		if jsonb_typeof(v_fact) <> 'object'
			or coalesce(v_fact ->> 'confidence', '') <> 'confirmed'
			or public.compatibility_normalize_text(v_fact ->> 'slug') = ''
			or coalesce(v_fact ->> 'factType', '') = ''
			or coalesce(v_fact ->> 'sourceType', '') = '' then
			return false;
		end if;

		select fact.id, fact.tag_id
		into v_matching_fact_id, v_matching_tag_id
		from public.product_compatibility_facts fact
		join public.compatibility_tags tag on tag.id = fact.tag_id
		where fact.shared_product_id = v_feedback.shared_product_id
			and fact.policy_version_id = v_feedback.policy_version_id
			and fact.confidence = 'confirmed'
			and fact.fact_type = v_fact ->> 'factType'
			and fact.source_type = v_fact ->> 'sourceType'
			and public.compatibility_normalize_text(tag.slug) =
				public.compatibility_normalize_text(v_fact ->> 'slug')
			and public.compatibility_normalize_text(fact.source_text) =
				public.compatibility_normalize_text(v_fact ->> 'sourceText')
		order by fact.id
		limit 1;

		if v_matching_fact_id is null then
			return false;
		end if;

		v_matched_facts := v_matched_facts || jsonb_build_array(
			jsonb_build_object(
				'factId', v_matching_fact_id,
				'tagId', v_matching_tag_id,
				'slug', v_fact ->> 'slug',
				'factType', v_fact ->> 'factType',
				'sourceType', v_fact ->> 'sourceType',
				'sourceText', v_fact ->> 'sourceText'
			)
		);

		if v_fact_label in (
			public.compatibility_normalize_text(v_fact ->> 'slug'),
			public.compatibility_normalize_text(v_fact ->> 'label'),
			public.compatibility_normalize_text(v_fact ->> 'sourceText')
		) then
			v_supports_warning := v_supports_warning or case v_feedback.issue_code
				when 'FOOD_INTRINSIC_ALLERGEN' then
					v_fact ->> 'factType' = 'contains'
					and v_fact ->> 'sourceType' = 'food_identity_taxonomy'
				when 'FOOD_ALLERGEN_CONTAINS' then
					v_fact ->> 'factType' = 'contains'
					and v_fact ->> 'sourceType' <> 'food_identity_taxonomy'
				when 'FOOD_ALLERGEN_MAY_CONTAIN' then
					v_fact ->> 'factType' = 'may_contain'
				when 'FOOD_INGREDIENT_PRESENT' then
					v_fact ->> 'factType' = 'ingredient_present'
				when 'FOOD_RESTRICTION_CONFLICT' then
					exists (
						select 1
						from public.food_compatibility_policy_conflicts conflict
						join public.compatibility_tags preference
							on preference.id = conflict.preference_tag_id
						where conflict.policy_version_id = v_feedback.policy_version_id
							and conflict.fact_tag_id = v_matching_tag_id
							and conflict.warning_code = 'FOOD_RESTRICTION_CONFLICT'
							and public.compatibility_normalize_text(
								v_feedback.issue_params ->> 'restrictionLabel'
							) in (
								public.compatibility_normalize_text(preference.slug),
								public.compatibility_normalize_text(preference.label)
							)
					)
				else false
			end;
		end if;
	end loop;

	if not v_supports_warning then
		return false;
	end if;

	update public.food_compatibility_feedback
	set status = 'dismissed',
		resolution_action = 'none',
		follow_up_status = 'not_required',
		reviewed_by = null,
		reviewed_at = now(),
		review_note = 'Automatically dismissed because every captured warning fact still matches confirmed evidence on the unchanged catalog revision and active policy.',
		decision_method = 'system_exact_evidence',
		decision_metadata = jsonb_build_object(
			'ruleVersion', 1,
			'decidedBy', 'system-exact-evidence',
			'decisionCode', 'CURRENT_WARNING_EXACTLY_SUPPORTED',
			'policyVersionId', v_feedback.policy_version_id,
			'productRevisionId', v_feedback.shared_product_revision_id,
			'matchedFacts', v_matched_facts
		)
	where id = v_feedback.id;

	return true;
end;
$$;

create or replace function public.evaluate_new_food_warning_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	perform public.apply_deterministic_food_warning_decision(new.id);
	return null;
end;
$$;

drop trigger if exists evaluate_new_food_warning_feedback
	on public.food_compatibility_feedback;
create trigger evaluate_new_food_warning_feedback
	after insert on public.food_compatibility_feedback
	for each row execute function public.evaluate_new_food_warning_feedback();

-- Older incorrect-warning reports did not retain their current revision. Backfill the
-- revision only when today's current revision already existed at report submission;
-- any product changed since the report remains manual.
with current_revisions as (
	select distinct on (revision.shared_product_id)
		revision.shared_product_id,
		revision.id,
		revision.created_at
	from public.shared_product_revisions revision
	order by revision.shared_product_id, revision.revision_number desc
)
update public.food_compatibility_feedback feedback
set shared_product_revision_id = current_revision.id
from current_revisions current_revision
where feedback.status = 'pending'
	and feedback.feedback_type = 'incorrect_warning'
	and feedback.shared_product_id is not null
	and feedback.shared_product_revision_id is null
	and current_revision.shared_product_id = feedback.shared_product_id
	and current_revision.created_at <= feedback.created_at;

select public.apply_deterministic_food_warning_decision(feedback.id)
from public.food_compatibility_feedback feedback
where feedback.status = 'pending'
	and feedback.feedback_type = 'incorrect_warning';

revoke all on function public.prepare_food_compatibility_feedback_decision()
	from public, anon, authenticated, service_role;
revoke all on function public.apply_deterministic_food_warning_decision(uuid)
	from public, anon, authenticated, service_role;
revoke all on function public.evaluate_new_food_warning_feedback()
	from public, anon, authenticated, service_role;

comment on column public.food_compatibility_feedback.decision_method is
	'Immutable ownership of a completed warning-report decision: human review or the conservative exact-evidence system rule.';

comment on column public.food_compatibility_feedback.decision_metadata is
	'Private immutable audit receipt for the decision rule, policy, product revision, and exact canonical facts used.';

comment on function public.apply_deterministic_food_warning_decision(uuid) is
	'Conservatively dismisses only incorrect-match reports whose captured confirmed facts exactly match the unchanged current product revision and active warning policy.';
