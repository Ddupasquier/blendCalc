-- Additive read contract. The previous summary remains available during rollout.
create view private.catalog_review_page_entries as
select 'conflicts'::text as queue, conflict.id, conflict.shared_product_id,
    conflict.created_at as review_at,
    jsonb_build_object(
        'id', conflict.id, 'productId', conflict.shared_product_id,
        'barcode', conflict.barcode, 'productName', product.product_name,
        'fieldPath', conflict.field_path, 'observedValues', conflict.observed_values,
        'severity', conflict.severity, 'createdAt', conflict.created_at
    ) as payload
from public.catalog_actionable_product_conflicts conflict
join public.shared_products product on product.id = conflict.shared_product_id
union all
select 'providerChanges', review.id, review.shared_product_id, review.created_at,
    jsonb_build_object(
        'id', review.id, 'sharedProductId', review.shared_product_id,
        'barcode', product.barcode, 'productName', product.product_name,
        'sourceName', source.display_name, 'changeSummary', review.change_summary,
        'materialFieldPaths', review.material_field_paths,
        'observedAt', snapshot.observed_at, 'createdAt', review.created_at,
        'correctionStatus', origin.status, 'submissionId', origin.submission_id
    )
from public.catalog_actionable_provider_change_reviews review
join public.shared_products product on product.id = review.shared_product_id
join public.product_data_sources source on source.key = review.provider_key
join public.catalog_provider_product_snapshots snapshot on snapshot.id = review.snapshot_id
left join public.catalog_correction_origins origin
    on origin.provider_change_review_id = review.id
    and origin.status in ('waiting_for_correction', 'linked')
union all
select 'safetyMatches', match.id, match.shared_product_id, match.detected_at,
    jsonb_build_object(
        'id', match.id, 'sharedProductId', match.shared_product_id,
        'barcode', product.barcode, 'productName', product.product_name,
        'brandOwner', product.brand_owner,
        'alertProductDescription', alert.product_description,
        'classification', alert.classification, 'reason', alert.reason,
        'packageDescription', alert.package_description,
        'codeInformation', alert.code_information, 'sourceUrl', alert.source_url,
        'sourceName', source.display_name, 'matchEvidence', match.match_evidence,
        'requiresPackageCheck', match.requires_package_check,
        'detectedAt', match.detected_at
    )
from public.official_food_safety_alert_matches match
join public.official_food_safety_alerts alert on alert.id = match.alert_id
join public.shared_products product on product.id = match.shared_product_id
join public.product_data_sources source on source.key = alert.provider_key
where match.status = 'needs_review';

revoke all on private.catalog_review_page_entries from public, anon, authenticated;

create function public.get_catalog_review_page(
    p_queue text,
    p_product_id uuid default null,
    p_cursor jsonb default null,
    p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_result jsonb;
    v_at timestamptz;
    v_id uuid;
    v_priority integer;
begin
    if not public.authorize_app_permission('moderation.catalog.review')
        or not exists (
            select 1 from public.app_role_assignments assignment
            join public.app_role_permissions permission on permission.role = assignment.role
            where assignment.user_id = auth.uid()
                and permission.permission = 'moderation.catalog.review'
        ) then
        raise exception using errcode = '42501',
            message = 'MFA-verified catalog-review access is required.';
    end if;
    if p_queue is null or p_queue not in ('products', 'conflicts', 'providerChanges', 'safetyMatches')
        or p_limit is null or p_limit < 1 or p_limit > 20
        or (p_queue <> 'products' and p_product_id is null)
        or (p_queue = 'products' and p_product_id is not null) then
        raise exception using errcode = '22023', message = 'Invalid catalog review page.';
    end if;
    if p_cursor is not null then
        if jsonb_typeof(p_cursor) <> 'object'
            or not (p_cursor ?& array['createdAt', 'id', 'priority'])
            or (select count(*) from jsonb_object_keys(p_cursor)) <> 3
            or jsonb_typeof(p_cursor -> 'createdAt') <> 'string'
            or jsonb_typeof(p_cursor -> 'id') <> 'string'
            or jsonb_typeof(p_cursor -> 'priority') <> 'number'
            or (p_cursor ->> 'priority') not in ('0', '1') then
            raise exception using errcode = '22023', message = 'Invalid catalog review cursor.';
        end if;
        v_at := (p_cursor ->> 'createdAt')::timestamptz;
        v_id := (p_cursor ->> 'id')::uuid;
        v_priority := (p_cursor ->> 'priority')::integer;
        if not isfinite(v_at) or (p_queue <> 'products' and v_priority <> 0) then
            raise exception using errcode = '22023', message = 'Invalid catalog review cursor.';
        end if;
    end if;

    -- Counts, membership revision, and page share one MVCC snapshot. A changed
    -- revision tells the consumer to reconcile its visible depth before appending.
    with entries as materialized (
        select * from private.catalog_review_page_entries
        where p_product_id is null or shared_product_id = p_product_id
    ), totals as (
        select jsonb_build_object(
            'conflicts', count(*) filter (where queue = 'conflicts'),
            'providerChanges', count(*) filter (where queue = 'providerChanges'),
            'safetyMatches', count(*) filter (where queue = 'safetyMatches')
        ) as counts,
        md5(coalesce(string_agg(
            queue || id::text || review_at::text || md5(payload::text),
            ',' order by queue, id
        ) filter (where p_queue = 'products' or queue = p_queue), '')) as revision
        from entries
    ), products as (
        select shared_product_id as id, min(review_at) as review_at,
            case when bool_or(queue = 'safetyMatches') then 0 else 1 end as priority,
            jsonb_build_object(
                'id', shared_product_id, 'productId', shared_product_id,
                'barcode', product.barcode, 'productName', product.product_name,
                'brandOwner', product.brand_owner, 'oldestReviewAt', min(review_at),
                'counts', jsonb_build_object(
                    'conflicts', count(*) filter (where queue = 'conflicts'),
                    'providerChanges', count(*) filter (where queue = 'providerChanges'),
                    'safetyMatches', count(*) filter (where queue = 'safetyMatches'),
                    'total', count(*)
                )
            ) as payload
        from entries join public.shared_products product on product.id = shared_product_id
        group by shared_product_id, product.barcode, product.product_name, product.brand_owner
    ), rows as (
        select id, review_at, priority, payload from products where p_queue = 'products'
        union all
        select id, review_at, 0, payload from entries where queue = p_queue
    ), next_rows as materialized (
        select * from rows
        where p_cursor is null or (priority, review_at, id) > (v_priority, v_at, v_id)
        order by priority, review_at, id limit p_limit + 1
    ), page as materialized (
        select * from next_rows order by priority, review_at, id limit p_limit
    )
    select jsonb_build_object(
        'items', coalesce((select jsonb_agg(payload order by priority, review_at, id) from page), '[]'),
        'total', (select count(*) from rows),
        'counts', totals.counts,
        'revision', totals.revision,
        'nextCursor', case when (select count(*) from next_rows) > p_limit then (
            select jsonb_build_object('createdAt', review_at, 'id', id, 'priority', priority)
            from page order by priority desc, review_at desc, id desc limit 1
        ) else null end
    ) into v_result from totals;
    return v_result;
end;
$$;

revoke all on function public.get_catalog_review_page(text, uuid, jsonb, integer)
    from public, anon, authenticated;
grant execute on function public.get_catalog_review_page(text, uuid, jsonb, integer)
    to authenticated;
comment on function public.get_catalog_review_page(text, uuid, jsonb, integer) is
    'AAL2 catalog reviewer cursor pages: unique product inbox or exact-product decisions, at most 20 items, exact counts and a same-snapshot reconciliation revision. No evidence writes.';

create index catalog_conflicts_product_cursor_idx
    on public.shared_product_conflicts (shared_product_id, created_at, id) where status = 'open';
create index catalog_provider_reviews_product_cursor_idx
    on public.catalog_provider_change_reviews (shared_product_id, created_at, id) where status = 'pending';
create index catalog_safety_matches_product_cursor_idx
    on public.official_food_safety_alert_matches (shared_product_id, detected_at, id) where status = 'needs_review';
