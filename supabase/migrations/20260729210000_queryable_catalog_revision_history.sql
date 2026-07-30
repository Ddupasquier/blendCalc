create or replace function public.catalog_change_summary_is_valid(
	p_summary jsonb,
	p_require_changes boolean default false
)
returns boolean
language sql
immutable
set search_path = ''
as $$
	select
		jsonb_typeof(p_summary) = 'object'
		and (
			not p_require_changes
			or (
				jsonb_typeof(p_summary -> 'changes') = 'array'
				and jsonb_array_length(p_summary -> 'changes') > 0
				and not exists (
					select 1
					from jsonb_array_elements(p_summary -> 'changes') change
					where jsonb_typeof(change) <> 'object'
						or btrim(coalesce(change ->> 'field', '')) = ''
						or btrim(coalesce(change ->> 'label', '')) = ''
						or change ->> 'changeType' not in (
							'added',
							'removed',
							'changed'
						)
						or change ->> 'severity' not in (
							'low',
							'medium',
							'high'
						)
						or not change ? 'previousValue'
						or not change ? 'submittedValue'
				)
				and (
					select count(*)
					from jsonb_array_elements(p_summary -> 'changes')
				) = (
					select count(distinct change ->> 'field')
					from jsonb_array_elements(p_summary -> 'changes') change
				)
			)
		);
$$;

alter table public.shared_product_submissions
	drop constraint if exists shared_product_submissions_update_target_check,
	add constraint shared_product_submissions_update_target_check
		check (
			(
				submission_kind = 'new_product'
				and target_shared_product_id is null
				and base_revision_id is null
				and public.catalog_change_summary_is_valid(
					change_summary,
					false
				)
			)
			or (
				submission_kind = 'product_update'
				and target_shared_product_id is not null
				and base_revision_id is not null
				and public.catalog_change_summary_is_valid(
					change_summary,
					true
				)
			)
		);

create or replace function public.record_shared_product_revision_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
	v_change jsonb;
	v_submission_kind text;
begin
	select submission_kind
	into v_submission_kind
	from public.shared_product_submissions
	where id = new.submission_id;

	if v_submission_kind = 'product_update'
		and not public.catalog_change_summary_is_valid(
			new.change_summary,
			true
		) then
		raise exception 'Catalog update revision requires a valid structured change summary';
	end if;

	for v_change in
		select value
		from jsonb_array_elements(
			coalesce(new.change_summary -> 'changes', '[]'::jsonb)
		)
	loop
		insert into public.shared_product_revision_changes (
			revision_id,
			field_path,
			field_label,
			change_type,
			previous_value,
			new_value,
			severity
		)
		values (
			new.id,
			v_change ->> 'field',
			v_change ->> 'label',
			v_change ->> 'changeType',
			v_change -> 'previousValue',
			v_change -> 'submittedValue',
			v_change ->> 'severity'
		);
	end loop;

	return new;
end;
$$;

create or replace function public.get_blendcalc_product_revision_history_v1(
	p_barcode text,
	p_limit integer default 25,
	p_offset integer default 0
)
returns table (
	id uuid,
	revision_number integer,
	published_at timestamptz,
	label_observed_at timestamptz,
	changes jsonb,
	total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
	with approved_product as (
		select product.id
		from public.shared_products product
		where product.status = 'active'
			and product.barcode = p_barcode
			and cardinality(
				public.blendcalc_api_v1_product_readiness_reasons(product.id)
			) = 0
		limit 1
	),
	input as (
		select
			greatest(1, least(coalesce(p_limit, 25), 100)) as result_limit,
			greatest(0, least(coalesce(p_offset, 0), 1000)) as result_offset
	),
	history as (
		select
			revision.id,
			revision.revision_number,
			revision.created_at as published_at,
			revision.label_observed_at,
			coalesce(
				jsonb_agg(
					jsonb_build_object(
						'field', change.field_path,
						'label', change.field_label,
						'changeType', change.change_type,
						'previousValue', change.previous_value,
						'newValue', change.new_value,
						'severity', change.severity
					)
					order by change.field_path
				) filter (where change.id is not null),
				'[]'::jsonb
			) as changes
		from approved_product product
		join public.shared_product_revisions revision
			on revision.shared_product_id = product.id
		left join public.shared_product_revision_changes change
			on change.revision_id = revision.id
		group by revision.id
	),
	counted as (
		select history.*, count(*) over () as total_count
		from history
	)
	select
		counted.id,
		counted.revision_number,
		counted.published_at,
		counted.label_observed_at,
		counted.changes,
		counted.total_count
	from counted
	order by counted.revision_number desc
	limit (select result_limit from input)
	offset (select result_offset from input);
$$;

revoke all on function public.catalog_change_summary_is_valid(jsonb, boolean)
	from public, anon, authenticated;
revoke all on function public.record_shared_product_revision_changes()
	from public, anon, authenticated;
revoke all on function public.get_blendcalc_product_revision_history_v1(
	text,
	integer,
	integer
) from public, anon;

grant execute on function public.catalog_change_summary_is_valid(jsonb, boolean)
	to service_role;
grant execute on function public.get_blendcalc_product_revision_history_v1(
	text,
	integer,
	integer
) to authenticated, service_role;
