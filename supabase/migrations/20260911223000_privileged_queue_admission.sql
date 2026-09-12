alter table public.shared_product_submissions
	add column queue_resolution text
		check (
			queue_resolution is null
			or queue_resolution in (
				'already_available',
				'stale_revision',
				'catalog_now_exists'
			)
			and (queue_resolution is null or status = 'auto_declined')
		);

comment on column public.shared_product_submissions.queue_resolution is
	'Optional deterministic queue-admission outcome. already_available is an accepted no-op; stale_revision and catalog_now_exists require a fresh correction submission.';

create table public.privileged_queue_admission_decisions (
	id uuid primary key default gen_random_uuid(),
	queue_name text not null check (
		queue_name in ('product_submissions', 'provider_changes', 'catalog_conflicts')
	),
	subject_type text not null check (subject_type ~ '^[a-z][a-z0-9_]*$'),
	subject_key text not null check (btrim(subject_key) <> ''),
	evidence_fingerprint text not null check (evidence_fingerprint ~ '^[a-f0-9]{64}$'),
	outcome text not null check (outcome in ('auto_resolved', 'auto_routed')),
	reason_code text not null check (reason_code ~ '^[a-z][a-z0-9_]*$'),
	evidence_snapshot jsonb not null check (jsonb_typeof(evidence_snapshot) = 'object'),
	created_at timestamptz not null default now(),
	unique (queue_name, subject_key, evidence_fingerprint, outcome, reason_code)
);

create index privileged_queue_admission_decisions_recent_idx
	on public.privileged_queue_admission_decisions (created_at desc);

alter table public.privileged_queue_admission_decisions enable row level security;
alter table public.privileged_queue_admission_decisions force row level security;

revoke all on table public.privileged_queue_admission_decisions
	from public, anon, authenticated, service_role;
grant select, insert on table public.privileged_queue_admission_decisions
	to service_role;

create function public.prevent_privileged_queue_admission_decision_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	raise exception 'Privileged queue admission decisions are immutable';
end;
$$;

create trigger prevent_privileged_queue_admission_decision_changes
	before update or delete on public.privileged_queue_admission_decisions
	for each row execute function public.prevent_privileged_queue_admission_decision_changes();

revoke all on function public.prevent_privileged_queue_admission_decision_changes()
	from public, anon, authenticated, service_role;

create function private.privileged_queue_normalize_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
	select nullif(btrim(regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', ' ', 'g')), '');
$$;

create function private.catalog_provider_change_matches_current(
	p_review_id uuid
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
	v_review public.catalog_provider_change_reviews%rowtype;
	v_product public.shared_products%rowtype;
	v_snapshot public.catalog_provider_product_snapshots%rowtype;
	v_change jsonb;
	v_field text;
	v_observed jsonb;
	v_current jsonb;
	v_direct_provenance_path text;
begin
	select review.* into v_review
	from public.catalog_provider_change_reviews review
	where review.id = p_review_id;
	if not found then return false; end if;

	select product.* into v_product
	from public.shared_products product
	where product.id = v_review.shared_product_id
		and product.status = 'active';
	if not found then return false; end if;

	select snapshot.* into v_snapshot
	from public.catalog_provider_product_snapshots snapshot
	where snapshot.id = v_review.snapshot_id;
	if not found then return false; end if;

	for v_change in
		select value from jsonb_array_elements(v_review.change_summary -> 'changes')
	loop
		v_field := v_change ->> 'field';
		v_observed := v_change -> 'observedValue';
		v_direct_provenance_path := case v_field
			when 'productName' then 'productName'
			when 'brandOwner' then 'brandOwner'
			when 'serving' then 'serving'
			when 'ingredients' then 'ingredients'
			when 'allergens' then 'allergens'
			when 'traces' then 'traces'
			when 'precautionaryStatements' then 'precautionaryStatements'
			when 'categories' then 'categories'
			when 'package' then 'package'
			else null
		end;

		if v_direct_provenance_path is not null and exists (
			select 1
			from public.shared_product_field_provenance provenance
			where provenance.shared_product_id = v_product.id
				and provenance.observation_id = v_snapshot.observation_id
				and provenance.field_path = v_direct_provenance_path
				and provenance.selected
		) then
			continue;
		end if;

		if v_field = 'productName' then
			if private.privileged_queue_normalize_text(v_product.product_name)
				is distinct from private.privileged_queue_normalize_text(v_observed #>> '{}') then
				return false;
			end if;
		elsif v_field = 'brandOwner' then
			if private.privileged_queue_normalize_text(v_product.brand_owner)
				is distinct from private.privileged_queue_normalize_text(v_observed #>> '{}') then
				return false;
			end if;
		elsif v_field = 'ingredients'
			and jsonb_typeof(v_observed) = 'object'
			and coalesce(jsonb_array_length(coalesce(v_observed -> 'structured', '[]'::jsonb)), 0) = 0
			and coalesce(jsonb_array_length(coalesce(v_observed -> 'tags', '[]'::jsonb)), 0) = 0
			and coalesce(jsonb_array_length(coalesce(v_observed -> 'analysisTags', '[]'::jsonb)), 0) = 0 then
			if private.privileged_queue_normalize_text(v_product.food ->> 'ingredients')
				is distinct from private.privileged_queue_normalize_text(v_observed ->> 'text') then
				return false;
			end if;
		elsif v_field = 'package' then
			v_current := v_product.food -> 'packageQuantity';
			if v_current is distinct from v_observed then return false; end if;
		elsif v_field = 'alcoholByVolume' then
			v_current := v_product.food -> 'alcoholByVolume';
			if v_current is distinct from v_observed then return false; end if;
		else
			return false;
		end if;
	end loop;

	return true;
end;
$$;

create function private.catalog_conflict_values_are_equivalent(
	p_conflict_id uuid
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
	v_conflict public.shared_product_conflicts%rowtype;
	v_count integer;
	v_distinct_count integer;
begin
	select conflict.* into v_conflict
	from public.shared_product_conflicts conflict
	where conflict.id = p_conflict_id;
	if not found or v_conflict.field_path not in ('productName', 'brandOwner') then
		return false;
	end if;

	select count(*), count(distinct private.privileged_queue_normalize_text(value ->> 'value'))
	into v_count, v_distinct_count
	from jsonb_array_elements(v_conflict.observed_values) value;

	return v_count > 1 and v_distinct_count = 1;
end;
$$;

revoke all on function private.privileged_queue_normalize_text(text)
	from public, anon, authenticated;
revoke all on function private.catalog_provider_change_matches_current(uuid)
	from public, anon, authenticated;
revoke all on function private.catalog_conflict_values_are_equivalent(uuid)
	from public, anon, authenticated;
grant execute on function private.privileged_queue_normalize_text(text)
	to service_role;
grant execute on function private.catalog_provider_change_matches_current(uuid)
	to service_role;
grant execute on function private.catalog_conflict_values_are_equivalent(uuid)
	to service_role;

create function public.apply_catalog_queue_admission(
	p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
	v_review public.catalog_provider_change_reviews%rowtype;
	v_conflict public.shared_product_conflicts%rowtype;
	v_fingerprint text;
	v_reason text;
	v_provider_resolved integer := 0;
	v_conflicts_resolved integer := 0;
	v_conflicts_routed integer := 0;
begin
	if coalesce(auth.role(), '') <> 'service_role' then
		raise exception using errcode = '42501', message = 'Service-role queue admission is required.';
	end if;

	for v_review in
		select review.*
		from public.catalog_provider_change_reviews review
		where review.status = 'pending'
		order by review.created_at, review.id
		limit v_limit
		for update skip locked
	loop
		v_reason := null;
		if exists (
			select 1
			from public.catalog_provider_product_snapshots newer
			join public.catalog_provider_product_snapshots current_snapshot
				on current_snapshot.id = v_review.snapshot_id
			where newer.shared_product_id = v_review.shared_product_id
				and newer.provider_key = v_review.provider_key
				and (newer.observed_at, newer.created_at, newer.id)
					> (current_snapshot.observed_at, current_snapshot.created_at, current_snapshot.id)
		) then
			v_reason := 'newer_provider_snapshot';
		elsif private.catalog_provider_change_matches_current(v_review.id) then
			v_reason := 'already_reflected_in_catalog';
		end if;

		if v_reason is not null then
			v_fingerprint := encode(extensions.digest(
				concat_ws(':', v_review.id::text, v_review.snapshot_id::text,
					v_review.change_summary::text, v_reason), 'sha256'), 'hex');
			update public.shared_product_conflicts conflict
			set status = 'superseded',
				resolution_note = 'System queue admission: ' || replace(v_reason, '_', ' ') || '.',
				resolved_by = null,
				resolved_at = now()
			where conflict.shared_product_id = v_review.shared_product_id
				and conflict.status = 'open'
				and exists (
					select 1 from jsonb_array_elements(conflict.observed_values) evidence
					where evidence ->> 'snapshotId' = v_review.snapshot_id::text
				);

			update public.catalog_provider_change_reviews
			set status = 'superseded',
				reviewed_by = null,
				reviewed_at = now(),
				review_note = 'System queue admission: ' || replace(v_reason, '_', ' ') || '.'
			where id = v_review.id;

			insert into public.privileged_queue_admission_decisions (
				queue_name, subject_type, subject_key, evidence_fingerprint,
				outcome, reason_code, evidence_snapshot
			) values (
				'provider_changes', 'provider_change_review', v_review.id::text,
				v_fingerprint, 'auto_resolved', v_reason,
				jsonb_build_object(
					'sharedProductId', v_review.shared_product_id,
					'providerKey', v_review.provider_key,
					'snapshotId', v_review.snapshot_id,
					'changeSummary', v_review.change_summary
				)
			) on conflict do nothing;
			v_provider_resolved := v_provider_resolved + 1;
		end if;
	end loop;

	for v_conflict in
		select conflict.*
		from public.shared_product_conflicts conflict
		where conflict.status = 'open'
		order by conflict.created_at, conflict.id
		limit v_limit
		for update skip locked
	loop
		v_fingerprint := encode(extensions.digest(
			concat_ws(':', v_conflict.id::text, v_conflict.shared_product_id::text,
				v_conflict.field_path, v_conflict.observed_values::text,
				v_conflict.severity), 'sha256'), 'hex');

		if private.catalog_conflict_values_are_equivalent(v_conflict.id) then
			update public.shared_product_conflicts
			set status = 'resolved',
				resolution_note = 'System queue admission: normalized values are equivalent.',
				resolved_by = null,
				resolved_at = now()
			where id = v_conflict.id;
			insert into public.privileged_queue_admission_decisions (
				queue_name, subject_type, subject_key, evidence_fingerprint,
				outcome, reason_code, evidence_snapshot
			) values (
				'catalog_conflicts', 'catalog_conflict', v_conflict.id::text,
				v_fingerprint, 'auto_resolved', 'normalized_values_equivalent',
				jsonb_build_object(
					'sharedProductId', v_conflict.shared_product_id,
					'fieldPath', v_conflict.field_path,
					'observedValues', v_conflict.observed_values
				)
			) on conflict do nothing;
			v_conflicts_resolved := v_conflicts_resolved + 1;
		elsif exists (
			select 1
			from public.catalog_provider_change_reviews review
			where review.shared_product_id = v_conflict.shared_product_id
				and review.status = 'pending'
				and exists (
					select 1 from jsonb_array_elements(v_conflict.observed_values) evidence
					where evidence ->> 'snapshotId' = review.snapshot_id::text
				)
		) then
			insert into public.privileged_queue_admission_decisions (
				queue_name, subject_type, subject_key, evidence_fingerprint,
				outcome, reason_code, evidence_snapshot
			) values (
				'catalog_conflicts', 'catalog_conflict', v_conflict.id::text,
				v_fingerprint, 'auto_routed', 'owned_by_provider_change',
				jsonb_build_object(
					'sharedProductId', v_conflict.shared_product_id,
					'fieldPath', v_conflict.field_path,
					'observedValues', v_conflict.observed_values
				)
			) on conflict do nothing;
			v_conflicts_routed := v_conflicts_routed + 1;
		end if;
	end loop;

	return jsonb_build_object(
		'providerChangesResolved', v_provider_resolved,
		'conflictsResolved', v_conflicts_resolved,
		'conflictsRouted', v_conflicts_routed
	);
end;
$$;

revoke all on function public.apply_catalog_queue_admission(integer)
	from public, anon, authenticated, service_role;
grant execute on function public.apply_catalog_queue_admission(integer)
	to service_role;

create function public.resolve_catalog_submission_queue_admission(
	p_submission_id uuid,
	p_reason_code text,
	p_evidence_snapshot jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_submission public.shared_product_submissions%rowtype;
	v_product public.shared_products%rowtype;
	v_latest_revision_id uuid;
	v_queue_resolution text;
	v_evidence_fingerprint text;
begin
	if coalesce(auth.role(), '') <> 'service_role' then
		raise exception using errcode = '42501', message = 'Service-role queue admission is required.';
	end if;
	if jsonb_typeof(p_evidence_snapshot) <> 'object'
		or p_reason_code not in (
			'exact_current_catalog_match',
			'stale_base_revision',
			'catalog_product_now_exists'
		) then
		raise exception using errcode = '22023', message = 'Catalog-submission admission evidence is invalid.';
	end if;

	select submission.* into v_submission
	from public.shared_product_submissions submission
	where submission.id = p_submission_id
		and submission.status = 'pending'
	for update;
	if not found then return false; end if;

	select product.* into v_product
	from public.shared_products product
	where product.barcode = v_submission.barcode
		and product.status = 'active';
	if not found or p_evidence_snapshot ->> 'sharedProductId' is distinct from v_product.id::text then
		return false;
	end if;

	select revision.id into v_latest_revision_id
	from public.shared_product_revisions revision
	where revision.shared_product_id = v_product.id
	order by revision.revision_number desc
	limit 1;
	if p_evidence_snapshot ->> 'latestRevisionId' is distinct from v_latest_revision_id::text then
		return false;
	end if;

	if p_reason_code = 'exact_current_catalog_match' then
		v_queue_resolution := 'already_available';
	elsif p_reason_code = 'stale_base_revision'
		and v_submission.submission_kind = 'product_update'
		and v_submission.base_revision_id is distinct from v_latest_revision_id then
		v_queue_resolution := 'stale_revision';
	elsif p_reason_code = 'catalog_product_now_exists'
		and v_submission.submission_kind = 'new_product' then
		v_queue_resolution := 'catalog_now_exists';
	else
		return false;
	end if;
	v_evidence_fingerprint := encode(
		extensions.digest(p_evidence_snapshot::text, 'sha256'),
		'hex'
	);

	update public.shared_product_submissions
	set status = 'auto_declined',
		queue_resolution = v_queue_resolution,
		reviewed_by = null,
		reviewed_at = now(),
		review_note = case v_queue_resolution
			when 'already_available' then 'System queue admission: the submitted values are already present in the active catalog.'
			when 'stale_revision' then 'System queue admission: a newer catalog revision exists; submit any remaining differences against that revision.'
			else 'System queue admission: this barcode is now an active catalog product; submit differences as a catalog correction.'
		end
	where id = v_submission.id;

	insert into public.privileged_queue_admission_decisions (
		queue_name, subject_type, subject_key, evidence_fingerprint,
		outcome, reason_code, evidence_snapshot
	) values (
		'product_submissions', 'catalog_submission', v_submission.id::text,
		v_evidence_fingerprint, 'auto_resolved', p_reason_code,
		p_evidence_snapshot || jsonb_build_object(
			'barcode', v_submission.barcode,
			'submissionKind', v_submission.submission_kind,
			'baseRevisionId', v_submission.base_revision_id,
			'queueResolution', v_queue_resolution
		)
	) on conflict do nothing;

	return true;
end;
$$;

revoke all on function public.resolve_catalog_submission_queue_admission(uuid, text, jsonb)
	from public, anon, authenticated, service_role;
grant execute on function public.resolve_catalog_submission_queue_admission(uuid, text, jsonb)
	to service_role;

comment on table public.privileged_queue_admission_decisions is
	'Immutable receipts for conservative deterministic resolution or routing performed before privileged work is displayed.';
comment on function public.apply_catalog_queue_admission(integer) is
	'Applies bounded service-only provider-change and catalog-conflict admission rules, preserving ambiguous evidence for human review.';
comment on function public.resolve_catalog_submission_queue_admission(uuid, text, jsonb) is
	'Closes one stale or already-satisfied pending catalog submission after a server-side exact comparison, guarded by the current product and revision snapshot.';
