alter function public.run_catalog_health_repair(text, boolean, uuid)
	rename to run_catalog_provenance_health_repair;

alter function public.run_catalog_provenance_health_repair(text, boolean, uuid)
	set schema private;

revoke all on function private.run_catalog_provenance_health_repair(text, boolean, uuid)
	from public, anon, authenticated, service_role;

update public.app_issue_codes
set
	resolution_action = 'run_revision_repair',
	automated_repair_key = 'create_revision_from_existing_evidence',
	automated_repair_allowed = true
where code = 'CATALOG_REVISION_MISSING';

update public.app_issue_codes
set
	resolution_action = 'run_revision_repair',
	automated_repair_key = 'restore_revision_changes_from_summary',
	automated_repair_allowed = true
where code = 'CATALOG_REVISION_EXPLANATION_MISSING';

create or replace view public.catalog_health_issue_occurrences
with (security_invoker = true)
as
select
	'api-publication:' || readiness.shared_product_id::text || ':' || md5(reason.value)
		as occurrence_key,
	public.catalog_health_issue_code_for_reason(reason.value) as issue_code,
	'shared_product'::text as subject_type,
	readiness.shared_product_id::text as subject_key,
	readiness.shared_product_id,
	'api_publication'::text as source_scope,
	'open'::text as status,
	reason.value as source_reason,
	case
		when strpos(reason.value, ':') > 0 then jsonb_build_object(
			'key', split_part(reason.value, ':', 2)
		)
		else '{}'::jsonb
	end as parameters,
	readiness.updated_at as detected_at
from public.catalog_product_readiness readiness
cross join lateral unnest(readiness.api_v1_withholding_reasons) reason(value)
where reason.value <> 'unresolved_material_conflict'
union all
select
	'catalog-conflict:' || conflict.id::text,
	'CATALOG_MATERIAL_CONFLICT',
	'shared_product',
	conflict.shared_product_id::text,
	conflict.shared_product_id,
	'catalog_conflict',
	'open',
	conflict.field_path,
	jsonb_build_object(
		'conflictId', conflict.id,
		'fieldPath', conflict.field_path,
		'severity', conflict.severity
	),
	conflict.created_at
from public.shared_product_conflicts conflict
where conflict.status = 'open'
	and conflict.severity in ('medium', 'high')
union all
select
	'revision-explanation:' || revision.id::text,
	'CATALOG_REVISION_EXPLANATION_MISSING',
	'shared_product',
	revision.shared_product_id::text,
	revision.shared_product_id,
	'catalog_revision',
	'open',
	'structured_change_rows_missing',
	jsonb_build_object(
		'revisionId', revision.id,
		'revisionNumber', revision.revision_number
	),
	revision.created_at
from public.shared_product_revisions revision
join public.shared_products product
	on product.id = revision.shared_product_id
where product.status = 'active'
	and revision.revision_number > 1
	and not exists (
		select 1
		from public.shared_product_revision_changes revision_change
		where revision_change.revision_id = revision.id
	)
union all
select
	'nutrient-mapping:' || mapping.id::text,
	'NUTRIENT_MAPPING_GAP',
	'nutrient_mapping',
	mapping.id::text,
	null::uuid,
	'nutrient_mapping',
	'open',
	mapping.review_status,
	jsonb_build_object(
		'mappingId', mapping.id,
		'sourceKey', mapping.source_key,
		'sourceNutrientKey', mapping.source_nutrient_key,
		'sourceNutrientName', mapping.source_nutrient_name,
		'sourceUnitName', mapping.source_unit_name
	),
	coalesce(mapping.reviewed_at, mapping.created_at)
from public.nutrient_source_mappings mapping
where mapping.review_status = 'pending_review'
union all
select
	'source-policy:' || source.key,
	'SOURCE_POLICY_REVIEW_REQUIRED',
	'product_data_source',
	source.key,
	null::uuid,
	'source_policy',
	'open',
	'policy_review_missing',
	jsonb_build_object('sourceKey', source.key, 'displayName', source.display_name),
	coalesce(source.canonical_policy_reviewed_at, source.updated_at)
from public.product_data_sources source
where source.enabled
	and (source.canonical_storage_allowed or source.api_redistribution_allowed)
	and source.canonical_policy_reviewed_at is null
union all
select
	'source-license:' || source.key,
	'SOURCE_LICENSE_METADATA_MISSING',
	'product_data_source',
	source.key,
	null::uuid,
	'source_policy',
	'open',
	'license_metadata_missing',
	jsonb_build_object('sourceKey', source.key, 'displayName', source.display_name),
	source.updated_at
from public.product_data_sources source
where source.enabled
	and (source.canonical_storage_allowed or source.api_redistribution_allowed)
	and (
		nullif(btrim(source.canonical_license_name), '') is null
		or nullif(btrim(source.canonical_policy_notes), '') is null
		or nullif(btrim(source.attribution_text), '') is null
	)
union all
select
	'dataset-license:' || dataset.key,
	'DATASET_LICENSE_REVIEW_REQUIRED',
	'generic_food_dataset',
	dataset.key,
	null::uuid,
	'dataset_policy',
	'open',
	'license_review_required',
	jsonb_build_object('datasetKey', dataset.key, 'displayName', dataset.display_name),
	coalesce(dataset.imported_at, dataset.updated_at)
from public.generic_food_datasets dataset
where (dataset.active or dataset.import_enabled)
	and dataset.license_review_status <> 'approved'
union all
select
	'dataset-import:' || dataset.key,
	'DATASET_IMPORT_EVIDENCE_MISSING',
	'generic_food_dataset',
	dataset.key,
	null::uuid,
	'dataset_import',
	'open',
	'import_evidence_missing',
	jsonb_build_object('datasetKey', dataset.key, 'displayName', dataset.display_name),
	coalesce(dataset.imported_at, dataset.updated_at)
from public.generic_food_datasets dataset
where dataset.import_enabled
	and (dataset.imported_at is null or dataset.source_file_sha256 is null)
union all
select
	'warning-policy:' || coverage.slug,
	'WARNING_POLICY_COVERAGE_GAP',
	'food_preference',
	coverage.slug,
	null::uuid,
	'food_policy',
	'open',
	'coverage_incomplete',
	jsonb_build_object(
		'preferenceKey', coverage.slug,
		'conflictCount', coalesce(coverage.conflict_count, 0),
		'evidenceRuleCount', coalesce(coverage.evidence_rule_count, 0)
	),
	now()
from public.food_compatibility_policy_coverage coverage
where coverage.selectable
	and (
		coalesce(coverage.conflict_count, 0) = 0
		or coalesce(coverage.evidence_rule_count, 0) = 0
	);

create or replace function private.run_catalog_revision_history_repair(
	p_occurrence_key text,
	p_apply boolean default false,
	p_dry_run_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_occurrence record;
	v_issue public.app_issue_codes%rowtype;
	v_product public.shared_products%rowtype;
	v_revision public.shared_product_revisions%rowtype;
	v_submission public.shared_product_submissions%rowtype;
	v_observation public.shared_product_observations%rowtype;
	v_run_id uuid;
	v_mode text := case when p_apply then 'apply' else 'dry_run' end;
	v_candidate_count integer := 0;
	v_changed_count integer := 0;
	v_skipped_count integer := 0;
	v_unresolved_count integer := 0;
	v_error_count integer := 0;
	v_run_status text;
	v_evidence_kind text;
	v_evidence_id uuid;
	v_label_observed_at timestamptz;
	v_change_count integer := 0;
	v_inserted_count integer := 0;
begin
	if not public.authorize_app_permission('data_operations.catalog_health.repair') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog repair access is required.';
	end if;

	select occurrence.*
	into v_occurrence
	from public.catalog_health_issue_occurrences occurrence
	where occurrence.occurrence_key = p_occurrence_key
		and occurrence.status = 'open'
		and occurrence.issue_code in (
			'CATALOG_REVISION_MISSING',
			'CATALOG_REVISION_EXPLANATION_MISSING'
		);
	if not found then
		raise exception using
			errcode = 'P0002',
			message = 'The revision history issue is no longer open.';
	end if;

	select issue.*
	into v_issue
	from public.app_issue_codes issue
	where issue.code = v_occurrence.issue_code
		and issue.enabled
		and issue.automated_repair_allowed;
	if not found then
		raise exception 'This revision issue does not support an evidence-only repair';
	end if;

	if p_apply then
		if p_dry_run_id is null or not exists (
			select 1
			from public.catalog_health_repair_runs dry_run
			where dry_run.id = p_dry_run_id
				and dry_run.requested_by = (select auth.uid())
				and dry_run.occurrence_key = p_occurrence_key
				and dry_run.repair_key = v_issue.automated_repair_key
				and dry_run.mode = 'dry_run'
				and dry_run.status in ('completed', 'completed_with_unresolved')
				and dry_run.candidate_count > 0
				and dry_run.started_at >= now() - interval '1 hour'
		) then
			raise exception 'A current successful dry run is required before applying this repair';
		end if;
	elsif p_dry_run_id is not null then
		raise exception 'A dry run cannot reference another dry run';
	end if;

	insert into public.catalog_health_repair_runs (
		requested_by,
		occurrence_key,
		issue_code,
		repair_key,
		mode,
		dry_run_id
	)
	values (
		(select auth.uid()),
		p_occurrence_key,
		v_occurrence.issue_code,
		v_issue.automated_repair_key,
		v_mode,
		p_dry_run_id
	)
	returning id into v_run_id;

	begin
		select product.*
		into v_product
		from public.shared_products product
		where product.id = v_occurrence.shared_product_id
		for update;

		if not found then
			insert into public.catalog_health_repair_run_items (
				run_id, item_key, result, reason_code
			)
			values (
				v_run_id, v_occurrence.subject_key, 'unresolved', 'product_required'
			);
			v_unresolved_count := 1;
		elsif v_occurrence.issue_code = 'CATALOG_REVISION_MISSING' then
			select submission.*
			into v_submission
			from public.shared_product_submissions submission
			where submission.id = v_product.approved_submission_id
				and submission.status = 'approved'
				and submission.barcode = v_product.barcode
				and submission.food = v_product.food
			order by submission.reviewed_at desc nulls last, submission.created_at desc
			limit 1;

			if found then
				v_evidence_kind := 'approved_submission';
				v_evidence_id := v_submission.id;
				v_label_observed_at := v_submission.label_observed_at;
			else
				select observation.*
				into v_observation
				from public.shared_product_observations observation
				where observation.barcode = v_product.barcode
					and observation.normalized_food = v_product.food
					and (
						observation.source = v_product.source
						or (
							v_product.source = 'community-reviewed'
							and observation.source in ('user-label', 'manufacturer')
						)
					)
					and observation.source_reference is not distinct from v_product.source_reference
				order by observation.observed_at, observation.id
				limit 1;

				if found then
					v_evidence_kind := 'source_observation';
					v_evidence_id := v_observation.id;
					v_label_observed_at := v_observation.observed_at;
				end if;
			end if;

			if v_evidence_id is null then
				insert into public.catalog_health_repair_run_items (
					run_id, item_key, result, reason_code
				)
				values (
					v_run_id, 'revision:baseline', 'unresolved',
					'exact_revision_baseline_evidence_missing'
				);
				v_unresolved_count := 1;
			else
				v_candidate_count := 1;
				insert into public.catalog_health_repair_run_items (
					run_id,
					item_key,
					result,
					reason_code,
					before_value,
					after_value
				)
				values (
					v_run_id,
					'revision:baseline',
					case when p_apply then 'changed' else 'would_change' end,
					case v_evidence_kind
						when 'approved_submission' then 'exact_submission_revision_baseline'
						else 'exact_observation_revision_baseline'
					end,
					null,
					jsonb_build_object(
						'revisionNumber', 1,
						'evidenceKind', v_evidence_kind,
						'evidenceId', v_evidence_id,
						'labelObservedAt', v_label_observed_at
					)
				);

				if p_apply then
					insert into public.shared_product_revisions (
						shared_product_id,
						revision_number,
						food,
						source,
						source_reference,
						created_by,
						submission_id,
						change_summary,
						label_observed_at,
						category_option_id
					)
					values (
						v_product.id,
						1,
						v_product.food,
						v_product.source,
						v_product.source_reference,
						(select auth.uid()),
						case when v_evidence_kind = 'approved_submission' then v_evidence_id else null end,
						jsonb_build_object(
							'repairEvidence', jsonb_build_object(
								'kind', v_evidence_kind,
								'id', v_evidence_id,
								'repairRunId', v_run_id
							)
						),
						v_label_observed_at,
						v_product.category_option_id
					);
					v_changed_count := 1;
				end if;
			end if;
		else
			select revision.*
			into v_revision
			from public.shared_product_revisions revision
			where revision.id = (v_occurrence.parameters ->> 'revisionId')::uuid
				and revision.shared_product_id = v_product.id
				and revision.revision_number > 1
				and not exists (
					select 1
					from public.shared_product_revision_changes revision_change
					where revision_change.revision_id = revision.id
				)
			for update;

			if not found
				or not coalesce(
					public.catalog_change_summary_is_valid(v_revision.change_summary, true),
					false
				) then
				insert into public.catalog_health_repair_run_items (
					run_id, item_key, result, reason_code
				)
				values (
					v_run_id,
					'revision:' || coalesce(v_occurrence.parameters ->> 'revisionId', 'unknown'),
					'unresolved',
					'structured_revision_change_evidence_missing'
				);
				v_unresolved_count := 1;
			else
				v_change_count := jsonb_array_length(v_revision.change_summary -> 'changes');
				v_candidate_count := v_change_count;

				insert into public.catalog_health_repair_run_items (
					run_id,
					item_key,
					result,
					reason_code,
					before_value,
					after_value
				)
				select
					v_run_id,
					'revision:' || v_revision.id::text || ':' || (change.value ->> 'field'),
					case when p_apply then 'changed' else 'would_change' end,
					'structured_revision_change_available',
					null,
					jsonb_build_object(
						'field', change.value ->> 'field',
						'changeType', change.value ->> 'changeType',
						'source', 'revision_change_summary'
					)
				from jsonb_array_elements(v_revision.change_summary -> 'changes') change(value);

				if p_apply then
					insert into public.shared_product_revision_changes (
						revision_id,
						field_path,
						field_label,
						change_type,
						previous_value,
						new_value,
						severity
					)
					select
						v_revision.id,
						change.value ->> 'field',
						change.value ->> 'label',
						change.value ->> 'changeType',
						change.value -> 'previousValue',
						change.value -> 'submittedValue',
						change.value ->> 'severity'
					from jsonb_array_elements(v_revision.change_summary -> 'changes') change(value)
					on conflict (revision_id, field_path) do nothing;
					get diagnostics v_inserted_count = row_count;
					v_changed_count := v_inserted_count;
					v_skipped_count := greatest(v_change_count - v_inserted_count, 0);
				end if;
			end if;
		end if;

		v_run_status := case
			when v_unresolved_count > 0 then 'completed_with_unresolved'
			else 'completed'
		end;
		update public.catalog_health_repair_runs
		set
			status = v_run_status,
			candidate_count = v_candidate_count,
			changed_count = v_changed_count,
			skipped_count = v_skipped_count,
			unresolved_count = v_unresolved_count,
			error_count = v_error_count,
			summary = case
				when p_apply then 'Evidence-only revision repair completed.'
				else 'Evidence-only revision repair dry run completed.'
			end,
			completed_at = now()
		where id = v_run_id;
	exception when others then
		v_error_count := v_error_count + 1;
		insert into public.catalog_health_repair_run_items (
			run_id, item_key, result, reason_code
		)
		values (
			v_run_id, v_occurrence.subject_key, 'failed', 'repair_execution_failed'
		)
		on conflict (run_id, item_key) do update
		set result = 'failed', reason_code = 'repair_execution_failed';
		update public.catalog_health_repair_runs
		set
			status = 'failed',
			error_count = v_error_count,
			summary = 'The revision repair could not be completed safely.',
			completed_at = now()
		where id = v_run_id;
	end;

	return jsonb_build_object(
		'runId', v_run_id,
		'mode', v_mode,
		'status', (
			select run.status from public.catalog_health_repair_runs run where run.id = v_run_id
		),
		'candidateCount', (
			select run.candidate_count from public.catalog_health_repair_runs run where run.id = v_run_id
		),
		'changedCount', (
			select run.changed_count from public.catalog_health_repair_runs run where run.id = v_run_id
		),
		'skippedCount', (
			select run.skipped_count from public.catalog_health_repair_runs run where run.id = v_run_id
		),
		'unresolvedCount', (
			select run.unresolved_count from public.catalog_health_repair_runs run where run.id = v_run_id
		),
		'items', coalesce((
			select jsonb_agg(jsonb_build_object(
				'itemKey', item.item_key,
				'result', item.result,
				'reasonCode', item.reason_code
			) order by item.id)
			from public.catalog_health_repair_run_items item
			where item.run_id = v_run_id
		), '[]'::jsonb)
	);
end;
$$;

revoke all on function private.run_catalog_revision_history_repair(text, boolean, uuid)
	from public, anon, authenticated, service_role;

create or replace function public.run_catalog_health_repair(
	p_occurrence_key text,
	p_apply boolean default false,
	p_dry_run_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_issue_code text;
begin
	select occurrence.issue_code
	into v_issue_code
	from public.catalog_health_issue_occurrences occurrence
	where occurrence.occurrence_key = p_occurrence_key
		and occurrence.status = 'open';

	if v_issue_code in (
		'CATALOG_REVISION_MISSING',
		'CATALOG_REVISION_EXPLANATION_MISSING'
	) then
		return private.run_catalog_revision_history_repair(
			p_occurrence_key,
			p_apply,
			p_dry_run_id
		);
	end if;

	return private.run_catalog_provenance_health_repair(
		p_occurrence_key,
		p_apply,
		p_dry_run_id
	);
end;
$$;

revoke all on function public.run_catalog_health_repair(text, boolean, uuid)
	from public, anon, authenticated, service_role;
grant execute on function public.run_catalog_health_repair(text, boolean, uuid)
	to authenticated;

create or replace function public.get_catalog_data_operations_health(
	p_days integer default 30,
	p_issue_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_dashboard jsonb;
	v_issue_limit integer := least(greatest(coalesce(p_issue_limit, 20), 1), 50);
	v_mapping_gap_count integer;
	v_mapping_issues jsonb;
	v_revision_gap_count integer;
	v_revision_issues jsonb;
begin
	if not public.authorize_app_permission('data_operations.catalog_health.read') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified data-operations access is required.';
	end if;

	v_dashboard := private.build_moderator_data_health_summary(p_days, p_issue_limit);

	select count(*)
	into v_mapping_gap_count
	from public.nutrient_source_mappings mapping
	where mapping.review_status = 'pending_review';

	select coalesce(jsonb_agg(jsonb_build_object(
		'mappingId', issue.id,
		'sourceKey', issue.source_key,
		'sourceNutrientKey', issue.source_nutrient_key,
		'sourceNutrientName', issue.source_nutrient_name,
		'sourceUnitName', issue.source_unit_name,
		'reviewStatus', issue.review_status,
		'reviewReference', issue.review_reference
	) order by issue.source_key, issue.source_nutrient_key, issue.source_unit_name), '[]'::jsonb)
	into v_mapping_issues
	from (
		select mapping.*
		from public.nutrient_source_mappings mapping
		where mapping.review_status = 'pending_review'
		order by mapping.source_key, mapping.source_nutrient_key, mapping.source_unit_name
		limit v_issue_limit
	) issue;

	select count(distinct occurrence.shared_product_id)
	into v_revision_gap_count
	from public.catalog_health_issue_occurrences occurrence
	where occurrence.issue_code in (
		'CATALOG_REVISION_MISSING',
		'CATALOG_REVISION_EXPLANATION_MISSING'
	);

	select coalesce(jsonb_agg(jsonb_build_object(
		'productId', issue.product_id,
		'barcode', issue.barcode,
		'productName', issue.product_name,
		'issue', issue.issue
	) order by issue.product_name, issue.product_id), '[]'::jsonb)
	into v_revision_issues
	from (
		select distinct on (product.id)
			product.id as product_id,
			product.barcode,
			product.product_name,
			case occurrence.issue_code
				when 'CATALOG_REVISION_MISSING' then 'missing_revision'
				else 'unexplained_revision'
			end as issue,
			case occurrence.issue_code
				when 'CATALOG_REVISION_MISSING' then 0
				else 1
			end as issue_order
		from public.catalog_health_issue_occurrences occurrence
		join public.shared_products product
			on product.id = occurrence.shared_product_id
		where occurrence.issue_code in (
			'CATALOG_REVISION_MISSING',
			'CATALOG_REVISION_EXPLANATION_MISSING'
		)
		order by product.id, issue_order, occurrence.detected_at
		limit v_issue_limit
	) issue;

	return jsonb_set(
		jsonb_set(
			jsonb_set(
				jsonb_set(
					v_dashboard,
					'{overview,nutrientMappingReviewGaps}',
					to_jsonb(v_mapping_gap_count),
					true
				),
				'{issues,nutrientMappings}',
				v_mapping_issues,
				true
			),
			'{overview,revisionHistoryGaps}',
			to_jsonb(v_revision_gap_count),
			true
		),
		'{issues,revisions}',
		v_revision_issues,
		true
	);
end;
$$;

comment on function private.run_catalog_revision_history_repair(text, boolean, uuid) is
	'Reconstructs revision history only from exact approved submissions, exact stored observations, or the revision existing structured change summary. Unrecoverable history remains unresolved.';

comment on function public.run_catalog_health_repair(text, boolean, uuid) is
	'Routes one AAL2 dry-run-first catalog repair to the reviewed evidence-link or revision-history handler and records every outcome.';
