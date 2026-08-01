create or replace function public.get_moderator_data_health(
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
	v_days integer := least(greatest(coalesce(p_days, 30), 1), 90);
	v_issue_limit integer := least(greatest(coalesce(p_issue_limit, 20), 1), 50);
	v_overview jsonb;
	v_sources jsonb;
	v_datasets jsonb;
	v_policy jsonb;
	v_issues jsonb;
begin
	if auth.uid() is null or not exists (
		select 1
		from public.app_role_assignments role_assignment
		where role_assignment.user_id = auth.uid()
			and role_assignment.role in ('moderator', 'admin')
	) then
		raise exception using
			errcode = '42501',
			message = 'Moderator access is required.';
	end if;

	select jsonb_build_object(
		'activeProducts', (
			select count(*)
			from public.shared_products product
			where product.status = 'active'
		),
		'publicationReadyProducts', (
			select count(*)
			from public.blendcalc_api_v1_product_readiness readiness
			where readiness.publishable
		),
		'unresolvedConflicts', (
			select count(*)
			from public.shared_product_conflicts conflict
			where conflict.status = 'open'
		),
		'pendingProductSubmissions', (
			select count(*)
			from public.shared_product_submissions submission
			where submission.status = 'pending'
		),
		'pendingCompatibilityReports', (
			select count(*)
			from public.food_compatibility_feedback feedback
			where feedback.status = 'pending'
		),
		'pendingPreferenceMappings', (
			select count(*)
			from public.food_preference_mapping_requests request
			where request.status = 'pending'
		),
		'nutrientMappingReviewGaps', (
			select count(*)
			from public.nutrient_source_mappings mapping
			where mapping.review_status <> 'approved'
				or mapping.reviewed_at is null
				or nullif(btrim(mapping.review_reference), '') is null
		),
		'revisionHistoryGaps', (
			select count(*)
			from public.shared_products product
			where product.status = 'active'
				and (
					not exists (
						select 1
						from public.shared_product_revisions revision
						where revision.shared_product_id = product.id
					)
					or exists (
						select 1
						from public.shared_product_revisions revision
						where revision.shared_product_id = product.id
							and revision.revision_number > 1
							and not exists (
								select 1
								from public.shared_product_revision_changes revision_change
								where revision_change.revision_id = revision.id
							)
					)
				)
		),
		'datasetReviewGaps', (
			select count(*)
			from public.generic_food_datasets dataset
			where dataset.license_review_status <> 'approved'
				or (
					dataset.import_enabled
					and (
						dataset.imported_at is null
						or dataset.source_file_sha256 is null
					)
				)
		),
		'sourcePolicyGaps', (
			select count(*)
			from public.product_data_sources source
			where source.enabled
				and (source.canonical_storage_allowed or source.api_redistribution_allowed)
				and (
					source.canonical_policy_reviewed_at is null
					or nullif(btrim(source.canonical_license_name), '') is null
					or nullif(btrim(source.canonical_policy_notes), '') is null
					or nullif(btrim(source.attribution_text), '') is null
				)
		),
		'compatibilityCoverageGaps', (
			select count(*)
			from public.food_compatibility_policy_coverage coverage
			where coverage.selectable
				and (
					coalesce(coverage.conflict_count, 0) = 0
					or coalesce(coverage.evidence_rule_count, 0) = 0
				)
		)
	)
	into v_overview;

	select coalesce(jsonb_agg(
		jsonb_build_object(
			'key', source.key,
			'displayName', source.display_name,
			'sourceType', source.source_type,
			'enabled', source.enabled,
			'canonicalStorageAllowed', source.canonical_storage_allowed,
			'apiRedistributionAllowed', source.api_redistribution_allowed,
			'policyReviewedAt', source.canonical_policy_reviewed_at,
			'policyIssues', to_jsonb(array_remove(array[
				case
					when (source.canonical_storage_allowed or source.api_redistribution_allowed)
						and source.canonical_policy_reviewed_at is null
						then 'policy_review_missing'
				end,
				case
					when (source.canonical_storage_allowed or source.api_redistribution_allowed)
						and nullif(btrim(source.canonical_license_name), '') is null
						then 'license_missing'
				end,
				case
					when (source.canonical_storage_allowed or source.api_redistribution_allowed)
						and nullif(btrim(source.canonical_policy_notes), '') is null
						then 'policy_notes_missing'
				end,
				case
					when (source.canonical_storage_allowed or source.api_redistribution_allowed)
						and nullif(btrim(source.attribution_text), '') is null
						then 'attribution_missing'
				end
			], null)),
			'metrics', jsonb_build_object(
				'windowDays', v_days,
				'lookups', coalesce(metric.lookup_count, 0),
				'completedLookups', coalesce(metric.completed_lookup_count, 0),
				'apiRequests', coalesce(metric.api_request_count, 0),
				'apiErrors', coalesce(metric.api_error_count, 0),
				'cacheHits', coalesce(metric.cache_hit_count, 0),
				'matches', coalesce(metric.match_count, 0),
				'exactBarcodeMatches', coalesce(metric.exact_barcode_match_count, 0),
				'evaluatedProducts', coalesce(metric.evaluated_product_count, 0),
				'reportedNutrients', coalesce(metric.reported_nutrient_total, 0),
				'brandCoverage', coalesce(metric.brand_present_count, 0),
				'categoryCoverage', coalesce(metric.category_present_count, 0),
				'servingCoverage', coalesce(metric.serving_present_count, 0),
				'ingredientCoverage', coalesce(metric.ingredients_present_count, 0),
				'imageCoverage', coalesce(metric.image_present_count, 0),
				'averageResponseMilliseconds', case
					when coalesce(metric.completed_lookup_count, 0) > 0
						then round(
							metric.response_milliseconds_total::numeric
							/ metric.completed_lookup_count,
							1
						)
					else null
				end
			),
			'latestEvaluation', case
				when evaluation.id is null then null
				else jsonb_build_object(
					'kind', evaluation.evaluation_kind,
					'decision', evaluation.decision,
					'summary', evaluation.summary,
					'evaluatedAt', evaluation.evaluated_at,
					'sampleSize', evaluation.sample_size,
					'matchedCount', evaluation.matched_count,
					'usableCount', evaluation.usable_count,
					'evidenceUrl', evaluation.evidence_url
				)
			end
		)
		order by source.display_name, source.key
	), '[]'::jsonb)
	into v_sources
	from public.product_data_sources source
	left join lateral (
		select
			sum(daily.lookup_count)::bigint as lookup_count,
			sum(daily.completed_lookup_count)::bigint as completed_lookup_count,
			sum(daily.api_request_count)::bigint as api_request_count,
			sum(daily.api_error_count)::bigint as api_error_count,
			sum(daily.cache_hit_count)::bigint as cache_hit_count,
			sum(daily.match_count)::bigint as match_count,
			sum(daily.exact_barcode_match_count)::bigint as exact_barcode_match_count,
			sum(daily.evaluated_product_count)::bigint as evaluated_product_count,
			sum(daily.reported_nutrient_total)::bigint as reported_nutrient_total,
			sum(daily.brand_present_count)::bigint as brand_present_count,
			sum(daily.category_present_count)::bigint as category_present_count,
			sum(daily.serving_present_count)::bigint as serving_present_count,
			sum(daily.ingredients_present_count)::bigint as ingredients_present_count,
			sum(daily.image_present_count)::bigint as image_present_count,
			sum(daily.response_milliseconds_total)::bigint as response_milliseconds_total
		from public.product_source_daily_metrics daily
		where daily.source_key = source.key
			and daily.metric_date >= current_date - (v_days - 1)
	) metric on true
	left join lateral (
		select source_evaluation.*
		from public.product_source_evaluations source_evaluation
		where source_evaluation.source_key = source.key
		order by source_evaluation.evaluated_at desc, source_evaluation.id desc
		limit 1
	) evaluation on true
	where source.enabled
		or coalesce(metric.lookup_count, 0) > 0
		or evaluation.id is not null;

	select coalesce(jsonb_agg(
		jsonb_build_object(
			'key', dataset.key,
			'sourceKey', dataset.source_key,
			'displayName', dataset.display_name,
			'version', dataset.version,
			'regionCode', dataset.region_code,
			'licenseName', dataset.license_name,
			'licenseReviewStatus', dataset.license_review_status,
			'importEnabled', dataset.import_enabled,
			'active', dataset.active,
			'importedAt', dataset.imported_at,
			'checksumRecorded', dataset.source_file_sha256 is not null,
			'foodCount', dataset.food_count,
			'nutrientValueCount', dataset.nutrient_value_count,
			'measureCount', dataset.measure_count,
			'issues', to_jsonb(array_remove(array[
				case
					when dataset.license_review_status <> 'approved'
						then 'license_review_required'
				end,
				case
					when dataset.import_enabled and dataset.imported_at is null
						then 'import_not_recorded'
				end,
				case
					when dataset.import_enabled and dataset.source_file_sha256 is null
						then 'checksum_missing'
				end
			], null))
		)
		order by dataset.display_name, dataset.key
	), '[]'::jsonb)
	into v_datasets
	from public.generic_food_datasets dataset;

	select coalesce((
		select jsonb_build_object(
			'version', policy.version_number,
			'effectiveAt', policy.effective_at,
			'reviewedAt', policy.reviewed_at,
			'bundleHash', policy.bundle_content_hash,
			'changeSummary', policy.change_summary,
			'sourceReferenceCount', jsonb_array_length(policy.source_references),
			'selectablePreferenceCount', (
				select count(*)
				from public.food_compatibility_policy_coverage coverage
				where coverage.selectable
			),
			'coverageGapCount', (
				select count(*)
				from public.food_compatibility_policy_coverage coverage
				where coverage.selectable
					and (
						coalesce(coverage.conflict_count, 0) = 0
						or coalesce(coverage.evidence_rule_count, 0) = 0
					)
			),
			'pendingPreferenceMappingCount', (
				select count(*)
				from public.food_preference_mapping_requests request
				where request.status = 'pending'
			)
		)
		from public.food_compatibility_policy_versions policy
		where policy.status = 'active'
		order by policy.version_number desc
		limit 1
	), jsonb_build_object(
		'version', null,
		'effectiveAt', null,
		'reviewedAt', null,
		'bundleHash', null,
		'changeSummary', null,
		'sourceReferenceCount', 0,
		'selectablePreferenceCount', 0,
		'coverageGapCount', 0,
		'pendingPreferenceMappingCount', 0
	))
	into v_policy;

	select jsonb_build_object(
		'conflicts', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', issue.id,
				'productId', issue.shared_product_id,
				'barcode', issue.barcode,
				'productName', issue.product_name,
				'fieldPath', issue.field_path,
				'severity', issue.severity,
				'createdAt', issue.created_at
			) order by issue.created_at, issue.id)
			from (
				select
					conflict.id,
					conflict.shared_product_id,
					conflict.barcode,
					product.product_name,
					conflict.field_path,
					conflict.severity,
					conflict.created_at
				from public.shared_product_conflicts conflict
				join public.shared_products product on product.id = conflict.shared_product_id
				where conflict.status = 'open'
				order by conflict.created_at, conflict.id
				limit v_issue_limit
			) issue
		), '[]'::jsonb),
		'publication', coalesce((
			select jsonb_agg(jsonb_build_object(
				'productId', issue.shared_product_id,
				'barcode', issue.barcode,
				'productName', issue.product_name,
				'reasons', to_jsonb(issue.reasons)
			) order by issue.product_name, issue.shared_product_id)
			from (
				select
					readiness.shared_product_id,
					readiness.barcode,
					readiness.product_name,
					coalesce(readiness.reasons, '{}'::text[]) as reasons
				from public.blendcalc_api_v1_product_readiness readiness
				where not readiness.publishable
				order by readiness.product_name, readiness.shared_product_id
				limit v_issue_limit
			) issue
		), '[]'::jsonb),
		'nutrientMappings', coalesce((
			select jsonb_agg(jsonb_build_object(
				'sourceKey', issue.source_key,
				'sourceNutrientKey', issue.source_nutrient_key,
				'sourceNutrientName', issue.source_nutrient_name,
				'sourceUnitName', issue.source_unit_name,
				'reviewStatus', issue.review_status,
				'reviewReference', issue.review_reference
			) order by issue.source_key, issue.source_nutrient_key, issue.source_unit_name)
			from (
				select
					mapping.source_key,
					mapping.source_nutrient_key,
					mapping.source_nutrient_name,
					mapping.source_unit_name,
					mapping.review_status,
					mapping.review_reference
				from public.nutrient_source_mappings mapping
				where mapping.review_status <> 'approved'
					or mapping.reviewed_at is null
					or nullif(btrim(mapping.review_reference), '') is null
				order by mapping.source_key, mapping.source_nutrient_key, mapping.source_unit_name
				limit v_issue_limit
			) issue
		), '[]'::jsonb),
		'revisions', coalesce((
			select jsonb_agg(jsonb_build_object(
				'productId', issue.product_id,
				'barcode', issue.barcode,
				'productName', issue.product_name,
				'issue', issue.issue
			) order by issue.product_name, issue.product_id)
			from (
				select
					product.id as product_id,
					product.barcode,
					product.product_name,
					case
						when not exists (
							select 1
							from public.shared_product_revisions revision
							where revision.shared_product_id = product.id
						) then 'missing_revision'
						else 'unexplained_revision'
					end as issue
				from public.shared_products product
				where product.status = 'active'
					and (
						not exists (
							select 1
							from public.shared_product_revisions revision
							where revision.shared_product_id = product.id
						)
						or exists (
							select 1
							from public.shared_product_revisions revision
							where revision.shared_product_id = product.id
								and revision.revision_number > 1
								and not exists (
									select 1
									from public.shared_product_revision_changes revision_change
									where revision_change.revision_id = revision.id
								)
						)
					)
				order by product.product_name, product.id
				limit v_issue_limit
			) issue
		), '[]'::jsonb)
	)
	into v_issues;

	return jsonb_build_object(
		'generatedAt', now(),
		'metricWindowDays', v_days,
		'issueLimit', v_issue_limit,
		'overview', v_overview,
		'sources', v_sources,
		'datasets', v_datasets,
		'policy', v_policy,
		'issues', v_issues
	);
end;
$$;

revoke all on function public.get_moderator_data_health(integer, integer)
	from public, anon, authenticated;
grant execute on function public.get_moderator_data_health(integer, integer)
	to authenticated;

comment on function public.get_moderator_data_health(integer, integer) is
	'Moderator/admin-only bounded data-health aggregates and issue summaries. Raw provider payloads, private evidence, user identities, and secrets are excluded.';
