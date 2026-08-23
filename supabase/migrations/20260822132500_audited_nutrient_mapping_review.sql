alter table public.nutrient_source_mappings
	add column id uuid not null default gen_random_uuid();

create unique index nutrient_source_mappings_id_unique_idx
	on public.nutrient_source_mappings (id);

create table public.nutrient_mapping_review_decisions (
	id uuid primary key default gen_random_uuid(),
	mapping_id uuid not null references public.nutrient_source_mappings(id) on delete restrict,
	source_key text not null,
	source_nutrient_key text not null,
	source_unit_name text not null,
	outcome text not null check (outcome in ('approved', 'excluded')),
	previous_nutrient_id bigint not null references public.nutrient_definitions(nutrient_id) on delete restrict,
	selected_nutrient_id bigint references public.nutrient_definitions(nutrient_id) on delete restrict,
	previous_mapping_method text not null,
	review_note text not null check (
		btrim(review_note) <> '' and char_length(review_note) <= 2000
	),
	evidence_reference text check (
		evidence_reference is null
		or (btrim(evidence_reference) <> '' and char_length(evidence_reference) <= 2000)
	),
	reviewed_by uuid not null references auth.users(id) on delete restrict,
	reviewed_at timestamptz not null default now(),
	check (
		(outcome = 'approved' and selected_nutrient_id is not null and evidence_reference is not null)
		or (outcome = 'excluded' and selected_nutrient_id is null)
	)
);

create index nutrient_mapping_review_decisions_mapping_idx
	on public.nutrient_mapping_review_decisions (mapping_id, reviewed_at desc, id desc);

alter table public.nutrient_mapping_review_decisions enable row level security;
alter table public.nutrient_mapping_review_decisions force row level security;

revoke all on table public.nutrient_mapping_review_decisions
	from public, anon, authenticated;
grant all on table public.nutrient_mapping_review_decisions to service_role;

create or replace function public.get_nutrient_mapping_review_workspace(
	p_mapping_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_mapping public.nutrient_source_mappings%rowtype;
	v_source_display_name text;
	v_current_nutrient public.nutrient_definitions%rowtype;
	v_latest_decision public.nutrient_mapping_review_decisions%rowtype;
	v_compatible_nutrients jsonb;
begin
	if not public.authorize_app_permission('data_operations.nutrient_mappings.manage') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified nutrient mapping access is required.';
	end if;

	select mapping.*
	into v_mapping
	from public.nutrient_source_mappings mapping
	where mapping.id = p_mapping_id;

	if not found then
		raise exception using
			errcode = 'P0002',
			message = 'Nutrient mapping was not found.';
	end if;

	select source.display_name
	into v_source_display_name
	from public.product_data_sources source
	where source.key = v_mapping.source_key;

	select definition.*
	into v_current_nutrient
	from public.nutrient_definitions definition
	where definition.nutrient_id = v_mapping.nutrient_id;

	select decision.*
	into v_latest_decision
	from public.nutrient_mapping_review_decisions decision
	where decision.mapping_id = v_mapping.id
	order by decision.reviewed_at desc, decision.id desc
	limit 1;

	select coalesce(jsonb_agg(
		jsonb_build_object(
			'nutrientId', compatible.nutrient_id,
			'nutrientName', compatible.nutrient_name,
			'nutrientNumber', compatible.nutrient_number,
			'defaultUnitName', compatible.default_unit_name,
			'conversionMultiplier', compatible.conversion_multiplier
		)
		order by compatible.nutrient_name, compatible.nutrient_id
	), '[]'::jsonb)
	into v_compatible_nutrients
	from (
		select
			definition.nutrient_id,
			definition.nutrient_name,
			definition.nutrient_number,
			definition.default_unit_name,
			case
				when upper(definition.default_unit_name) = upper(v_mapping.source_unit_name)
					then 1::numeric
				else conversion.multiplier
			end as conversion_multiplier
		from public.nutrient_definitions definition
		left join lateral (
			select unit_conversion.multiplier
			from public.nutrient_unit_conversions unit_conversion
			where unit_conversion.source_key = v_mapping.source_key
				and unit_conversion.nutrient_id = definition.nutrient_id
				and upper(unit_conversion.from_unit_name) = upper(v_mapping.source_unit_name)
				and upper(unit_conversion.to_unit_name) = upper(definition.default_unit_name)
			order by unit_conversion.confidence desc, unit_conversion.updated_at desc
			limit 1
		) conversion on true
		where upper(definition.default_unit_name) = upper(v_mapping.source_unit_name)
			or conversion.multiplier is not null
	) compatible;

	return jsonb_build_object(
		'mapping', jsonb_build_object(
			'id', v_mapping.id,
			'sourceKey', v_mapping.source_key,
			'sourceDisplayName', coalesce(v_source_display_name, v_mapping.source_key),
			'sourceNutrientKey', v_mapping.source_nutrient_key,
			'sourceNutrientName', v_mapping.source_nutrient_name,
			'sourceUnitName', v_mapping.source_unit_name,
			'mappingMethod', v_mapping.mapping_method,
			'confidence', v_mapping.confidence,
			'observationCount', v_mapping.observation_count,
			'reviewStatus', v_mapping.review_status,
			'reviewReference', v_mapping.review_reference,
			'reviewedAt', v_mapping.reviewed_at,
			'candidateReason', nullif(btrim(v_mapping.provenance ->> 'reason'), ''),
			'currentNutrient', jsonb_build_object(
				'nutrientId', v_current_nutrient.nutrient_id,
				'nutrientName', v_current_nutrient.nutrient_name,
				'nutrientNumber', v_current_nutrient.nutrient_number,
				'defaultUnitName', v_current_nutrient.default_unit_name
			)
		),
		'compatibleNutrients', v_compatible_nutrients,
		'latestDecision', case
			when v_latest_decision.id is null then null
			else jsonb_build_object(
				'id', v_latest_decision.id,
				'outcome', v_latest_decision.outcome,
				'selectedNutrientId', v_latest_decision.selected_nutrient_id,
				'reviewNote', v_latest_decision.review_note,
				'evidenceReference', v_latest_decision.evidence_reference,
				'reviewedAt', v_latest_decision.reviewed_at
			)
		end
	);
end;
$$;

create or replace function public.review_nutrient_source_mapping(
	p_mapping_id uuid,
	p_outcome text,
	p_selected_nutrient_id bigint default null,
	p_review_note text default null,
	p_evidence_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_mapping public.nutrient_source_mappings%rowtype;
	v_selected_nutrient public.nutrient_definitions%rowtype;
	v_decision_id uuid := gen_random_uuid();
	v_review_note text := btrim(coalesce(p_review_note, ''));
	v_evidence_reference text := nullif(btrim(coalesce(p_evidence_reference, '')), '');
	v_review_reference text;
	v_has_compatible_unit boolean := false;
begin
	if not public.authorize_app_permission('data_operations.nutrient_mappings.manage') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified nutrient mapping access is required.';
	end if;

	if p_outcome not in ('approved', 'excluded') then
		raise exception 'Nutrient mapping review outcome is invalid.';
	end if;
	if v_review_note = '' or char_length(v_review_note) > 2000 then
		raise exception 'A review note between 1 and 2000 characters is required.';
	end if;
	if v_evidence_reference is not null and char_length(v_evidence_reference) > 2000 then
		raise exception 'The evidence reference is too long.';
	end if;

	select mapping.*
	into v_mapping
	from public.nutrient_source_mappings mapping
	where mapping.id = p_mapping_id
	for update;

	if not found then
		raise exception using
			errcode = 'P0002',
			message = 'Nutrient mapping was not found.';
	end if;
	if v_mapping.review_status <> 'pending_review' then
		raise exception 'This nutrient mapping is no longer waiting for review.';
	end if;

	if p_outcome = 'approved' then
		if p_selected_nutrient_id is null or v_evidence_reference is null then
			raise exception 'Approval requires a nutrient and an evidence reference.';
		end if;

		select definition.*
		into v_selected_nutrient
		from public.nutrient_definitions definition
		where definition.nutrient_id = p_selected_nutrient_id;
		if not found then
			raise exception 'The selected nutrient does not exist.';
		end if;

		v_has_compatible_unit :=
			upper(v_selected_nutrient.default_unit_name) = upper(v_mapping.source_unit_name)
			or exists (
				select 1
				from public.nutrient_unit_conversions conversion
				where conversion.source_key = v_mapping.source_key
					and conversion.nutrient_id = v_selected_nutrient.nutrient_id
					and upper(conversion.from_unit_name) = upper(v_mapping.source_unit_name)
					and upper(conversion.to_unit_name) = upper(v_selected_nutrient.default_unit_name)
			);
		if not v_has_compatible_unit then
			raise exception 'The source unit has no reviewed conversion for that nutrient.';
		end if;
	else
		if p_selected_nutrient_id is not null then
			raise exception 'Excluded mappings cannot select a nutrient.';
		end if;
		v_evidence_reference := null;
	end if;

	v_review_reference := 'nutrient-mapping-review:' || v_decision_id::text;

	insert into public.nutrient_mapping_review_decisions (
		id,
		mapping_id,
		source_key,
		source_nutrient_key,
		source_unit_name,
		outcome,
		previous_nutrient_id,
		selected_nutrient_id,
		previous_mapping_method,
		review_note,
		evidence_reference,
		reviewed_by
	)
	values (
		v_decision_id,
		v_mapping.id,
		v_mapping.source_key,
		v_mapping.source_nutrient_key,
		v_mapping.source_unit_name,
		p_outcome,
		v_mapping.nutrient_id,
		case when p_outcome = 'approved' then p_selected_nutrient_id else null end,
		v_mapping.mapping_method,
		v_review_note,
		v_evidence_reference,
		auth.uid()
	);

	update public.nutrient_source_mappings mapping
	set
		nutrient_id = case
			when p_outcome = 'approved' then p_selected_nutrient_id
			else mapping.nutrient_id
		end,
		mapping_method = case
			when p_outcome = 'approved' then 'moderator_verified'
			else mapping.mapping_method
		end,
		confidence = case
			when p_outcome = 'approved' then 1
			else mapping.confidence
		end,
		enabled = p_outcome = 'approved',
		review_status = case
			when p_outcome = 'approved' then 'approved'
			else 'rejected'
		end,
		review_reference = v_review_reference,
		reviewed_at = now(),
		provenance = mapping.provenance || jsonb_build_object(
			'lastReviewDecisionId', v_decision_id,
			'lastReviewOutcome', p_outcome
		),
		updated_at = now()
	where mapping.id = v_mapping.id;

	return jsonb_build_object(
		'decisionId', v_decision_id,
		'mappingId', v_mapping.id,
		'outcome', p_outcome,
		'reviewStatus', case when p_outcome = 'approved' then 'approved' else 'rejected' end,
		'enabled', p_outcome = 'approved',
		'selectedNutrientId', case when p_outcome = 'approved' then p_selected_nutrient_id else null end
	);
end;
$$;

revoke all on function public.get_nutrient_mapping_review_workspace(uuid)
	from public, anon, authenticated, service_role;
grant execute on function public.get_nutrient_mapping_review_workspace(uuid)
	to authenticated;

revoke all on function public.review_nutrient_source_mapping(uuid, text, bigint, text, text)
	from public, anon, authenticated, service_role;
grant execute on function public.review_nutrient_source_mapping(uuid, text, bigint, text, text)
	to authenticated;

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

	return jsonb_set(
		jsonb_set(
			v_dashboard,
			'{overview,nutrientMappingReviewGaps}',
			to_jsonb(v_mapping_gap_count),
			true
		),
		'{issues,nutrientMappings}',
		v_mapping_issues,
		true
	);
end;
$$;

comment on table public.nutrient_mapping_review_decisions is
	'Immutable AAL2 nutrient-mapping decisions. Approved mappings require a reviewed compatible unit path; excluded candidates remain disabled without being counted as unresolved work.';

comment on function public.get_nutrient_mapping_review_workspace(uuid) is
	'Returns one bounded mapping, its current candidate, unit-compatible nutrients, and latest decision to an AAL2 admin or developer.';

comment on function public.review_nutrient_source_mapping(uuid, text, bigint, text, text) is
	'Atomically approves or excludes one pending semantic nutrient mapping and records the immutable decision. Exact active mappings remain automated and do not enter this workflow.';
