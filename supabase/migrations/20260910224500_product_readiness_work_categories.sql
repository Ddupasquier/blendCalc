alter table public.catalog_health_review_dispositions
	drop constraint catalog_health_review_dispositions_outcome_check;

alter table public.catalog_health_review_dispositions
	add constraint catalog_health_review_dispositions_outcome_check
	check (outcome in ('accepted_withheld', 'accepted_evidence_gap'));

create function private.catalog_health_product_diagnostic_fingerprint(
	p_shared_product_id uuid
)
returns text
language sql
stable
set search_path = ''
as $$
	select md5(
		string_agg(
			occurrence.occurrence_key || ':' || occurrence.detected_at::text
				|| ':' || occurrence.source_reason || ':' || occurrence.parameters::text,
			chr(10)
			order by occurrence.occurrence_key
		)
		|| ':' || product.updated_at::text
		|| ':' || coalesce((
			select md5(string_agg(
				observation.id::text || ':' || observation.created_at::text,
				chr(10)
				order by observation.id
			))
			from public.shared_product_observations observation
			where observation.barcode = product.barcode
		), '')
		|| ':' || coalesce((
			select md5(string_agg(
				submission.id::text || ':' || submission.updated_at::text
					|| ':' || submission.status,
				chr(10)
				order by submission.id
			))
			from public.shared_product_submissions submission
			where submission.barcode = product.barcode
		), '')
	)
	from public.catalog_health_issue_occurrences occurrence
	join public.shared_products product
		on product.id = occurrence.shared_product_id
	where occurrence.shared_product_id = p_shared_product_id
		and occurrence.source_scope <> 'blendcalc_api_publication'
		and occurrence.status = 'open'
	group by product.id, product.barcode, product.updated_at;
$$;

revoke all on function private.catalog_health_product_diagnostic_fingerprint(uuid)
	from public, anon, authenticated;
grant execute on function private.catalog_health_product_diagnostic_fingerprint(uuid)
	to service_role;

create or replace view public.catalog_health_actionable_issue_occurrences
with (security_invoker = true)
as
select occurrence.*
from public.catalog_health_issue_occurrences occurrence
where occurrence.shared_product_id is null
	or (
		occurrence.source_scope = 'blendcalc_api_publication'
		and not exists (
			select 1
			from public.catalog_health_review_dispositions disposition
			where disposition.shared_product_id = occurrence.shared_product_id
				and disposition.outcome = 'accepted_withheld'
				and disposition.issue_fingerprint =
					private.catalog_health_product_issue_fingerprint(
						occurrence.shared_product_id
					)
		)
	)
	or (
		occurrence.source_scope <> 'blendcalc_api_publication'
		and not exists (
			select 1
			from public.catalog_health_review_dispositions disposition
			where disposition.shared_product_id = occurrence.shared_product_id
				and disposition.outcome = 'accepted_evidence_gap'
				and disposition.issue_fingerprint =
					private.catalog_health_product_diagnostic_fingerprint(
						occurrence.shared_product_id
					)
		)
	);

revoke all on table public.catalog_health_actionable_issue_occurrences
	from public, anon, authenticated;
grant select on table public.catalog_health_actionable_issue_occurrences
	to service_role;

create function public.finish_catalog_health_product_diagnostic_review(
	p_shared_product_id uuid,
	p_review_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_issue_fingerprint text;
	v_issue_snapshot jsonb;
	v_issue_count integer;
	v_unchecked_repair_count integer;
	v_reviewed_at timestamptz;
begin
	if not public.authorize_app_permission(
		'data_operations.catalog_health.repair'
	) then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog repair access is required.';
	end if;

	p_review_note := btrim(coalesce(p_review_note, ''));
	if char_length(p_review_note) < 10 or char_length(p_review_note) > 2000 then
		raise exception using
			errcode = '22023',
			message = 'A review note between 10 and 2000 characters is required.';
	end if;

	if not exists (
		select 1
		from public.shared_products product
		where product.id = p_shared_product_id
	) then
		raise exception using
			errcode = 'P0002',
			message = 'Catalog product was not found.';
	end if;

	v_issue_fingerprint :=
		private.catalog_health_product_diagnostic_fingerprint(p_shared_product_id);

	if v_issue_fingerprint is null then
		raise exception using
			errcode = 'P0002',
			message = 'This product has no current catalog-evidence follow-up.';
	end if;

	if exists (
		select 1
		from public.catalog_health_review_dispositions disposition
		where disposition.shared_product_id = p_shared_product_id
			and disposition.issue_fingerprint = v_issue_fingerprint
			and disposition.outcome = 'accepted_evidence_gap'
	) then
		raise exception using
			errcode = 'P0002',
			message = 'This catalog-evidence review is already finished.';
	end if;

	select count(*)::integer
	into v_unchecked_repair_count
	from public.catalog_health_actionable_issue_occurrences occurrence
	join public.app_issue_codes issue on issue.code = occurrence.issue_code
	where occurrence.shared_product_id = p_shared_product_id
		and occurrence.source_scope <> 'blendcalc_api_publication'
		and occurrence.status = 'open'
		and issue.enabled
		and issue.automated_repair_allowed
		and nullif(btrim(issue.automated_repair_key), '') is not null
		and not exists (
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
		);

	if v_unchecked_repair_count > 0 then
		raise exception using
			errcode = 'P0001',
			message = 'Run every available catalog-evidence check before finishing this review.';
	end if;

	select
		count(*)::integer,
		coalesce(jsonb_agg(jsonb_build_object(
			'occurrenceKey', occurrence.occurrence_key,
			'issueCode', occurrence.issue_code,
			'sourceScope', occurrence.source_scope,
			'sourceReason', occurrence.source_reason,
			'parameters', occurrence.parameters,
			'detectedAt', occurrence.detected_at
		) order by occurrence.occurrence_key), '[]'::jsonb)
	into v_issue_count, v_issue_snapshot
	from public.catalog_health_actionable_issue_occurrences occurrence
	where occurrence.shared_product_id = p_shared_product_id
		and occurrence.source_scope <> 'blendcalc_api_publication'
		and occurrence.status = 'open';

	if v_issue_count = 0 then
		raise exception using
			errcode = 'P0002',
			message = 'This product has no current catalog-evidence follow-up.';
	end if;

	insert into public.catalog_health_review_dispositions (
		shared_product_id,
		issue_fingerprint,
		outcome,
		review_note,
		issue_count,
		issue_snapshot,
		reviewed_by
	)
	values (
		p_shared_product_id,
		v_issue_fingerprint,
		'accepted_evidence_gap',
		p_review_note,
		v_issue_count,
		v_issue_snapshot,
		(select auth.uid())
	)
	returning reviewed_at into v_reviewed_at;

	return jsonb_build_object(
		'outcome', 'accepted_evidence_gap',
		'issueCount', v_issue_count,
		'reviewedAt', v_reviewed_at
	);
end;
$$;

revoke all on function public.finish_catalog_health_product_diagnostic_review(uuid, text)
	from public, anon, authenticated, service_role;
grant execute on function public.finish_catalog_health_product_diagnostic_review(uuid, text)
	to authenticated;

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
			where occurrence.occurrence_key = issue.value ->> 'occurrenceKey'
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

comment on function private.catalog_health_product_diagnostic_fingerprint(uuid) is
	'Fingerprints current nonpublication product diagnostics together with catalog and retained evidence state so new evidence reopens a completed follow-up.';
comment on function public.finish_catalog_health_product_diagnostic_review(uuid, text) is
	'Finishes one exact product evidence-follow-up snapshot after every available safe check is inconclusive. It changes neither canonical values nor blendCalcAPI publication status.';
comment on view public.catalog_health_actionable_issue_occurrences is
	'Open catalog-health work after removing exact accepted-withheld publication snapshots and exact accepted evidence-gap diagnostic snapshots until their relevant evidence changes.';
comment on function public.get_blendcalc_api_catalog_product_readiness_passport(uuid) is
	'Returns one bounded AAL2 product-readiness passport with explicit publication-blocker and nonblocking-diagnostic categories plus their independent completion state.';
