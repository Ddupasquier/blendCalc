create or replace function public.get_catalog_product_readiness_passport(
	p_shared_product_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_readiness public.catalog_product_readiness%rowtype;
	v_api_readiness public.blendcalc_api_v1_product_readiness%rowtype;
	v_revision public.shared_product_revisions%rowtype;
begin
	if not (
		public.authorize_app_permission('moderation.catalog.review')
		or public.authorize_app_permission('data_operations.catalog_health.read')
	) then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog access is required.';
	end if;

	select readiness.*
	into v_readiness
	from public.catalog_product_readiness readiness
	where readiness.shared_product_id = p_shared_product_id;

	if not found then
		raise exception using
			errcode = 'P0002',
			message = 'Catalog product was not found.';
	end if;

	select api_readiness.*
	into v_api_readiness
	from public.blendcalc_api_v1_product_readiness api_readiness
	where api_readiness.shared_product_id = p_shared_product_id;

	if v_readiness.current_revision_id is not null then
		select revision.*
		into v_revision
		from public.shared_product_revisions revision
		where revision.id = v_readiness.current_revision_id;
	end if;

	return jsonb_build_object(
		'product', jsonb_build_object(
			'id', v_readiness.shared_product_id,
			'barcode', v_readiness.barcode,
			'productName', v_readiness.product_name,
			'brandOwner', v_readiness.brand_owner,
			'sharedCatalogStatus', v_readiness.shared_catalog_status,
			'apiV1Status', v_readiness.api_v1_status,
			'searchableInBlendcalc', v_readiness.searchable_in_blendcalc,
			'usableInBlendcalc', v_readiness.usable_in_blendcalc,
			'openMaterialConflictCount', v_readiness.open_material_conflict_count,
			'pendingCorrectionCount', v_readiness.pending_correction_count,
			'lastVerifiedAt', v_readiness.last_verified_at,
			'updatedAt', v_readiness.updated_at
		),
		'revision', case
			when v_revision.id is null then null
			else jsonb_build_object(
				'id', v_revision.id,
				'number', v_revision.revision_number,
				'labelObservedAt', v_revision.label_observed_at,
				'createdAt', v_revision.created_at,
				'source', v_revision.source,
				'sourceReference', v_revision.source_reference,
				'changeSummary', v_revision.change_summary
			)
		end,
		'qualityDimensions', coalesce(v_api_readiness.quality_dimensions, '{}'::jsonb),
		'evidence', jsonb_build_object(
			'selectedFieldCount', (
				select count(*)
				from public.shared_product_field_provenance provenance
				where provenance.shared_product_id = p_shared_product_id
					and provenance.selected
			),
			'normalizedNutrientCount', (
				select count(*)
				from public.food_nutrients nutrient
				where nutrient.shared_product_id = p_shared_product_id
			),
			'nutrientsWithSourceEvidenceCount', (
				select count(*)
				from public.food_nutrients nutrient
				where nutrient.shared_product_id = p_shared_product_id
					and (
						nutrient.source_observation_id is not null
						or nullif(btrim(nutrient.source_reference), '') is not null
					)
			),
			'servingCount', (
				select count(*)
				from public.food_servings serving
				where serving.shared_product_id = p_shared_product_id
			),
			'servingsWithSourceEvidenceCount', (
				select count(*)
				from public.food_servings serving
				where serving.shared_product_id = p_shared_product_id
					and (
						serving.source_observation_id is not null
						or nullif(btrim(serving.source_reference), '') is not null
					)
			),
			'observationCount', (
				select count(*)
				from public.shared_product_observations observation
				where observation.barcode = v_readiness.barcode
			),
			'sources', coalesce((
				select jsonb_agg(source_row.source order by source_row.source)
				from (
					select distinct observation.source
					from public.shared_product_observations observation
					where observation.barcode = v_readiness.barcode
				) source_row
			), '[]'::jsonb)
		),
		'issues', coalesce((
			select jsonb_agg(
				jsonb_build_object(
					'occurrenceKey', occurrence.occurrence_key,
					'issueCode', occurrence.issue_code,
					'sourceScope', occurrence.source_scope,
					'sourceReason', occurrence.source_reason,
					'parameters', occurrence.parameters,
					'detectedAt', occurrence.detected_at,
					'operationalSeverity', issue.operational_severity,
					'responsibleGroup', issue.responsible_group,
					'resolutionAction', issue.resolution_action,
					'automatedRepairAllowed', issue.automated_repair_allowed,
					'automatedRepairKey', issue.automated_repair_key
				)
				order by
					case issue.operational_severity
						when 'critical' then 1
						when 'blocking' then 2
						when 'attention' then 3
						else 4
					end,
					occurrence.detected_at desc,
					occurrence.occurrence_key
			)
			from public.catalog_health_issue_occurrences occurrence
			join public.app_issue_codes issue on issue.code = occurrence.issue_code
			where occurrence.shared_product_id = p_shared_product_id
				and occurrence.status = 'open'
				and issue.enabled
		), '[]'::jsonb)
	);
end;
$$;

revoke all on function public.get_catalog_product_readiness_passport(uuid)
	from public, anon, authenticated, service_role;
grant execute on function public.get_catalog_product_readiness_passport(uuid)
	to authenticated;

comment on function public.get_catalog_product_readiness_passport(uuid) is
	'Returns one bounded product readiness passport to an AAL2 catalog reviewer or data-operations reader. The payload contains normalized status, evidence counts, and issue routing but no raw provider payloads or private user evidence.';
