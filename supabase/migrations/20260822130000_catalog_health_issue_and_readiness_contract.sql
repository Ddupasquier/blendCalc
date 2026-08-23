alter table public.app_issue_codes
	add column operational_severity text,
	add column responsible_group text,
	add column resolution_action text,
	add column automated_repair_key text,
	add column automated_repair_allowed boolean not null default false;

update public.app_issue_codes
set
	operational_severity = case kind
		when 'error' then 'blocking'
		else 'attention'
	end,
	responsible_group = case domain
		when 'catalog' then 'catalog_review'
		when 'compatibility' then 'food_policy_review'
		when 'nutrition' then 'data_operations'
		else 'system'
	end,
	resolution_action = case domain
		when 'catalog' then 'review_catalog_record'
		when 'compatibility' then 'review_food_policy'
		when 'nutrition' then 'review_nutrition_data'
		else 'inspect_system_issue'
	end;

alter table public.app_issue_codes
	alter column operational_severity set not null,
	alter column responsible_group set not null,
	alter column resolution_action set not null,
	add constraint app_issue_codes_operational_severity_check
		check (operational_severity in ('informational', 'attention', 'blocking', 'critical')),
	add constraint app_issue_codes_responsible_group_check
		check (responsible_group in (
			'catalog_review',
			'data_operations',
			'food_policy_review',
			'external_review',
			'system'
		)),
	add constraint app_issue_codes_resolution_action_check
		check (resolution_action ~ '^[a-z][a-z0-9_]*$'),
	add constraint app_issue_codes_automated_repair_check
		check (
			not automated_repair_allowed
			or nullif(btrim(automated_repair_key), '') is not null
		);

comment on column public.app_issue_codes.operational_severity is
	'Operational urgency used to prioritize work. This value is not user-facing copy.';
comment on column public.app_issue_codes.responsible_group is
	'Permission-oriented work owner. It never grants access by itself.';
comment on column public.app_issue_codes.resolution_action is
	'Stable application action key used to route an issue to its supported resolution workflow.';
comment on column public.app_issue_codes.automated_repair_key is
	'Optional reviewed repair handler key. Its presence does not authorize execution.';
comment on column public.app_issue_codes.automated_repair_allowed is
	'True only when the issue can be repaired from existing evidence without inventing or overwriting facts.';

insert into public.app_issue_codes (
	code,
	kind,
	domain,
	description,
	operational_severity,
	responsible_group,
	resolution_action,
	automated_repair_key,
	automated_repair_allowed
)
values
	('CATALOG_REQUIRED_FIELD_MISSING', 'warning', 'catalog', 'A required canonical product field is missing.', 'attention', 'catalog_review', 'create_catalog_correction', null, false),
	('CATALOG_GTIN_INVALID', 'error', 'catalog', 'The canonical product identity does not contain a valid GTIN.', 'blocking', 'catalog_review', 'review_product_identity', null, false),
	('CATALOG_VERIFICATION_REQUIRED', 'warning', 'catalog', 'The canonical product has no current verification evidence.', 'attention', 'catalog_review', 'review_product_evidence', null, false),
	('CATALOG_REVISION_MISSING', 'error', 'catalog', 'The canonical product does not have the required immutable revision history.', 'blocking', 'data_operations', 'run_revision_repair', 'create_revision_from_existing_evidence', true),
	('CATALOG_REVISION_EXPLANATION_MISSING', 'warning', 'catalog', 'A later catalog revision does not have field-level change evidence.', 'attention', 'data_operations', 'review_revision_history', null, false),
	('CATALOG_FIELD_PROVENANCE_MISSING', 'error', 'catalog', 'A selected canonical field does not have field-level source provenance.', 'blocking', 'data_operations', 'run_provenance_repair', 'link_existing_field_observation', true),
	('CATALOG_NUTRITION_INCOMPLETE', 'warning', 'nutrition', 'The applicable publication profile requires nutrient evidence that is not present.', 'attention', 'catalog_review', 'create_catalog_correction', null, false),
	('CATALOG_NUTRIENT_VALUE_UNSUPPORTED', 'error', 'nutrition', 'A stored nutrient value uses a state that cannot be published.', 'blocking', 'data_operations', 'review_nutrient_value', null, false),
	('CATALOG_NUTRIENT_DERIVATION_INCOMPLETE', 'error', 'nutrition', 'A derived nutrient does not preserve its calculation method.', 'blocking', 'data_operations', 'review_nutrient_value', null, false),
	('CATALOG_NUTRIENT_PROVENANCE_MISSING', 'error', 'nutrition', 'A normalized nutrient does not have selected source provenance.', 'blocking', 'data_operations', 'run_nutrient_provenance_repair', 'link_existing_nutrient_observation', true),
	('NUTRIENT_MAPPING_GAP', 'warning', 'nutrition', 'A source nutrient mapping is not fully reviewed.', 'attention', 'data_operations', 'review_nutrient_mapping', null, false),
	('CATALOG_PRIMARY_SERVING_MISSING', 'warning', 'nutrition', 'The product does not have an evidence-backed primary serving.', 'attention', 'catalog_review', 'create_catalog_correction', null, false),
	('CATALOG_SERVING_PROVENANCE_MISSING', 'error', 'nutrition', 'The selected serving does not have complete source provenance.', 'blocking', 'data_operations', 'run_serving_provenance_repair', 'link_existing_serving_observation', true),
	('CATALOG_ALLERGEN_EVIDENCE_INCOMPLETE', 'warning', 'compatibility', 'The applicable publication profile requires allergen evidence that is not present.', 'attention', 'catalog_review', 'create_catalog_correction', null, false),
	('CATALOG_MATERIAL_CONFLICT', 'error', 'catalog', 'A material canonical field conflict remains unresolved.', 'blocking', 'catalog_review', 'review_catalog_conflict', null, false),
	('API_PUBLICATION_PROFILE_MISSING', 'error', 'api', 'No active default publication profile can evaluate the product.', 'critical', 'data_operations', 'review_publication_profile', null, false),
	('API_REDISTRIBUTION_REVIEW_REQUIRED', 'warning', 'licensing', 'Selected product evidence is not approved for API redistribution.', 'blocking', 'external_review', 'review_source_redistribution', null, false),
	('SOURCE_POLICY_REVIEW_REQUIRED', 'warning', 'licensing', 'An enabled data source is missing a current policy review.', 'attention', 'external_review', 'review_source_policy', null, false),
	('SOURCE_LICENSE_METADATA_MISSING', 'warning', 'licensing', 'An enabled reusable data source is missing required license or attribution metadata.', 'blocking', 'external_review', 'review_source_redistribution', null, false),
	('DATASET_LICENSE_REVIEW_REQUIRED', 'warning', 'licensing', 'An active or import-enabled dataset does not have approved license review.', 'blocking', 'external_review', 'review_dataset_license', null, false),
	('DATASET_IMPORT_EVIDENCE_MISSING', 'warning', 'imports', 'An import-enabled dataset is missing import or checksum evidence.', 'attention', 'data_operations', 'review_dataset_import', null, false),
	('WARNING_POLICY_COVERAGE_GAP', 'warning', 'compatibility', 'A selectable food preference lacks complete evidence and conflict-rule coverage.', 'blocking', 'food_policy_review', 'review_food_policy', null, false)
on conflict (code) do update set
	kind = excluded.kind,
	domain = excluded.domain,
	description = excluded.description,
	operational_severity = excluded.operational_severity,
	responsible_group = excluded.responsible_group,
	resolution_action = excluded.resolution_action,
	automated_repair_key = excluded.automated_repair_key,
	automated_repair_allowed = excluded.automated_repair_allowed,
	enabled = true;

create or replace function public.catalog_health_issue_code_for_reason(
	p_reason text
)
returns text
language sql
immutable
set search_path = ''
as $$
	select case
		when p_reason = 'missing_publication_profile' then 'API_PUBLICATION_PROFILE_MISSING'
		when p_reason = 'invalid_gtin' then 'CATALOG_GTIN_INVALID'
		when p_reason in ('missing_verification_timestamp', 'verification_expired') then 'CATALOG_VERIFICATION_REQUIRED'
		when p_reason = 'missing_current_revision' then 'CATALOG_REVISION_MISSING'
		when p_reason like 'missing_required_field:%' then 'CATALOG_REQUIRED_FIELD_MISSING'
		when p_reason like 'missing_field_provenance:%' then 'CATALOG_FIELD_PROVENANCE_MISSING'
		when p_reason in (
			'field_source_not_redistributable',
			'nutrient_source_not_redistributable',
			'serving_source_not_redistributable'
		) then 'API_REDISTRIBUTION_REVIEW_REQUIRED'
		when p_reason = 'insufficient_allergen_evidence' then 'CATALOG_ALLERGEN_EVIDENCE_INCOMPLETE'
		when p_reason = 'missing_normalized_nutrients'
			or p_reason like 'missing_required_nutrient:%'
			then 'CATALOG_NUTRITION_INCOMPLETE'
		when p_reason = 'unsupported_nutrient_value_state' then 'CATALOG_NUTRIENT_VALUE_UNSUPPORTED'
		when p_reason = 'unreviewed_nutrient_mapping' then 'NUTRIENT_MAPPING_GAP'
		when p_reason = 'derived_nutrient_missing_method' then 'CATALOG_NUTRIENT_DERIVATION_INCOMPLETE'
		when p_reason = 'missing_nutrient_provenance' then 'CATALOG_NUTRIENT_PROVENANCE_MISSING'
		when p_reason = 'missing_evidence_backed_primary_serving' then 'CATALOG_PRIMARY_SERVING_MISSING'
		when p_reason = 'missing_serving_provenance' then 'CATALOG_SERVING_PROVENANCE_MISSING'
		when p_reason = 'unresolved_material_conflict' then 'CATALOG_MATERIAL_CONFLICT'
		else 'CATALOG_VALIDATION_UNAVAILABLE'
	end;
$$;

revoke all on function public.catalog_health_issue_code_for_reason(text)
	from public, anon, authenticated;
grant execute on function public.catalog_health_issue_code_for_reason(text)
	to service_role;

create or replace view public.catalog_product_readiness
with (security_invoker = true)
as
select
	product.id as shared_product_id,
	product.barcode,
	product.product_name,
	product.brand_owner,
	case
		when product.status <> 'active' then 'Blocked'
		when coalesce(review.pending_correction_count, 0) > 0
			or coalesce(conflict.open_material_conflict_count, 0) > 0
			then 'Waiting for review'
		else 'Active'
	end as shared_catalog_status,
	case when coalesce(api.publishable, false) then 'Ready' else 'Withheld' end
		as api_v1_status,
	product.status = 'active' as searchable_in_blendcalc,
	product.status = 'active' as usable_in_blendcalc,
	coalesce(api.reasons, '{}'::text[]) as api_v1_withholding_reasons,
	coalesce(conflict.open_material_conflict_count, 0) as open_material_conflict_count,
	coalesce(review.pending_correction_count, 0) as pending_correction_count,
	revision.id as current_revision_id,
	revision.revision_number as current_revision_number,
	revision.label_observed_at as current_label_observed_at,
	product.last_verified_at,
	product.updated_at
from public.shared_products product
left join public.blendcalc_api_v1_product_readiness api
	on api.shared_product_id = product.id
left join lateral (
	select count(*)::integer as open_material_conflict_count
	from public.shared_product_conflicts product_conflict
	where product_conflict.shared_product_id = product.id
		and product_conflict.status = 'open'
		and product_conflict.severity in ('medium', 'high')
) conflict on true
left join lateral (
	select count(*)::integer as pending_correction_count
	from public.shared_product_submissions submission
	where submission.target_shared_product_id = product.id
		and submission.submission_kind = 'product_update'
		and submission.status = 'pending'
) review on true
left join lateral (
	select catalog_revision.*
	from public.shared_product_revisions catalog_revision
	where catalog_revision.shared_product_id = product.id
	order by catalog_revision.revision_number desc, catalog_revision.id desc
	limit 1
) revision on true;

comment on view public.catalog_product_readiness is
	'Service-only reusable readiness record. Shared catalog availability and blendCalc usability remain separate from public API v1 publication eligibility.';

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
	'nutrient-mapping:' || md5(
		mapping.source_key || ':' || mapping.source_nutrient_key || ':' || mapping.source_unit_name
	),
	'NUTRIENT_MAPPING_GAP',
	'nutrient_mapping',
	mapping.source_key || ':' || mapping.source_nutrient_key || ':' || mapping.source_unit_name,
	null::uuid,
	'nutrient_mapping',
	'open',
	mapping.review_status,
	jsonb_build_object(
		'sourceKey', mapping.source_key,
		'sourceNutrientKey', mapping.source_nutrient_key,
		'sourceNutrientName', mapping.source_nutrient_name,
		'sourceUnitName', mapping.source_unit_name
	),
	coalesce(mapping.reviewed_at, mapping.created_at)
from public.nutrient_source_mappings mapping
where mapping.review_status <> 'approved'
	or mapping.reviewed_at is null
	or nullif(btrim(mapping.review_reference), '') is null
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

comment on view public.catalog_health_issue_occurrences is
	'Service-only normalized open catalog-health occurrences. Stable issue metadata determines urgency, work ownership, routing, and whether a reviewed repair may be offered.';

revoke all on table public.catalog_product_readiness
	from public, anon, authenticated;
revoke all on table public.catalog_health_issue_occurrences
	from public, anon, authenticated;
grant select on table public.catalog_product_readiness to service_role;
grant select on table public.catalog_health_issue_occurrences to service_role;
