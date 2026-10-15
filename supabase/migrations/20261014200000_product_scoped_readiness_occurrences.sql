-- Bound the computed occurrence lookup before evaluating global readiness work.
-- The passport already contains issues for only p_shared_product_id.
create or replace function public.get_blendcalc_api_catalog_product_readiness_passport(
	p_shared_product_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
	with passport as (
		select private.build_catalog_product_readiness_passport(
			p_shared_product_id
		) as value
	),
	current_publication_fingerprint as (
		select private.catalog_health_product_issue_fingerprint(
			p_shared_product_id
		) as value
	),
	current_diagnostic_fingerprint as (
		select private.catalog_health_product_diagnostic_fingerprint(
			p_shared_product_id
		) as value
	),
	current_publication_disposition as (
		select disposition.*
		from public.catalog_health_review_dispositions disposition
		join current_publication_fingerprint fingerprint
			on fingerprint.value = disposition.issue_fingerprint
		where disposition.shared_product_id = p_shared_product_id
			and disposition.outcome = 'accepted_withheld'
		order by disposition.reviewed_at desc
		limit 1
	),
	current_diagnostic_disposition as (
		select disposition.*
		from public.catalog_health_review_dispositions disposition
		join current_diagnostic_fingerprint fingerprint
			on fingerprint.value = disposition.issue_fingerprint
		where disposition.shared_product_id = p_shared_product_id
			and disposition.outcome = 'accepted_evidence_gap'
		order by disposition.reviewed_at desc
		limit 1
	),
	actionable_issues as (
		select coalesce(jsonb_agg(
			(
				case
					when issue.value ->> 'sourceReason'
						like 'missing_required_nutrient:%'
						and nutrient.nutrient_name is not null
					then jsonb_set(
						issue.value,
						'{parameters}',
						coalesce(issue.value -> 'parameters', '{}'::jsonb)
							|| jsonb_build_object(
								'displayName', nutrient.nutrient_name
							),
						true
					)
					else issue.value
				end
			) || jsonb_build_object(
				'workCategory', case
					when issue.value ->> 'sourceScope' = 'blendcalc_api_publication'
					then 'publication_blocker'
					else 'catalog_diagnostic'
				end,
				'impact', case
					when issue.value ->> 'sourceScope' = 'blendcalc_api_publication'
					then 'blocks_publication'
					else 'does_not_block_publication'
				end
			)
			order by issue.ordinality
		), '[]'::jsonb) as value
		from passport
		cross join lateral jsonb_array_elements(
			passport.value -> 'issues'
		) with ordinality as issue(value, ordinality)
		left join public.nutrient_definitions nutrient
			on nutrient.nutrient_id = case
				when issue.value ->> 'sourceReason'
					~ '^missing_required_nutrient:[0-9]+$'
				then split_part(
					issue.value ->> 'sourceReason', ':', 2
				)::bigint
				else null
			end
		where exists (
			select 1
			from public.catalog_health_actionable_issue_occurrences occurrence
			where occurrence.shared_product_id = p_shared_product_id
				and occurrence.occurrence_key = issue.value ->> 'occurrenceKey'
		)
	),
	publication_completion as (
		select
			count(*) filter (
				where issue.automated_repair_allowed
					and nullif(btrim(issue.automated_repair_key), '') is not null
			)::integer as required_check_count,
			count(*) filter (
				where issue.automated_repair_allowed
					and nullif(btrim(issue.automated_repair_key), '') is not null
					and exists (
						select 1
						from public.catalog_health_repair_runs repair_run
						where repair_run.requested_by = (select auth.uid())
							and repair_run.occurrence_key = occurrence.occurrence_key
							and repair_run.repair_key = issue.automated_repair_key
							and repair_run.mode = 'dry_run'
							and repair_run.status in (
								'completed',
								'completed_with_unresolved'
							)
							and repair_run.candidate_count = 0
							and repair_run.started_at >= occurrence.detected_at
					)
			)::integer as completed_check_count,
			count(*)::integer as issue_count
		from public.catalog_health_actionable_issue_occurrences occurrence
		join public.app_issue_codes issue on issue.code = occurrence.issue_code
		where occurrence.shared_product_id = p_shared_product_id
			and occurrence.source_scope = 'blendcalc_api_publication'
			and occurrence.status = 'open'
			and issue.enabled
	),
	diagnostic_completion as (
		select
			count(*) filter (
				where issue.automated_repair_allowed
					and nullif(btrim(issue.automated_repair_key), '') is not null
			)::integer as required_check_count,
			count(*) filter (
				where issue.automated_repair_allowed
					and nullif(btrim(issue.automated_repair_key), '') is not null
					and exists (
						select 1
						from public.catalog_health_repair_runs repair_run
						where repair_run.requested_by = (select auth.uid())
							and repair_run.occurrence_key = occurrence.occurrence_key
							and repair_run.repair_key = issue.automated_repair_key
							and repair_run.mode = 'dry_run'
							and repair_run.status in (
								'completed',
								'completed_with_unresolved'
							)
							and repair_run.candidate_count = 0
							and repair_run.started_at >= occurrence.detected_at
					)
			)::integer as completed_check_count,
			count(*)::integer as issue_count
		from public.catalog_health_actionable_issue_occurrences occurrence
		join public.app_issue_codes issue on issue.code = occurrence.issue_code
		where occurrence.shared_product_id = p_shared_product_id
			and occurrence.source_scope <> 'blendcalc_api_publication'
			and occurrence.status = 'open'
			and issue.enabled
	)
	select jsonb_set(
		jsonb_set(
			passport.value,
			'{product}',
			((passport.value -> 'product') - 'apiV1Status'::text)
				|| jsonb_build_object(
					'blendCalcAPIV1Status',
					passport.value #> '{product,apiV1Status}'::text[]
				)
		),
		'{issues}',
		actionable_issues.value
	) || jsonb_build_object(
		'reviewCompletion', jsonb_build_object(
			'requiredSafeRepairCheckCount', publication.required_check_count,
			'completedSafeRepairCheckCount', publication.completed_check_count,
			'canFinish', publication.issue_count > 0
				and publication.completed_check_count = publication.required_check_count
		),
		'diagnosticReviewCompletion', jsonb_build_object(
			'requiredSafeRepairCheckCount', diagnostic.required_check_count,
			'completedSafeRepairCheckCount', diagnostic.completed_check_count,
			'canFinish', diagnostic.issue_count > 0
				and diagnostic.completed_check_count = diagnostic.required_check_count
		),
		'reviewDisposition', case
			when publication_disposition.id is null then null
			else jsonb_build_object(
				'outcome', publication_disposition.outcome,
				'reviewNote', publication_disposition.review_note,
				'issueCount', publication_disposition.issue_count,
				'reviewedAt', publication_disposition.reviewed_at
			)
		end,
		'diagnosticReviewDisposition', case
			when diagnostic_disposition.id is null then null
			else jsonb_build_object(
				'outcome', diagnostic_disposition.outcome,
				'reviewNote', diagnostic_disposition.review_note,
				'issueCount', diagnostic_disposition.issue_count,
				'reviewedAt', diagnostic_disposition.reviewed_at
			)
		end
	)
	from passport
	cross join actionable_issues
	cross join publication_completion publication
	cross join diagnostic_completion diagnostic
	left join current_publication_disposition publication_disposition on true
	left join current_diagnostic_disposition diagnostic_disposition on true;
$$;
