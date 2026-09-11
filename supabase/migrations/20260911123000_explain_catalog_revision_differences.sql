create or replace function private.catalog_revision_leaf_changes(
	p_previous jsonb,
	p_current jsonb,
	p_path text default ''
)
returns table (
	field_path text,
	previous_value jsonb,
	new_value jsonb
)
language plpgsql
immutable
set search_path = ''
as $$
declare
	v_key text;
begin
	if jsonb_typeof(p_previous) = 'object'
		or jsonb_typeof(p_current) = 'object' then
		for v_key in
			select key
			from (
				select jsonb_object_keys(
					case
						when jsonb_typeof(p_previous) = 'object' then p_previous
						else '{}'::jsonb
					end
				) as key
				union
				select jsonb_object_keys(
					case
						when jsonb_typeof(p_current) = 'object' then p_current
						else '{}'::jsonb
					end
				) as key
			) keys
			order by key
		loop
			return query
			select change.*
			from private.catalog_revision_leaf_changes(
				p_previous -> v_key,
				p_current -> v_key,
				case
					when p_path = '' then v_key
					else p_path || '.' || v_key
				end
			) change;
		end loop;
	elsif p_previous is distinct from p_current then
		return query select p_path, p_previous, p_current;
	end if;
end;
$$;

revoke all on function private.catalog_revision_leaf_changes(jsonb, jsonb, text)
	from public, anon, authenticated;
grant execute on function private.catalog_revision_leaf_changes(jsonb, jsonb, text)
	to service_role;

create or replace function private.catalog_revision_field_label(
	p_field_path text
)
returns text
language sql
immutable
set search_path = ''
as $$
	select case
		when p_field_path like 'fieldProvenance.%' then
			concat(
				case split_part(p_field_path, '.', 2)
					when 'allergens' then 'Allergen'
					when 'brandOwner' then 'Brand'
					when 'categories' then 'Category'
					when 'ingredients' then 'Ingredient'
					when 'nutrients' then 'Nutrition'
					when 'package' then 'Package'
					when 'productName' then 'Product name'
					when 'serving' then 'Serving'
					when 'servingWeightGrams' then 'Serving weight'
					when 'sourceMetadata' then 'Source metadata'
					when 'traces' then 'Possible trace'
					else initcap(regexp_replace(
						regexp_replace(
							split_part(p_field_path, '.', 2),
							'([a-z0-9])([A-Z])',
							'\1 \2',
							'g'
						),
						'[_-]+',
						' ',
						'g'
					))
				end,
				' evidence',
				case split_part(p_field_path, '.', 3)
					when 'confidence' then ' confidence'
					when 'source' then ' source'
					when 'sourceReference' then ' reference'
					when '' then ''
					else ' ' || lower(initcap(regexp_replace(
						regexp_replace(
							split_part(p_field_path, '.', 3),
							'([a-z0-9])([A-Z])',
							'\1 \2',
							'g'
						),
						'[_-]+',
						' ',
						'g'
					)))
				end
			)
		when p_field_path = 'sourceMetadata' then 'Source metadata'
		when p_field_path = 'sourceKey' then 'Primary source'
		when p_field_path = 'sourceLabel' then 'Source name'
		when p_field_path = 'sourceDataType' then 'Source record type'
		when p_field_path = 'sharedProductConfidence' then 'Catalog confidence'
		when p_field_path = 'foodIdentityType' then 'Product identity type'
		when p_field_path = 'foodServings' then 'Serving records'
		when p_field_path = 'hasSourceServing' then 'Source serving availability'
		when p_field_path = 'householdServingFullText' then 'Household serving description'
		when p_field_path = 'packageQuantity' then 'Package quantity'
		when p_field_path = 'ingredientList' then 'Structured ingredient list'
		when p_field_path = 'ingredients' then 'Ingredient statement'
		when p_field_path = 'categories' then 'Categories'
		when p_field_path = 'allergens' then 'Allergen declaration'
		when p_field_path = 'traces' then 'Possible traces'
		when p_field_path = 'brandOwner' then 'Brand'
		when p_field_path = 'description' then 'Product name'
		else initcap(regexp_replace(
			regexp_replace(p_field_path, '([a-z0-9])([A-Z])', '\1 \2', 'g'),
			'[._-]+',
			' ',
			'g'
		))
	end;
$$;

revoke all on function private.catalog_revision_field_label(text)
	from public, anon, authenticated;
grant execute on function private.catalog_revision_field_label(text)
	to service_role;

create or replace function private.catalog_revision_snapshot_change_summary(
	p_previous jsonb,
	p_current jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
	select jsonb_build_object(
		'origin', 'exact_revision_snapshot_comparison',
		'changes', coalesce(jsonb_agg(
			jsonb_build_object(
				'field', change.field_path,
				'label', private.catalog_revision_field_label(change.field_path),
				'changeType', case
					when change.previous_value is null then 'added'
					when change.new_value is null then 'removed'
					else 'changed'
				end,
				'previousValue', change.previous_value,
				'submittedValue', change.new_value,
				'severity', case
					when change.field_path like 'fieldProvenance.%'
						or change.field_path in (
							'sourceMetadata',
							'sourceKey',
							'sourceLabel',
							'sourceDataType',
							'sharedProductConfidence'
						) then 'low'
					else 'medium'
				end
			)
			order by change.field_path
		), '[]'::jsonb)
	)
	from private.catalog_revision_leaf_changes(p_previous, p_current) change;
$$;

revoke all on function private.catalog_revision_snapshot_change_summary(jsonb, jsonb)
	from public, anon, authenticated;
grant execute on function private.catalog_revision_snapshot_change_summary(jsonb, jsonb)
	to service_role;

with revision_predecessors as (
	select
		revision.id,
		coalesce(explicit_previous.food, numbered_previous.food) as previous_food
	from public.shared_product_revisions revision
	left join public.shared_product_revisions explicit_previous
		on explicit_previous.id = revision.supersedes_revision_id
	left join public.shared_product_revisions numbered_previous
		on numbered_previous.shared_product_id = revision.shared_product_id
		and numbered_previous.revision_number = revision.revision_number - 1
	where revision.revision_number > 1
), summaries as (
	select
		revision.id,
		private.catalog_revision_snapshot_change_summary(
			predecessor.previous_food,
			revision.food
		) as generated_summary
	from public.shared_product_revisions revision
	join revision_predecessors predecessor on predecessor.id = revision.id
	where predecessor.previous_food is not null
		and revision.food is distinct from predecessor.previous_food
		and not coalesce(
			public.catalog_change_summary_is_valid(
				revision.change_summary,
				true
			),
			false
		)
)
update public.shared_product_revisions revision
set change_summary = revision.change_summary || summary.generated_summary
from summaries summary
where revision.id = summary.id;

with ordered_revisions as (
	select
		revision.id,
		previous.id as previous_revision_id
	from public.shared_product_revisions revision
	join public.shared_product_revisions previous
		on previous.shared_product_id = revision.shared_product_id
		and previous.revision_number = revision.revision_number - 1
	where revision.revision_number > 1
		and revision.supersedes_revision_id is null
)
update public.shared_product_revisions revision
set supersedes_revision_id = ordered.previous_revision_id
from ordered_revisions ordered
where revision.id = ordered.id;

insert into public.shared_product_revision_changes (
	revision_id,
	field_path,
	field_label,
	change_type,
	previous_value,
	new_value,
	severity
)
select
	revision.id,
	change.value ->> 'field',
	change.value ->> 'label',
	change.value ->> 'changeType',
	change.value -> 'previousValue',
	change.value -> 'submittedValue',
	change.value ->> 'severity'
from public.shared_product_revisions revision
cross join lateral jsonb_array_elements(
	coalesce(revision.change_summary -> 'changes', '[]'::jsonb)
) change(value)
where revision.revision_number > 1
	and public.catalog_change_summary_is_valid(revision.change_summary, true)
on conflict (revision_id, field_path) do nothing;

create or replace function public.prepare_shared_product_revision_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_previous public.shared_product_revisions%rowtype;
begin
	if new.revision_number = 1 then
		return new;
	end if;

	if new.supersedes_revision_id is not null then
		select revision.*
		into v_previous
		from public.shared_product_revisions revision
		where revision.id = new.supersedes_revision_id
			and revision.shared_product_id = new.shared_product_id;
	else
		select revision.*
		into v_previous
		from public.shared_product_revisions revision
		where revision.shared_product_id = new.shared_product_id
			and revision.revision_number = new.revision_number - 1;
	end if;

	if not found then
		raise exception 'Catalog revision % requires its exact predecessor',
			new.revision_number;
	end if;

	new.supersedes_revision_id := v_previous.id;

	if new.food = v_previous.food then
		raise exception 'Catalog revision % duplicates revision % without a stored change',
			new.revision_number,
			v_previous.revision_number;
	end if;

	if not coalesce(
		public.catalog_change_summary_is_valid(new.change_summary, true),
		false
	) then
		new.change_summary := coalesce(new.change_summary, '{}'::jsonb)
			|| private.catalog_revision_snapshot_change_summary(
				v_previous.food,
				new.food
			);
	end if;

	if not public.catalog_change_summary_is_valid(new.change_summary, true) then
		raise exception 'Catalog revision % requires an exact structured change summary',
			new.revision_number;
	end if;

	return new;
end;
$$;

revoke all on function public.prepare_shared_product_revision_history()
	from public, anon, authenticated, service_role;

drop trigger if exists prepare_shared_product_revision_history
	on public.shared_product_revisions;
create trigger prepare_shared_product_revision_history
	before insert or update of
		shared_product_id,
		revision_number,
		food,
		supersedes_revision_id,
		change_summary
	on public.shared_product_revisions
	for each row execute function public.prepare_shared_product_revision_history();

create or replace function public.get_catalog_product_revision_context(
	p_shared_product_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_history jsonb;
begin
	if not (
		public.authorize_app_permission('moderation.catalog.review')
		or public.authorize_app_permission('data_operations.catalog_health.read')
	) then
		raise exception using
			errcode = '42501',
			message = 'MFA-verified catalog access is required.';
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

	select coalesce(jsonb_agg(
		jsonb_build_object(
			'id', revision.id,
			'number', revision.revision_number,
			'labelObservedAt', revision.label_observed_at,
			'createdAt', revision.created_at,
			'source', revision.source,
			'sourceReference', revision.source_reference,
			'changes', coalesce(changes.value, '[]'::jsonb)
		)
		order by revision.revision_number desc
	), '[]'::jsonb)
	into v_history
	from public.shared_product_revisions revision
	left join lateral (
		select jsonb_agg(
			jsonb_build_object(
				'fieldPath', revision_change.field_path,
				'fieldLabel', revision_change.field_label,
				'changeType', revision_change.change_type,
				'previousValue', revision_change.previous_value,
				'newValue', revision_change.new_value,
				'severity', revision_change.severity
			)
			order by revision_change.field_path
		) as value
		from public.shared_product_revision_changes revision_change
		where revision_change.revision_id = revision.id
	) changes on true
	where revision.shared_product_id = p_shared_product_id;

	return v_history;
end;
$$;

revoke all on function public.get_catalog_product_revision_context(uuid)
	from public, anon, authenticated, service_role;
grant execute on function public.get_catalog_product_revision_context(uuid)
	to authenticated;

comment on function public.get_catalog_product_revision_context(uuid) is
	'Returns bounded, human-readable revision differences to an MFA-verified catalog reviewer or data operator without exposing raw revision snapshots.';
