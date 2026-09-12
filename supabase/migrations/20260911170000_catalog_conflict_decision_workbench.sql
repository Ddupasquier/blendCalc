create table public.catalog_conflict_review_dispositions (
	id uuid primary key default gen_random_uuid(),
	conflict_id uuid not null
		references public.shared_product_conflicts(id) on delete cascade,
	shared_product_id uuid not null
		references public.shared_products(id) on delete cascade,
	evidence_fingerprint text not null check (evidence_fingerprint ~ '^[a-f0-9]{32}$'),
	outcome text not null check (outcome = 'insufficient_evidence'),
	review_note text not null check (char_length(review_note) between 20 and 2000),
	reviewed_by uuid references auth.users(id) on delete set null,
	reviewed_at timestamptz not null default now(),
	unique (conflict_id, evidence_fingerprint)
);

create index catalog_conflict_review_dispositions_product_idx
	on public.catalog_conflict_review_dispositions (
		shared_product_id,
		reviewed_at desc
	);

alter table public.catalog_conflict_review_dispositions enable row level security;
alter table public.catalog_conflict_review_dispositions force row level security;

revoke all on table public.catalog_conflict_review_dispositions
	from public, anon, authenticated, service_role;
grant select, insert on table public.catalog_conflict_review_dispositions
	to service_role;

create function private.catalog_conflict_evidence_fingerprint(
	p_conflict_id uuid
)
returns text
language sql
stable
set search_path = ''
as $$
	select md5(concat_ws(
		':',
		conflict.id::text,
		conflict.shared_product_id::text,
		conflict.field_path,
		conflict.observed_values::text,
		conflict.severity
	))
	from public.shared_product_conflicts conflict
	where conflict.id = p_conflict_id;
$$;

revoke all on function private.catalog_conflict_evidence_fingerprint(uuid)
	from public, anon, authenticated;
grant execute on function private.catalog_conflict_evidence_fingerprint(uuid)
	to service_role;

create view public.catalog_actionable_product_conflicts
with (security_invoker = true)
as
select conflict.*
from public.shared_product_conflicts conflict
where conflict.status = 'open'
	and not exists (
		select 1
		from public.catalog_provider_change_reviews provider_review
		where provider_review.shared_product_id = conflict.shared_product_id
			and provider_review.status = 'pending'
			and exists (
				select 1
				from jsonb_array_elements(conflict.observed_values) evidence
				where evidence ->> 'snapshotId' = provider_review.snapshot_id::text
			)
	)
	and not exists (
		select 1
		from public.catalog_conflict_review_dispositions disposition
		where disposition.conflict_id = conflict.id
			and disposition.evidence_fingerprint =
				private.catalog_conflict_evidence_fingerprint(conflict.id)
	)
	and not exists (
		select 1
		from public.catalog_correction_origins origin
		where origin.shared_product_conflict_id = conflict.id
			and origin.status = 'linked'
	);

revoke all on table public.catalog_actionable_product_conflicts
	from public, anon, authenticated, service_role;
grant select on table public.catalog_actionable_product_conflicts
	to service_role;

create view public.catalog_actionable_provider_change_reviews
with (security_invoker = true)
as
select review.*
from public.catalog_provider_change_reviews review
where review.status = 'pending'
	and not exists (
		select 1
		from public.catalog_correction_origins origin
		where origin.provider_change_review_id = review.id
			and origin.status in ('waiting_for_correction', 'linked')
	);

revoke all on table public.catalog_actionable_provider_change_reviews
	from public, anon, authenticated, service_role;
grant select on table public.catalog_actionable_provider_change_reviews
	to service_role;

create or replace function public.get_catalog_review_work_summary(
	p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
	v_monitor jsonb;
begin
	if not public.authorize_app_permission('moderation.catalog.review') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog-review access is required.';
	end if;

	v_monitor := private.build_catalog_monitor_summary(v_limit);

	return jsonb_build_object(
		'conflicts', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', conflict.id,
				'productId', conflict.shared_product_id,
				'barcode', conflict.barcode,
				'productName', product.product_name,
				'fieldPath', conflict.field_path,
				'observedValues', conflict.observed_values,
				'severity', conflict.severity,
				'createdAt', conflict.created_at
			) order by conflict.created_at, conflict.id)
			from (
				select *
				from public.catalog_actionable_product_conflicts
				order by created_at, id
				limit v_limit
			) conflict
			join public.shared_products product on product.id = conflict.shared_product_id
		), '[]'::jsonb),
		'providerChanges', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', review.id,
				'sharedProductId', review.shared_product_id,
				'barcode', product.barcode,
				'productName', product.product_name,
				'sourceName', source.display_name,
				'changeSummary', review.change_summary,
				'materialFieldPaths', review.material_field_paths,
				'observedAt', snapshot.observed_at,
				'createdAt', review.created_at,
				'correctionStatus', origin.status,
				'submissionId', origin.submission_id
			) order by review.created_at, review.id)
			from (
				select *
				from public.catalog_actionable_provider_change_reviews
				order by created_at, id
				limit v_limit
			) review
			join public.shared_products product on product.id = review.shared_product_id
			join public.product_data_sources source on source.key = review.provider_key
			join public.catalog_provider_product_snapshots snapshot on snapshot.id = review.snapshot_id
			left join public.catalog_correction_origins origin
				on origin.provider_change_review_id = review.id
				and origin.status in ('waiting_for_correction', 'linked')
		), '[]'::jsonb),
		'safetyMatches', coalesce(v_monitor -> 'safetyMatches', '[]'::jsonb),
		'counts', jsonb_build_object(
			'conflicts', (
				select count(*) from public.catalog_actionable_product_conflicts
			),
			'providerChanges', (
				select count(*) from public.catalog_actionable_provider_change_reviews
			),
			'safetyMatches', coalesce(v_monitor #>> '{queue,pendingSafetyMatches}', '0')::integer
		),
		'issueLimit', v_limit
	);
end;
$$;

create function public.get_catalog_product_api_withholding_reasons(
	p_shared_product_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_reasons text[];
begin
	if not (
		public.authorize_app_permission('moderation.catalog.review')
		or public.authorize_app_permission('data_operations.catalog_health.read')
	) then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog access is required.';
	end if;
	if not exists (
		select 1
		from public.catalog_product_readiness readiness
		where readiness.shared_product_id = p_shared_product_id
	) then
		raise exception using
			errcode = 'P0002',
			message = 'Catalog product was not found.';
	end if;

	select coalesce(array_agg(
		case reason
			when 'insufficient_allergen_evidence' then 'Allergen evidence is incomplete.'
			when 'missing_normalized_nutrients' then 'No normalized nutrient records are available.'
			when 'unsupported_nutrient_value_state' then 'A nutrient has an unsupported value state.'
			when 'unreviewed_nutrient_mapping' then 'A nutrient identity still needs review.'
			when 'derived_nutrient_missing_method' then 'A derived nutrient is missing its calculation method.'
			when 'nutrient_source_not_redistributable' then 'A selected nutrient source cannot be redistributed through blendCalcAPI v1.'
			when 'missing_nutrient_provenance' then 'A nutrient is missing selected source evidence.'
			when 'missing_evidence_backed_primary_serving' then 'The product is missing an evidence-backed primary serving.'
			when 'serving_source_not_redistributable' then 'The selected serving source cannot be redistributed through blendCalcAPI v1.'
			when 'missing_serving_provenance' then 'The primary serving is missing selected source evidence.'
			when 'unresolved_material_conflict' then 'One or more stored fields have conflicting source values.'
			else case
				when reason like 'missing_required_nutrient:%' then
					'A required nutrient is missing: ' || coalesce((
						select definition.nutrient_name
						from public.nutrient_definitions definition
						where definition.nutrient_id = split_part(reason, ':', 2)::bigint
					), 'nutrient ' || split_part(reason, ':', 2)) || '.'
				else initcap(replace(reason, '_', ' ')) || '.'
			end
		end
		order by reason
	) filter (where reason is not null), '{}'::text[])
	into v_reasons
	from public.catalog_product_readiness readiness
	left join lateral unnest(readiness.api_v1_withholding_reasons) reason on true
	where readiness.shared_product_id = p_shared_product_id;
	return v_reasons;
end;
$$;

create function public.finish_catalog_conflict_review(
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
		or jsonb_array_length(p_decisions) not between 1 and 50 then
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

revoke all on function public.get_catalog_product_api_withholding_reasons(uuid)
	from public, anon, authenticated, service_role;
grant execute on function public.get_catalog_product_api_withholding_reasons(uuid)
	to authenticated;

revoke all on function public.finish_catalog_conflict_review(uuid, jsonb)
	from public, anon, authenticated, service_role;
grant execute on function public.finish_catalog_conflict_review(uuid, jsonb)
	to authenticated;

comment on table public.catalog_conflict_review_dispositions is
	'Private terminal catalog-review outcomes for one unchanged conflict evidence snapshot. New material evidence produces a new fingerprint and reopens work.';
comment on view public.catalog_actionable_product_conflicts is
	'Open catalog conflicts excluding exact insufficient-evidence snapshots and conflicts already owned by a provider review or linked correction.';
comment on view public.catalog_actionable_provider_change_reviews is
	'Pending provider changes that still require a separate decision and are not already owned by a correction workflow.';
comment on function public.get_catalog_product_api_withholding_reasons(uuid) is
	'Returns exact current blendCalcAPI withholding reasons to an MFA-verified catalog or data-operations reviewer.';
comment on function public.finish_catalog_conflict_review(uuid, jsonb) is
	'Atomically records one field-specific outcome for every actionable conflict, creating one evidence-backed correction submission for all replacements.';
