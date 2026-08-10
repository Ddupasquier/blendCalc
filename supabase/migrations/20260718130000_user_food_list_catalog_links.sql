create or replace function public.food_normalized_barcode(p_food jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
	with normalized as (
		select regexp_replace(
			coalesce(
				nullif(p_food ->> 'barcode', ''),
				nullif(p_food ->> 'gtinUpc', ''),
				''
			),
			'[^0-9]',
			'',
			'g'
		) as digits
	)
	select case
		when digits = '' then null
		when length(digits) >= 14 then digits
		else lpad(digits, 14, '0')
	end
	from normalized;
$$;

drop index if exists public.user_food_list_items_source_filter_idx;
drop index if exists public.user_food_list_items_trust_filter_idx;

alter table public.user_food_list_items
	drop constraint if exists user_food_list_items_source_key_check,
	drop constraint if exists user_food_list_items_trust_status_check,
	drop column if exists source_key,
	drop column if exists trust_status;

alter table public.user_food_list_items
	add column shared_product_id uuid
		references public.shared_products(id) on delete set null,
	add column shared_product_submission_id uuid
		references public.shared_product_submissions(id) on delete set null,
	add column source_key text,
	add column trust_status text;

create or replace function public.resolve_user_food_list_catalog_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_barcode text := public.food_normalized_barcode(new.food);
	v_shared_product_id uuid;
	v_shared_product_source text;
	v_shared_product_confidence text;
	v_pending_submission_id uuid;
begin
	if v_barcode is not null then
		select product.id, product.source, product.confidence
		into v_shared_product_id, v_shared_product_source, v_shared_product_confidence
		from public.shared_products product
		where product.barcode = v_barcode
			and product.status = 'active'
		limit 1;

		select submission.id
		into v_pending_submission_id
		from public.shared_product_submissions submission
		where submission.submitted_by = new.user_id
			and submission.barcode = v_barcode
			and submission.status = 'pending'
		order by submission.created_at desc, submission.id desc
		limit 1;
	end if;

	new.shared_product_id := v_shared_product_id;
	new.shared_product_submission_id := v_pending_submission_id;
	new.source_key := case
		when v_shared_product_source = 'usda' then 'usda'
		when v_shared_product_source = 'open-food-facts' then 'open-food-facts'
		when v_shared_product_source = 'community-reviewed' then 'shared-catalog'
		else public.food_source_key(new.food)
	end;
	new.trust_status := case
		when v_pending_submission_id is not null then 'pending-review'
		when v_shared_product_id is not null
			and v_shared_product_confidence in (
				'source-verified',
				'imported',
				'corroborated',
				'moderator-reviewed'
			) then v_shared_product_confidence
		when lower(coalesce(new.food ->> 'customFood', 'false')) = 'true'
			then 'user-private'
		else public.food_trust_status(new.food)
	end;

	return new;
end;
$$;

create trigger resolve_user_food_list_catalog_state
	before insert or update on public.user_food_list_items
	for each row execute function public.resolve_user_food_list_catalog_state();

create or replace function public.refresh_food_list_catalog_state_for_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	update public.user_food_list_items item
	set food = item.food
	where item.user_id = new.submitted_by
		and item.food_identity_key = 'barcode:' || new.barcode;
	return new;
end;
$$;

create trigger refresh_food_list_catalog_state_for_submission
	after insert or update of status on public.shared_product_submissions
	for each row execute function public.refresh_food_list_catalog_state_for_submission();

create or replace function public.refresh_food_list_catalog_state_for_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	update public.user_food_list_items item
	set food = item.food
	where item.food_identity_key = 'barcode:' || new.barcode;
	return new;
end;
$$;

create trigger refresh_food_list_catalog_state_for_product
	after insert or update of status, source, confidence on public.shared_products
	for each row execute function public.refresh_food_list_catalog_state_for_product();

update public.user_food_list_items item
set food = item.food;

alter table public.user_food_list_items
	alter column source_key set not null,
	alter column trust_status set not null,
	add constraint user_food_list_items_source_key_check
		check (source_key in ('usda', 'open-food-facts', 'shared-catalog', 'custom')),
	add constraint user_food_list_items_trust_status_check
		check (trust_status in (
			'source-verified',
			'imported',
			'corroborated',
			'moderator-reviewed',
			'pending-review',
			'user-private'
		));

create index user_food_list_items_catalog_identity_idx
	on public.user_food_list_items (food_identity_key);

create index user_food_list_items_shared_product_idx
	on public.user_food_list_items (shared_product_id)
	where shared_product_id is not null;

create index user_food_list_items_submission_idx
	on public.user_food_list_items (shared_product_submission_id)
	where shared_product_submission_id is not null;

create index user_food_list_items_source_filter_idx
	on public.user_food_list_items (
		user_id,
		list_type,
		source_key,
		trust_status,
		created_at desc,
		id desc
	);

create index user_food_list_items_trust_filter_idx
	on public.user_food_list_items (
		user_id,
		list_type,
		trust_status,
		created_at desc,
		id desc
	);

insert into public.ingredient_provenance_options (
	dimension,
	value,
	filter_label,
	badge_label,
	badge_tone,
	display_order,
	filter_enabled,
	badge_enabled,
	description
)
values (
	'trust',
	'pending-review',
	'Pending review',
	'Pending',
	'info',
	45,
	true,
	true,
	'This user''s catalog submission is waiting for moderator review.'
)
on conflict (dimension, value) do update
set filter_label = excluded.filter_label,
	badge_label = excluded.badge_label,
	badge_tone = excluded.badge_tone,
	display_order = excluded.display_order,
	filter_enabled = excluded.filter_enabled,
	badge_enabled = excluded.badge_enabled,
	description = excluded.description,
	updated_at = now();

revoke all on function public.food_normalized_barcode(jsonb) from public, anon;
grant execute on function public.food_normalized_barcode(jsonb) to authenticated, service_role;

revoke all on function public.resolve_user_food_list_catalog_state()
	from public, anon, authenticated;
revoke all on function public.refresh_food_list_catalog_state_for_submission()
	from public, anon, authenticated;
revoke all on function public.refresh_food_list_catalog_state_for_product()
	from public, anon, authenticated;
grant execute on function public.resolve_user_food_list_catalog_state() to service_role;
grant execute on function public.refresh_food_list_catalog_state_for_submission() to service_role;
grant execute on function public.refresh_food_list_catalog_state_for_product() to service_role;
