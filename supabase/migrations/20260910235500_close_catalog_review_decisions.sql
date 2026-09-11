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
				from public.shared_product_conflicts
				where status = 'open'
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
				from public.catalog_provider_change_reviews
				where status = 'pending'
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
				select count(*) from public.shared_product_conflicts where status = 'open'
			),
			'providerChanges', (
				select count(*) from public.catalog_provider_change_reviews where status = 'pending'
			),
			'safetyMatches', coalesce(v_monitor #>> '{queue,pendingSafetyMatches}', '0')::integer
		),
		'issueLimit', v_limit
	);
end;
$$;

create or replace function public.resolve_catalog_conflict_without_correction(
	p_conflict_id uuid,
	p_shared_product_id uuid,
	p_resolution_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_conflict public.shared_product_conflicts%rowtype;
	v_note text := left(btrim(coalesce(p_resolution_note, '')), 2000);
begin
	if not public.authorize_app_permission('moderation.catalog.review') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog review access is required.';
	end if;
	if v_note = '' then
		raise exception 'A resolution note is required';
	end if;

	select *
	into v_conflict
	from public.shared_product_conflicts conflict
	where conflict.id = p_conflict_id
		and conflict.shared_product_id = p_shared_product_id
		and conflict.status = 'open'
	for update;
	if not found then
		raise exception 'Catalog conflict is no longer waiting for review';
	end if;

	if exists (
		select 1
		from public.catalog_correction_origins origin
		where origin.shared_product_conflict_id = v_conflict.id
			and origin.status = 'linked'
	) then
		raise exception 'Review the linked catalog correction before resolving this conflict';
	end if;

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

	return jsonb_build_object(
		'reviewed', true,
		'conflictId', v_conflict.id,
		'sharedProductId', v_conflict.shared_product_id
	);
end;
$$;

create or replace function public.review_catalog_provider_change(
	p_review_id uuid,
	p_outcome text,
	p_review_note text,
	p_accepted_revision_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_review public.catalog_provider_change_reviews%rowtype;
	v_note text := left(btrim(coalesce(p_review_note, '')), 2000);
	v_resolved_conflict_ids uuid[] := '{}'::uuid[];
begin
	if not public.authorize_app_permission('moderation.catalog.review') then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog review access is required.';
	end if;
	if p_outcome not in ('accepted', 'rejected', 'superseded') then
		raise exception 'Catalog provider change review outcome is invalid';
	end if;
	if v_note = '' then
		raise exception 'A review note is required';
	end if;

	select *
	into v_review
	from public.catalog_provider_change_reviews review
	where review.id = p_review_id
		and review.status = 'pending'
	for update;
	if not found then
		raise exception 'Catalog provider change is no longer waiting for review';
	end if;

	if p_outcome = 'accepted' and not exists (
		select 1
		from public.shared_product_revisions revision
		where revision.id = p_accepted_revision_id
			and revision.shared_product_id = v_review.shared_product_id
			and revision.created_at >= v_review.created_at
	) then
		raise exception 'Accepted provider changes require the resulting catalog revision';
	end if;

	if p_outcome in ('rejected', 'superseded') and exists (
		select 1
		from public.catalog_correction_origins origin
		left join public.shared_product_conflicts conflict
			on conflict.id = origin.shared_product_conflict_id
		where origin.status = 'linked'
			and (
				origin.provider_change_review_id = v_review.id
				or (
					conflict.shared_product_id = v_review.shared_product_id
					and exists (
						select 1
						from jsonb_array_elements(conflict.observed_values) evidence
						where evidence ->> 'snapshotId' = v_review.snapshot_id::text
					)
				)
			)
	) then
		raise exception 'Review the linked catalog correction before closing this provider change';
	end if;

	if p_outcome in ('rejected', 'superseded') then
		with resolved as (
			update public.shared_product_conflicts conflict
			set status = 'resolved',
				resolution_note = v_note,
				resolved_by = (select auth.uid()),
				resolved_at = now()
			where conflict.shared_product_id = v_review.shared_product_id
				and conflict.status = 'open'
				and exists (
					select 1
					from jsonb_array_elements(conflict.observed_values) evidence
					where evidence ->> 'snapshotId' = v_review.snapshot_id::text
				)
			returning conflict.id
		)
		select coalesce(array_agg(resolved.id), '{}'::uuid[])
		into v_resolved_conflict_ids
		from resolved;

		update public.catalog_correction_origins
		set status = 'dismissed',
			resolved_at = now(),
			resolution_note = v_note
		where status = 'waiting_for_correction'
			and (
				provider_change_review_id = v_review.id
				or shared_product_conflict_id = any(v_resolved_conflict_ids)
			);
	end if;

	update public.catalog_provider_change_reviews
	set status = p_outcome,
		reviewed_by = (select auth.uid()),
		reviewed_at = now(),
		review_note = v_note,
		accepted_revision_id = case when p_outcome = 'accepted' then p_accepted_revision_id else null end
	where id = p_review_id;
end;
$$;

revoke all on function public.resolve_catalog_conflict_without_correction(uuid, uuid, text)
	from public, anon, authenticated, service_role;
grant execute on function public.resolve_catalog_conflict_without_correction(uuid, uuid, text)
	to authenticated;

comment on function public.resolve_catalog_conflict_without_correction(uuid, uuid, text) is
	'Records an evidence-backed decision to retain the current product value and closes one exact catalog conflict after an AAL2 catalog-review permission check.';

comment on function public.review_catalog_provider_change(uuid, text, text, uuid) is
	'Records an AAL2 provider-change decision. Rejecting or superseding an unlinked observation retains the current revision and closes only conflicts created by that exact provider snapshot.';
