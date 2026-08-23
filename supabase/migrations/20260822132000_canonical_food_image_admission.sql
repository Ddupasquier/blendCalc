alter table public.food_image_assets
	add column if not exists canonical_status text not null default 'candidate',
	add column if not exists canonical_selection_method text,
	add column if not exists canonical_selected_at timestamptz,
	add column if not exists canonical_selected_by uuid references auth.users(id) on delete set null;

alter table public.food_image_assets
	drop constraint if exists food_image_assets_canonical_selection_check,
	add constraint food_image_assets_canonical_selection_check
		check (
			(
				canonical_status = 'candidate'
				and canonical_selection_method is null
				and canonical_selected_at is null
				and canonical_selected_by is null
			)
			or (
				canonical_status = 'selected'
				and image_role = 'front'
				and shared_product_id is not null
				and canonical_selected_at is not null
				and (
					(
						canonical_selection_method = 'exact-licensed-source'
						and canonical_selected_by is null
					)
					or (
						canonical_selection_method = 'moderator-approved-community'
						and canonical_selected_by is not null
					)
				)
			)
		);

create unique index if not exists food_image_assets_one_canonical_front_per_product_idx
	on public.food_image_assets (shared_product_id)
	where canonical_status = 'selected'
		and image_role = 'front'
		and shared_product_id is not null;

create index if not exists food_image_assets_canonical_candidate_idx
	on public.food_image_assets (
		shared_product_id,
		canonical_status,
		image_role,
		status,
		approved_at desc,
		fetched_at desc
	)
	where shared_product_id is not null;

create or replace function public.canonical_food_image_selection_method(
	p_food_image_asset_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
	select case
		when image.source = 'community-reviewed'
			and image.approved_by is not null
			and image.approved_at is not null
			and nullif(btrim(image.source_reference), '') is not null
			and nullif(btrim(image.license_name), '') is not null
			and nullif(btrim(image.attribution_text), '') is not null
			then 'moderator-approved-community'
		when image.source = 'open-food-facts'
			and image.barcode = product.barcode
			and nullif(btrim(image.source_reference), '') is not null
			and nullif(btrim(image.license_name), '') is not null
			and nullif(btrim(image.license_url), '') is not null
			and nullif(btrim(image.attribution_text), '') is not null
			then 'exact-licensed-source'
		else null
	end
	from public.food_image_assets image
	join public.shared_products product on product.id = image.shared_product_id
	where image.id = p_food_image_asset_id
		and image.status = 'active'
		and image.image_role = 'front'
		and product.status = 'active';
$$;

revoke all on function public.canonical_food_image_selection_method(uuid)
	from public, anon, authenticated;
grant execute on function public.canonical_food_image_selection_method(uuid)
	to service_role;

create or replace function public.refresh_canonical_food_image(
	p_shared_product_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_existing_image_id uuid;
	v_candidate_image_id uuid;
	v_selection_method text;
	v_selected_by uuid;
begin
	if p_shared_product_id is null then
		return null;
	end if;

	perform product.id
	from public.shared_products product
	where product.id = p_shared_product_id
	for update;

	if not found then
		return null;
	end if;

	select image.id
	into v_existing_image_id
	from public.food_image_assets image
	where image.shared_product_id = p_shared_product_id
		and image.canonical_status = 'selected'
		and public.canonical_food_image_selection_method(image.id) is not null
	order by image.canonical_selected_at, image.id
	limit 1;

	update public.food_image_assets image
	set
		canonical_status = 'candidate',
		canonical_selection_method = null,
		canonical_selected_at = null,
		canonical_selected_by = null
	where image.shared_product_id = p_shared_product_id
		and image.canonical_status = 'selected'
		and image.id is distinct from v_existing_image_id;

	if v_existing_image_id is not null then
		return v_existing_image_id;
	end if;

	select
		image.id,
		public.canonical_food_image_selection_method(image.id),
		case
			when image.source = 'community-reviewed' then image.approved_by
			else null
		end
	into v_candidate_image_id, v_selection_method, v_selected_by
	from public.food_image_assets image
	where image.shared_product_id = p_shared_product_id
		and image.canonical_status = 'candidate'
		and public.canonical_food_image_selection_method(image.id) is not null
	order by
		case image.source
			when 'community-reviewed' then 1
			when 'open-food-facts' then 2
			else 3
		end,
		image.approved_at desc nulls last,
		image.fetched_at desc,
		image.id
	limit 1;

	if v_candidate_image_id is null then
		return null;
	end if;

	update public.food_image_assets image
	set
		canonical_status = 'selected',
		canonical_selection_method = v_selection_method,
		canonical_selected_at = now(),
		canonical_selected_by = v_selected_by
	where image.id = v_candidate_image_id;

	return v_candidate_image_id;
end;
$$;

revoke all on function public.refresh_canonical_food_image(uuid)
	from public, anon, authenticated;
grant execute on function public.refresh_canonical_food_image(uuid)
	to service_role;

create or replace function public.refresh_canonical_food_image_after_asset_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'UPDATE' and old.shared_product_id is distinct from new.shared_product_id then
		perform public.refresh_canonical_food_image(old.shared_product_id);
	end if;

	perform public.refresh_canonical_food_image(new.shared_product_id);
	return new;
end;
$$;

revoke all on function public.refresh_canonical_food_image_after_asset_change()
	from public, anon, authenticated;

create or replace function public.admit_existing_images_for_shared_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if new.status = 'active' then
		update public.food_image_assets image
		set shared_product_id = new.id
		where image.shared_product_id is null
			and image.barcode = new.barcode
			and image.source = 'open-food-facts'
			and image.image_role = 'front'
			and image.status = 'active';

		if tg_op = 'INSERT' then
			update public.food_image_assets image
			set
				canonical_status = 'candidate',
				canonical_selection_method = null,
				canonical_selected_at = null,
				canonical_selected_by = null
			where image.shared_product_id = new.id
				and image.canonical_status = 'selected';
		end if;
	end if;

	perform public.refresh_canonical_food_image(new.id);
	return new;
end;
$$;

revoke all on function public.admit_existing_images_for_shared_product()
	from public, anon, authenticated;

update public.food_image_assets image
set shared_product_id = product.id
from public.shared_products product
where image.shared_product_id is null
	and image.barcode = product.barcode
	and image.source = 'open-food-facts'
	and image.image_role = 'front'
	and image.status = 'active'
	and product.status = 'active';

select public.refresh_canonical_food_image(product.id)
from public.shared_products product
where product.status = 'active';

drop trigger if exists refresh_canonical_food_image_after_asset_change
	on public.food_image_assets;
create trigger refresh_canonical_food_image_after_asset_change
	after insert or update of
		shared_product_id,
		barcode,
		source,
		source_reference,
		image_role,
		license_name,
		license_url,
		attribution_text,
		approved_by,
		approved_at,
		status
	on public.food_image_assets
	for each row
	execute function public.refresh_canonical_food_image_after_asset_change();

drop trigger if exists admit_existing_images_for_shared_product
	on public.shared_products;
create trigger admit_existing_images_for_shared_product
	after insert or update of barcode, status
	on public.shared_products
	for each row
	execute function public.admit_existing_images_for_shared_product();

comment on column public.food_image_assets.canonical_status is
	'Whether the image is an alternate candidate or the durable canonical front image for its shared product.';

comment on column public.food_image_assets.canonical_selection_method is
	'Exact evidence path that admitted the canonical image. Later candidates never silently replace an eligible selected image.';

comment on column public.food_image_assets.canonical_selected_at is
	'Time the image became the canonical front image for its shared product.';

comment on column public.food_image_assets.canonical_selected_by is
	'Moderator responsible for a community-image canonical selection. Exact licensed source selections remain automated and null.';

comment on function public.refresh_canonical_food_image(uuid) is
	'Keeps an eligible canonical front image stable, promotes one deterministic exact-evidence candidate only when none exists, and preserves all alternatives as candidates.';
