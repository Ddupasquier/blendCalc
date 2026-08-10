update public.shared_products
set
	confidence = 'source-verified',
	food = food || jsonb_build_object(
		'sharedProductConfidence',
		'source-verified'
	)
where source = 'open-food-facts'
	and confidence = 'imported'
	and nullif(btrim(source_reference), '') is not null;

create or replace function public.food_source_key(p_food jsonb)
returns text
language sql
immutable
set search_path = public
as $$
	select case lower(coalesce(nullif(p_food ->> 'sourceKey', ''), ''))
		when 'usda' then 'usda'
		when 'fdc' then 'usda'
		when 'open-food-facts' then 'open-food-facts'
		when 'health-canada-cnf' then 'national-dataset'
		when 'uk-cofid' then 'national-dataset'
		when 'fsanz-afcd' then 'national-dataset'
		when 'national-dataset' then 'national-dataset'
		when 'shared-catalog' then 'shared-catalog'
		when 'community-reviewed' then 'shared-catalog'
		when 'community' then 'shared-catalog'
		when 'custom' then 'custom'
		when 'unknown' then 'unknown'
		else case lower(coalesce(nullif(p_food ->> 'barcodeSource', ''), ''))
			when 'usda' then 'usda'
			when 'open-food-facts' then 'open-food-facts'
			when 'community' then 'shared-catalog'
			else case
				when lower(coalesce(p_food ->> 'customFood', 'false')) = 'true' then 'custom'
				when nullif(p_food ->> 'sharedProductId', '') is not null then 'shared-catalog'
				else 'unknown'
			end
		end
	end;
$$;

create or replace function public.food_trust_status(p_food jsonb)
returns text
language sql
immutable
set search_path = public
as $$
	select case
		when lower(coalesce(p_food ->> 'customFood', 'false')) = 'true'
			and nullif(p_food ->> 'sharedProductId', '') is null
			then 'user-private'
		when lower(coalesce(p_food ->> 'sharedProductConfidence', '')) in (
			'source-verified',
			'corroborated',
			'moderator-reviewed'
		) then lower(p_food ->> 'sharedProductConfidence')
		else 'unverified'
	end;
$$;

alter table public.user_food_list_items
	drop constraint if exists user_food_list_items_source_key_check;

alter table public.user_food_list_items
	add constraint user_food_list_items_source_key_check
		check (source_key in (
			'usda',
			'open-food-facts',
			'national-dataset',
			'shared-catalog',
			'custom',
			'unknown'
		));

alter table public.user_food_list_items
	drop constraint if exists user_food_list_items_trust_status_check;

alter table public.user_food_list_items
	add constraint user_food_list_items_trust_status_check
		check (trust_status in (
			'source-verified',
			'imported',
			'corroborated',
			'moderator-reviewed',
			'pending-review',
			'unverified',
			'user-private'
		));

alter table public.custom_foods
	drop constraint if exists custom_foods_source_key_check;

alter table public.custom_foods
	add constraint custom_foods_source_key_check
		check (source_key in (
			'usda',
			'open-food-facts',
			'national-dataset',
			'shared-catalog',
			'custom',
			'unknown'
		));

alter table public.custom_foods
	drop constraint if exists custom_foods_trust_status_check;

alter table public.custom_foods
	add constraint custom_foods_trust_status_check
		check (trust_status in (
			'source-verified',
			'imported',
			'corroborated',
			'moderator-reviewed',
			'pending-review',
			'unverified',
			'user-private'
		));

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
	v_fallback_source text;
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

	v_fallback_source := public.food_source_key(new.food);
	new.shared_product_id := v_shared_product_id;
	new.shared_product_submission_id := v_pending_submission_id;
	new.source_key := case
		when v_shared_product_source = 'usda' then 'usda'
		when v_shared_product_source = 'open-food-facts' then 'open-food-facts'
		when v_shared_product_source = 'community-reviewed' then 'shared-catalog'
		else v_fallback_source
	end;
	new.trust_status := case
		when v_pending_submission_id is not null then 'pending-review'
		when v_shared_product_id is not null
			and v_shared_product_confidence in (
				'source-verified',
				'corroborated',
				'moderator-reviewed'
			) then v_shared_product_confidence
		when lower(coalesce(new.food ->> 'customFood', 'false')) = 'true'
			then 'user-private'
		else 'unverified'
	end;

	return new;
end;
$$;

alter table public.custom_foods disable trigger prepare_custom_food_record;

update public.custom_foods
set food = food;

alter table public.custom_foods enable trigger prepare_custom_food_record;

update public.user_food_list_items
set food = food;

update public.ingredient_provenance_options
set
	filter_enabled = false,
	badge_enabled = false,
	updated_at = now()
where dimension = 'source';

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
	'source',
	'unknown',
	'Unknown origin',
	'Unknown',
	'neutral',
	50,
	false,
	false,
	'No provider origin has been recorded for this ingredient.'
)
on conflict (dimension, value) do update
set
	filter_label = excluded.filter_label,
	badge_label = excluded.badge_label,
	badge_tone = excluded.badge_tone,
	display_order = excluded.display_order,
	filter_enabled = excluded.filter_enabled,
	badge_enabled = excluded.badge_enabled,
	description = excluded.description,
	updated_at = now();

update public.ingredient_provenance_options
set
	filter_enabled = false,
	badge_enabled = value in (
		'source-verified',
		'corroborated',
		'moderator-reviewed',
		'pending-review'
	),
	filter_label = case
		when value in ('source-verified', 'corroborated', 'moderator-reviewed')
			then 'Verified'
		when value = 'pending-review' then 'Pending review'
		else filter_label
	end,
	badge_label = case
		when value in ('source-verified', 'corroborated', 'moderator-reviewed')
			then 'Verified'
		when value = 'pending-review' then 'Pending'
		else badge_label
	end,
	updated_at = now()
where dimension = 'trust';

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
	'unverified',
	'Unverified',
	'Unverified',
	'neutral',
	60,
	false,
	false,
	'No provider-independent verification evidence has been recorded.'
)
on conflict (dimension, value) do update
set
	filter_label = excluded.filter_label,
	badge_label = excluded.badge_label,
	badge_tone = excluded.badge_tone,
	display_order = excluded.display_order,
	filter_enabled = excluded.filter_enabled,
	badge_enabled = excluded.badge_enabled,
	description = excluded.description,
	updated_at = now();
