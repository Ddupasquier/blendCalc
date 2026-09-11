create table public.generic_food_dataset_import_evidence_runs (
	id uuid primary key default gen_random_uuid(),
	dataset_key text not null references public.generic_food_datasets(key) on delete restrict,
	mode text not null check (mode in ('preview', 'apply')),
	outcome text not null check (
		outcome in ('candidate', 'no_change', 'already_complete', 'applied')
	),
	preview_run_id uuid references public.generic_food_dataset_import_evidence_runs(id) on delete restrict,
	release_version text not null check (btrim(release_version) <> ''),
	expected_dataset_updated_at timestamptz not null,
	previous_imported_at timestamptz,
	proposed_imported_at timestamptz,
	previous_source_file_sha256 text,
	proposed_source_file_sha256 text,
	evidence_reference text not null check (
		evidence_reference ~ '^https://[^[:space:]]+$'
		and char_length(evidence_reference) <= 500
	),
	review_note text check (
		review_note is null
		or (char_length(btrim(review_note)) between 10 and 2000)
	),
	recorded_by uuid not null references auth.users(id) on delete restrict,
	created_at timestamptz not null default now(),
	check (
		(mode = 'preview' and preview_run_id is null and review_note is null)
		or (mode = 'apply' and preview_run_id is not null and review_note is not null)
	),
	check (
		(mode = 'preview' and outcome in ('candidate', 'no_change', 'already_complete'))
		or (mode = 'apply' and outcome = 'applied')
	),
	check (
		previous_source_file_sha256 is null
		or previous_source_file_sha256 ~ '^[a-f0-9]{64}$'
	),
	check (
		proposed_source_file_sha256 is null
		or proposed_source_file_sha256 ~ '^[a-f0-9]{64}$'
	)
);

create index generic_food_dataset_import_evidence_runs_dataset_idx
	on public.generic_food_dataset_import_evidence_runs (
		dataset_key,
		created_at desc,
		id desc
	);

create unique index generic_food_dataset_import_evidence_runs_apply_once_idx
	on public.generic_food_dataset_import_evidence_runs (preview_run_id)
	where mode = 'apply';

alter table public.generic_food_dataset_import_evidence_runs enable row level security;
alter table public.generic_food_dataset_import_evidence_runs force row level security;

revoke all on table public.generic_food_dataset_import_evidence_runs
	from public, anon, authenticated;
grant select on table public.generic_food_dataset_import_evidence_runs to service_role;

create or replace function public.get_dataset_import_evidence_workspace(
	p_dataset_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_dataset public.generic_food_datasets%rowtype;
	v_source_display_name text;
	v_latest_apply public.generic_food_dataset_import_evidence_runs%rowtype;
begin
	if not public.authorize_app_permission('data_operations.catalog_health.repair') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified dataset evidence access is required.';
	end if;

	select dataset.*
	into v_dataset
	from public.generic_food_datasets dataset
	where dataset.key = p_dataset_key;

	if not found then
		raise exception using
			errcode = 'P0002',
			message = 'Dataset release was not found.';
	end if;

	select source.display_name
	into v_source_display_name
	from public.product_data_sources source
	where source.key = v_dataset.source_key;

	select run.*
	into v_latest_apply
	from public.generic_food_dataset_import_evidence_runs run
	where run.dataset_key = v_dataset.key
		and run.mode = 'apply'
	order by run.created_at desc, run.id desc
	limit 1;

	return jsonb_build_object(
		'dataset', jsonb_build_object(
			'key', v_dataset.key,
			'displayName', v_dataset.display_name,
			'version', v_dataset.version,
			'regionCode', v_dataset.region_code,
			'sourceKey', v_dataset.source_key,
			'sourceDisplayName', coalesce(v_source_display_name, v_dataset.source_key),
			'sourceUrl', v_dataset.source_url,
			'licenseName', v_dataset.license_name,
			'licenseUrl', v_dataset.license_url,
			'licenseReviewStatus', v_dataset.license_review_status,
			'importEnabled', v_dataset.import_enabled,
			'active', v_dataset.active,
			'importedAt', v_dataset.imported_at,
			'sourceFileSha256', v_dataset.source_file_sha256,
			'foodCount', v_dataset.food_count,
			'nutrientValueCount', v_dataset.nutrient_value_count,
			'measureCount', v_dataset.measure_count,
			'updatedAt', v_dataset.updated_at,
			'evidenceReference', nullif(
				btrim(v_dataset.metadata -> 'importEvidence' ->> 'sourceReference'),
				''
			)
		),
		'missingEvidence', to_jsonb(array_remove(array[
			case when v_dataset.imported_at is null then 'imported_at' end,
			case when v_dataset.source_file_sha256 is null then 'source_file_sha256' end
		], null)),
		'actionRequired', v_dataset.import_enabled
			and (v_dataset.imported_at is null or v_dataset.source_file_sha256 is null),
		'responsibleRole', 'Administrator or developer with data-repair access',
		'latestDecision', case
			when v_latest_apply.id is null then null
			else jsonb_build_object(
				'id', v_latest_apply.id,
				'outcome', v_latest_apply.outcome,
				'evidenceReference', v_latest_apply.evidence_reference,
				'reviewNote', v_latest_apply.review_note,
				'recordedAt', v_latest_apply.created_at
			)
		end
	);
end;
$$;

create or replace function public.preview_dataset_import_evidence(
	p_dataset_key text,
	p_release_version text,
	p_imported_at timestamptz,
	p_source_file_sha256 text,
	p_evidence_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_dataset public.generic_food_datasets%rowtype;
	v_imported_at timestamptz := p_imported_at;
	v_checksum text := lower(nullif(btrim(coalesce(p_source_file_sha256, '')), ''));
	v_reference text := nullif(btrim(coalesce(p_evidence_reference, '')), '');
	v_outcome text;
	v_preview_id uuid := gen_random_uuid();
	v_proposed_imported_at timestamptz;
	v_proposed_checksum text;
begin
	if not public.authorize_app_permission('data_operations.catalog_health.repair') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified dataset evidence access is required.';
	end if;

	if p_dataset_key is null or p_dataset_key !~ '^[a-z0-9][a-z0-9._-]{0,99}$' then
		raise exception 'The dataset identifier is invalid.';
	end if;
	if p_release_version is null or char_length(btrim(p_release_version)) > 100 then
		raise exception 'The dataset release version is invalid.';
	end if;
	if v_reference is null
		or char_length(v_reference) > 500
		or v_reference !~ '^https://[^[:space:]]+$'
	then
		raise exception 'A valid HTTPS evidence reference is required.';
	end if;
	if v_checksum is not null and v_checksum !~ '^[a-f0-9]{64}$' then
		raise exception 'The source file checksum must be a 64-character SHA-256 value.';
	end if;
	if v_imported_at is not null
		and (v_imported_at < '2000-01-01T00:00:00Z'::timestamptz or v_imported_at > now() + interval '5 minutes')
	then
		raise exception 'The import completion time is outside the accepted range.';
	end if;

	select dataset.*
	into v_dataset
	from public.generic_food_datasets dataset
	where dataset.key = p_dataset_key
	for update;

	if not found then
		raise exception using
			errcode = 'P0002',
			message = 'Dataset release was not found.';
	end if;
	if not v_dataset.import_enabled then
		raise exception 'This dataset release is not enabled for import.';
	end if;
	if btrim(p_release_version) <> v_dataset.version then
		raise exception 'The confirmed release version does not match the stored dataset release.';
	end if;
	if v_dataset.license_review_status <> 'approved' then
		raise exception 'Dataset import evidence cannot be recorded until the license review is approved.';
	end if;
	if v_dataset.imported_at is not null
		and v_imported_at is not null
		and v_dataset.imported_at <> v_imported_at
	then
		raise exception 'Existing import completion evidence cannot be replaced in this workflow.';
	end if;
	if v_dataset.source_file_sha256 is not null
		and v_checksum is not null
		and v_dataset.source_file_sha256 <> v_checksum
	then
		raise exception 'Existing checksum evidence cannot be replaced in this workflow.';
	end if;

	v_proposed_imported_at := coalesce(v_dataset.imported_at, v_imported_at);
	v_proposed_checksum := coalesce(v_dataset.source_file_sha256, v_checksum);

	v_outcome := case
		when v_dataset.imported_at is not null and v_dataset.source_file_sha256 is not null
			then 'already_complete'
		when v_proposed_imported_at is null or v_proposed_checksum is null
			then 'no_change'
		else 'candidate'
	end;

	insert into public.generic_food_dataset_import_evidence_runs (
		id,
		dataset_key,
		mode,
		outcome,
		release_version,
		expected_dataset_updated_at,
		previous_imported_at,
		proposed_imported_at,
		previous_source_file_sha256,
		proposed_source_file_sha256,
		evidence_reference,
		recorded_by
	)
	values (
		v_preview_id,
		v_dataset.key,
		'preview',
		v_outcome,
		v_dataset.version,
		v_dataset.updated_at,
		v_dataset.imported_at,
		v_proposed_imported_at,
		v_dataset.source_file_sha256,
		v_proposed_checksum,
		v_reference,
		auth.uid()
	);

	return jsonb_build_object(
		'previewId', v_preview_id,
		'datasetKey', v_dataset.key,
		'outcome', v_outcome,
		'releaseVersion', v_dataset.version,
		'previousImportedAt', v_dataset.imported_at,
		'proposedImportedAt', v_proposed_imported_at,
		'previousSourceFileSha256', v_dataset.source_file_sha256,
		'proposedSourceFileSha256', v_proposed_checksum,
		'evidenceReference', v_reference,
		'willRecordImportTime', v_dataset.imported_at is null and v_proposed_imported_at is not null,
		'willRecordChecksum', v_dataset.source_file_sha256 is null and v_proposed_checksum is not null,
		'willClearFinding', v_outcome = 'candidate'
	);
end;
$$;

create or replace function public.apply_dataset_import_evidence(
	p_preview_run_id uuid,
	p_review_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_preview public.generic_food_dataset_import_evidence_runs%rowtype;
	v_dataset public.generic_food_datasets%rowtype;
	v_review_note text := btrim(coalesce(p_review_note, ''));
	v_apply_id uuid := gen_random_uuid();
	v_updated_at timestamptz;
begin
	if not public.authorize_app_permission('data_operations.catalog_health.repair') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified dataset evidence access is required.';
	end if;
	if char_length(v_review_note) not between 10 and 2000 then
		raise exception 'A private review note between 10 and 2000 characters is required.';
	end if;

	select run.*
	into v_preview
	from public.generic_food_dataset_import_evidence_runs run
	where run.id = p_preview_run_id
		and run.mode = 'preview'
	for update;

	if not found then
		raise exception using
			errcode = 'P0002',
			message = 'Dataset evidence preview was not found.';
	end if;
	if v_preview.recorded_by <> auth.uid() then
		raise exception using
			errcode = '42501',
			message = 'Only the operator who created this preview may apply it.';
	end if;
	if v_preview.outcome <> 'candidate' then
		raise exception 'This preview does not contain a complete evidence change.';
	end if;
	if v_preview.created_at < now() - interval '1 hour' then
		raise exception 'This evidence preview has expired. Preview the current dataset again.';
	end if;
	if exists (
		select 1
		from public.generic_food_dataset_import_evidence_runs run
		where run.preview_run_id = v_preview.id
			and run.mode = 'apply'
	) then
		raise exception 'This evidence preview has already been applied.';
	end if;

	select dataset.*
	into v_dataset
	from public.generic_food_datasets dataset
	where dataset.key = v_preview.dataset_key
	for update;

	if not found then
		raise exception using
			errcode = 'P0002',
			message = 'Dataset release was not found.';
	end if;
	if v_dataset.updated_at <> v_preview.expected_dataset_updated_at
		or v_dataset.version <> v_preview.release_version
		or v_dataset.imported_at is distinct from v_preview.previous_imported_at
		or v_dataset.source_file_sha256 is distinct from v_preview.previous_source_file_sha256
	then
		raise exception 'The dataset changed after this preview. Preview the current evidence again.';
	end if;

	update public.generic_food_datasets dataset
	set
		imported_at = v_preview.proposed_imported_at,
		source_file_sha256 = v_preview.proposed_source_file_sha256,
		metadata = jsonb_set(
			coalesce(dataset.metadata, '{}'::jsonb),
			'{importEvidence}',
			jsonb_build_object(
				'sourceReference', v_preview.evidence_reference,
				'releaseVersion', v_preview.release_version,
				'recordedAt', now(),
				'decisionId', v_apply_id
			),
			true
		)
	where dataset.key = v_dataset.key
	returning dataset.updated_at into v_updated_at;

	if exists (
		select 1
		from public.catalog_health_issue_occurrences occurrence
		where occurrence.subject_type = 'generic_food_dataset'
			and occurrence.subject_key = v_dataset.key
			and occurrence.issue_code = 'DATASET_IMPORT_EVIDENCE_MISSING'
	) then
		raise exception 'The dataset evidence failed its health recheck; no changes were saved.';
	end if;

	insert into public.generic_food_dataset_import_evidence_runs (
		id,
		dataset_key,
		mode,
		outcome,
		preview_run_id,
		release_version,
		expected_dataset_updated_at,
		previous_imported_at,
		proposed_imported_at,
		previous_source_file_sha256,
		proposed_source_file_sha256,
		evidence_reference,
		review_note,
		recorded_by
	)
	values (
		v_apply_id,
		v_dataset.key,
		'apply',
		'applied',
		v_preview.id,
		v_preview.release_version,
		v_preview.expected_dataset_updated_at,
		v_preview.previous_imported_at,
		v_preview.proposed_imported_at,
		v_preview.previous_source_file_sha256,
		v_preview.proposed_source_file_sha256,
		v_preview.evidence_reference,
		v_review_note,
		auth.uid()
	);

	return jsonb_build_object(
		'runId', v_apply_id,
		'previewId', v_preview.id,
		'datasetKey', v_dataset.key,
		'outcome', 'applied',
		'importedAt', v_preview.proposed_imported_at,
		'sourceFileSha256', v_preview.proposed_source_file_sha256,
		'evidenceReference', v_preview.evidence_reference,
		'updatedAt', v_updated_at,
		'findingCleared', true
	);
end;
$$;

revoke all on function public.get_dataset_import_evidence_workspace(text)
	from public, anon, authenticated, service_role;
grant execute on function public.get_dataset_import_evidence_workspace(text)
	to authenticated;

revoke all on function public.preview_dataset_import_evidence(text, text, timestamptz, text, text)
	from public, anon, authenticated, service_role;
grant execute on function public.preview_dataset_import_evidence(text, text, timestamptz, text, text)
	to authenticated;

revoke all on function public.apply_dataset_import_evidence(uuid, text)
	from public, anon, authenticated, service_role;
grant execute on function public.apply_dataset_import_evidence(uuid, text)
	to authenticated;

comment on table public.generic_food_dataset_import_evidence_runs is
	'Append-only AAL2 preview and apply history for canonical dataset import evidence. Dataset fields and metadata remain the evidence authority.';

comment on function public.get_dataset_import_evidence_workspace(text) is
	'Returns one bounded dataset release, its current import evidence, and latest completed review to an AAL2 data-repair operator.';

comment on function public.preview_dataset_import_evidence(text, text, timestamptz, text, text) is
	'Validates a proposed completion time, SHA-256, release identity, and HTTPS source reference without changing canonical dataset evidence.';

comment on function public.apply_dataset_import_evidence(uuid, text) is
	'Applies one current same-operator evidence preview, records immutable history, and fails closed unless the owning health finding clears.';
