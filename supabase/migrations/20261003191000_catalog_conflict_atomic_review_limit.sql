-- Preserve the existing all-field transaction; raise only its bounded
-- decision count to match progressive discovery. Existing callers remain compatible.
create or replace function public.finish_catalog_conflict_review(
	p_shared_product_id uuid,
	p_decisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_product public.shared_products%rowtype;
	v_revision public.shared_product_revisions%rowtype;
	v_expected_ids uuid[] := '{}'::uuid[];
	v_decision_ids uuid[] := '{}'::uuid[];
	v_decision jsonb;
	v_conflict public.shared_product_conflicts%rowtype;
	v_outcome text;
	v_note text;
	v_nutrient_id bigint;
	v_nutrient jsonb;
	v_observation jsonb;
	v_observation_index integer;
	v_replacement_value numeric;
	v_current_value numeric;
	v_unit text;
	v_source text;
	v_source_reference text;
	v_evidence_reference text;
	v_food jsonb;
	v_changes jsonb := '[]'::jsonb;
	v_decision_audit jsonb := '[]'::jsonb;
	v_submission_id uuid;
	v_keep_count integer := 0;
	v_replace_count integer := 0;
	v_insufficient_count integer := 0;
begin
	if not public.authorize_app_permission('moderation.catalog.review') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog-review access is required.';
	end if;
	if jsonb_typeof(p_decisions) <> 'array'
		or jsonb_array_length(p_decisions) not between 1 and 200 then
		raise exception using
			errcode = '22023',
			message = 'Choose one outcome for every current catalog conflict.';
	end if;

	perform pg_advisory_xact_lock(hashtextextended(
		'catalog-conflict-review:' || p_shared_product_id::text,
		0
	));

	select *
	into v_product
	from public.shared_products product
	where product.id = p_shared_product_id
		and product.status = 'active'
	for update;
	if not found then
		raise exception using
			errcode = 'P0002',
			message = 'Catalog product was not found.';
	end if;

	select *
	into v_revision
	from public.shared_product_revisions revision
	where revision.shared_product_id = p_shared_product_id
	order by revision.revision_number desc
	limit 1;
	if v_revision.id is null then
		raise exception 'A current catalog revision is required.';
	end if;

	select coalesce(array_agg(conflict.id order by conflict.id), '{}'::uuid[])
	into v_expected_ids
	from public.catalog_actionable_product_conflicts conflict
	where conflict.shared_product_id = p_shared_product_id;

	select coalesce(array_agg((decision ->> 'conflictId')::uuid order by (decision ->> 'conflictId')::uuid), '{}'::uuid[])
	into v_decision_ids
	from jsonb_array_elements(p_decisions) decision;

	if cardinality(v_expected_ids) = 0 or v_decision_ids <> v_expected_ids then
		raise exception using
			errcode = '40001',
			message = 'The catalog conflicts changed. Refresh before finishing this review.';
	end if;
	if cardinality(v_decision_ids) <> (
		select count(distinct decision ->> 'conflictId')
		from jsonb_array_elements(p_decisions) decision
	) then
		raise exception using
			errcode = '22023',
			message = 'Each catalog conflict can be decided only once.';
	end if;

	v_food := v_product.food;
	for v_decision in select value from jsonb_array_elements(p_decisions)
	loop
		select *
		into v_conflict
		from public.shared_product_conflicts conflict
		where conflict.id = (v_decision ->> 'conflictId')::uuid
			and conflict.shared_product_id = p_shared_product_id
			and conflict.status = 'open'
		for update;

		v_outcome := v_decision ->> 'outcome';
		v_note := btrim(coalesce(v_decision ->> 'note', ''));
		if char_length(v_note) not between 20 and 2000 then
			raise exception using
				errcode = '22023',
				message = 'Every decision needs a field-specific explanation between 20 and 2000 characters.';
		end if;
		if v_outcome not in (
			'keep_current',
			'use_observation',
			'use_other',
			'insufficient_evidence'
		) then
			raise exception using
				errcode = '22023',
				message = 'A catalog conflict outcome is invalid.';
		end if;

		if v_outcome = 'keep_current' then
			update public.shared_product_conflicts
			set status = 'resolved',
				resolution_note = v_note,
				resolved_by = (select auth.uid()),
				resolved_at = now()
			where id = v_conflict.id;
			update public.catalog_correction_origins
			set status = 'dismissed',
				resolved_at = now(),
				resolution_note = v_note
			where shared_product_conflict_id = v_conflict.id
				and status = 'waiting_for_correction';
			v_keep_count := v_keep_count + 1;
		elsif v_outcome = 'insufficient_evidence' then
			insert into public.catalog_conflict_review_dispositions (
				conflict_id,
				shared_product_id,
				evidence_fingerprint,
				outcome,
				review_note,
				reviewed_by
			)
			values (
				v_conflict.id,
				p_shared_product_id,
				private.catalog_conflict_evidence_fingerprint(v_conflict.id),
				'insufficient_evidence',
				v_note,
				(select auth.uid())
			)
			on conflict (conflict_id, evidence_fingerprint) do nothing;
			v_insufficient_count := v_insufficient_count + 1;
		else
			if v_conflict.field_path !~ '^nutrient:[0-9]+$' then
				raise exception 'In-place replacement currently supports nutrient conflicts only.';
			end if;
			v_nutrient_id := split_part(v_conflict.field_path, ':', 2)::bigint;
			select nutrient
			into v_nutrient
			from jsonb_array_elements(v_food -> 'foodNutrients') nutrient
			where (nutrient ->> 'nutrientId')::bigint = v_nutrient_id;
			if v_nutrient is null or jsonb_typeof(v_nutrient -> 'value') <> 'number' then
				raise exception 'The stored nutrient value is unavailable.';
			end if;
			v_current_value := (v_nutrient ->> 'value')::numeric;
			v_unit := upper(v_nutrient ->> 'unitName');

			if v_outcome = 'use_observation' then
				v_observation_index := (v_decision ->> 'observationIndex')::integer;
				v_observation := v_conflict.observed_values -> v_observation_index;
				if v_observation is null
					or jsonb_typeof(v_observation) <> 'object'
					or jsonb_typeof(v_observation -> 'value') <> 'number'
					or upper(coalesce(v_observation ->> 'unitName', '')) <> v_unit
					or lower(coalesce(v_observation ->> 'basis', '')) <> 'per 100 g' then
					raise exception using
						errcode = '22023',
						message = 'The selected observation is not an exact compatible per-100-g value.';
				end if;
				v_replacement_value := (v_observation ->> 'value')::numeric;
				v_source := v_observation ->> 'source';
				v_source_reference := nullif(v_observation ->> 'sourceReference', '');
				if v_source is null or not exists (
					select 1
					from public.product_data_sources source
					where source.key = v_source
						and source.api_redistribution_allowed
				) then
					raise exception using
						errcode = '22023',
						message = 'The selected provider value cannot be redistributed through blendCalcAPI v1.';
				end if;
				v_evidence_reference := concat_ws(':', v_source, v_source_reference);
			else
				v_replacement_value := (v_decision ->> 'replacementValue')::numeric;
				v_evidence_reference := btrim(coalesce(v_decision ->> 'evidenceReference', ''));
				if v_replacement_value < 0 or v_replacement_value > 1000000 then
					raise exception 'The replacement nutrient value is outside the supported range.';
				end if;
				if char_length(v_evidence_reference) not between 8 and 500 then
					raise exception using
						errcode = '22023',
						message = 'Enter the exact label, standard, or documentation reference for the replacement value.';
				end if;
				v_source := 'reviewed-evidence';
				v_source_reference := v_evidence_reference;
			end if;

			if v_replacement_value = v_current_value then
				raise exception 'A replacement decision must change the stored value.';
			end if;
			select jsonb_set(
				v_food,
				'{foodNutrients}',
				jsonb_agg(
					case
						when (nutrient ->> 'nutrientId')::bigint = v_nutrient_id
						then jsonb_set(nutrient, '{value}', to_jsonb(v_replacement_value), true)
						else nutrient
					end
					order by ordinality
				),
				true
			)
			into v_food
			from jsonb_array_elements(v_food -> 'foodNutrients') with ordinality as item(nutrient, ordinality);

			v_changes := v_changes || jsonb_build_array(jsonb_build_object(
				'field', v_conflict.field_path,
				'label', coalesce(v_nutrient ->> 'nutrientName', v_conflict.field_path),
				'message', 'A catalog reviewer selected an evidence-backed replacement in the conflict workbench.',
				'severity', v_conflict.severity,
				'changeType', 'changed',
				'previousValue', v_current_value,
				'submittedValue', v_replacement_value,
				'unitName', v_unit,
				'basis', 'per 100 g',
				'evidenceReference', v_evidence_reference,
				'reviewNote', v_note
			));
			v_replace_count := v_replace_count + 1;
		end if;

		v_decision_audit := v_decision_audit || jsonb_build_array(jsonb_build_object(
			'conflictId', v_conflict.id,
			'fieldPath', v_conflict.field_path,
			'outcome', v_outcome,
			'reviewNote', v_note,
			'evidenceFingerprint', private.catalog_conflict_evidence_fingerprint(v_conflict.id)
		));
	end loop;

	if v_replace_count > 0 then
		if exists (
			select 1
			from public.shared_product_submissions submission
			where submission.target_shared_product_id = p_shared_product_id
				and submission.status = 'pending'
				and submission.submission_intent = 'catalog_correction'
		) then
			raise exception 'A catalog correction is already waiting for review.';
		end if;

		insert into public.shared_product_submissions (
			submitted_by,
			barcode,
			product_name,
			brand_owner,
			category_option_id,
			food,
			consent_to_share,
			status,
			verification_status,
			evidence_paths,
			evidence_complete,
			submission_kind,
			target_shared_product_id,
			base_revision_id,
			change_summary,
			submission_intent,
			label_observed_at,
			matched_source,
			matched_reference,
			validation_report
		)
		values (
			(select auth.uid()),
			v_product.barcode,
			v_product.product_name,
			v_product.brand_owner,
			v_product.category_option_id,
			v_food,
			true,
			'pending',
			'manual_review',
			'{}'::jsonb,
			true,
			'product_update',
			p_shared_product_id,
			v_revision.id,
			jsonb_build_object(
				'version', 1,
				'observedAt', now(),
				'baseRevisionNumber', v_revision.revision_number,
				'changes', v_changes,
				'sourceChecks', '[]'::jsonb,
				'conflictWorkbenchDecisions', v_decision_audit
			),
			'catalog_correction',
			current_date,
			null,
			null,
			jsonb_build_object(
				'valid', true,
				'trustDisposition', 'source-aligned',
				'issues', jsonb_build_array(
					'Prepared from existing evidence in the privileged catalog-conflict workbench.'
				),
				'evidenceComplete', true,
				'conflictCount', v_replace_count,
				'existingCatalogMatch', false,
				'existingCatalogAction', 'update_review',
				'sourceAutoPublishEligible', true
			)
		)
		returning id into v_submission_id;
	end if;

	return jsonb_build_object(
		'finished', true,
		'keepCount', v_keep_count,
		'replacementCount', v_replace_count,
		'insufficientEvidenceCount', v_insufficient_count,
		'submissionId', v_submission_id,
		'apiRemainsWithheldPendingApproval', v_replace_count > 0
			or v_insufficient_count > 0
	);
end;
$$;
