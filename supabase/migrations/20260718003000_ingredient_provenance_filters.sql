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
		when 'shared-catalog' then 'shared-catalog'
		when 'community-reviewed' then 'shared-catalog'
		when 'community' then 'shared-catalog'
		when 'custom' then 'custom'
		else case lower(coalesce(nullif(p_food ->> 'barcodeSource', ''), ''))
			when 'usda' then 'usda'
			when 'open-food-facts' then 'open-food-facts'
			when 'community' then 'shared-catalog'
			else case
				when lower(coalesce(p_food ->> 'customFood', 'false')) = 'true' then 'custom'
				when nullif(p_food ->> 'sharedProductId', '') is not null then 'shared-catalog'
				else 'usda'
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
			'imported',
			'corroborated',
			'moderator-reviewed'
		) then lower(p_food ->> 'sharedProductConfidence')
		when public.food_source_key(p_food) = 'usda' then 'source-verified'
		when public.food_source_key(p_food) = 'open-food-facts' then 'imported'
		when public.food_source_key(p_food) = 'shared-catalog' then 'moderator-reviewed'
		else 'user-private'
	end;
$$;

alter table public.user_food_list_items
	add column source_key text generated always as (public.food_source_key(food)) stored,
	add column trust_status text generated always as (public.food_trust_status(food)) stored;

alter table public.user_food_list_items
	add constraint user_food_list_items_source_key_check
		check (source_key in ('usda', 'open-food-facts', 'shared-catalog', 'custom')),
	add constraint user_food_list_items_trust_status_check
		check (trust_status in ('source-verified', 'imported', 'corroborated', 'moderator-reviewed', 'user-private'));

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

alter table public.custom_foods
	add column source_key text generated always as (public.food_source_key(food)) stored,
	add column trust_status text generated always as (public.food_trust_status(food)) stored;

alter table public.custom_foods
	add constraint custom_foods_source_key_check
		check (source_key in ('usda', 'open-food-facts', 'shared-catalog', 'custom')),
	add constraint custom_foods_trust_status_check
		check (trust_status in ('source-verified', 'imported', 'corroborated', 'moderator-reviewed', 'user-private'));

create index custom_foods_source_filter_idx
	on public.custom_foods (user_id, source_key, trust_status, name_key);

create table public.ingredient_provenance_options (
	dimension text not null check (dimension in ('source', 'trust')),
	value text not null check (btrim(value) <> ''),
	filter_label text not null check (btrim(filter_label) <> ''),
	badge_label text check (badge_label is null or btrim(badge_label) <> ''),
	badge_tone text not null default 'neutral'
		check (badge_tone in ('info', 'success', 'custom', 'neutral')),
	display_order integer not null check (display_order >= 0),
	filter_enabled boolean not null default true,
	badge_enabled boolean not null default true,
	description text not null default '' check (btrim(description) <> '' or description = ''),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (dimension, value),
	unique (dimension, display_order)
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
values
	('source', 'all', 'All sources', null, 'neutral', 0, true, false, 'Includes every ingredient origin.'),
	('source', 'usda', 'USDA', 'USDA', 'info', 10, true, true, 'Food data sourced from USDA FoodData Central.'),
	('source', 'open-food-facts', 'Open Food Facts', 'OFF', 'info', 20, true, true, 'Food data sourced from Open Food Facts.'),
	('source', 'shared-catalog', 'blendCalc Community', 'Community', 'success', 30, true, true, 'Food data created and approved through the blendCalc community catalog.'),
	('source', 'custom', 'Custom', 'Custom', 'custom', 40, true, true, 'Food data entered without an external or shared-catalog source.'),
	('trust', 'any', 'Any review status', null, 'neutral', 0, true, false, 'Includes every review status.'),
	('trust', 'source-verified', 'Source verified', 'Verified', 'success', 10, true, true, 'The authoritative source supplied this record.'),
	('trust', 'imported', 'Imported', 'Imported', 'neutral', 20, true, true, 'The record was imported from a secondary source and has not been community reviewed.'),
	('trust', 'corroborated', 'Corroborated', 'Corroborated', 'success', 30, true, true, 'More than one trusted source agrees with this record.'),
	('trust', 'moderator-reviewed', 'Community reviewed', 'Reviewed', 'success', 40, true, true, 'A blendCalc moderator approved this shared record.'),
	('trust', 'user-private', 'Private', 'Private', 'neutral', 50, true, true, 'This record is private to the current user.');

create trigger set_ingredient_provenance_options_updated_at
	before update on public.ingredient_provenance_options
	for each row execute function public.set_updated_at();

alter table public.ingredient_provenance_options enable row level security;
alter table public.ingredient_provenance_options force row level security;

create policy "Authenticated users can read ingredient provenance options"
	on public.ingredient_provenance_options
	for select
	to authenticated
	using (true);

revoke all on table public.ingredient_provenance_options
	from public, anon, authenticated;
grant select on table public.ingredient_provenance_options to authenticated;
grant all on table public.ingredient_provenance_options to service_role;

update public.shared_products as product
set food = product.food || jsonb_build_object(
	'sourceKey', case product.source
		when 'community-reviewed' then 'shared-catalog'
		else product.source
	end,
	'sourceLabel', case product.source
		when 'usda' then 'USDA FoodData Central'
		when 'open-food-facts' then 'Open Food Facts'
		else 'blendCalc verified catalog'
	end,
	'sharedProductConfidence', product.confidence
);

alter table public.custom_foods disable trigger prepare_custom_food_record;

update public.custom_foods
set food = food || jsonb_build_object(
	'sourceKey', public.food_source_key(food),
	'sourceLabel', case public.food_source_key(food)
		when 'usda' then 'USDA FoodData Central'
		when 'open-food-facts' then 'Open Food Facts'
		when 'shared-catalog' then 'blendCalc verified catalog'
		else 'Custom'
	end
);

alter table public.custom_foods enable trigger prepare_custom_food_record;

update public.user_food_list_items as list_item
set food = list_item.food || jsonb_build_object(
	'sourceKey', case product.source
		when 'community-reviewed' then 'shared-catalog'
		else product.source
	end,
	'sourceLabel', case product.source
		when 'usda' then 'USDA FoodData Central'
		when 'open-food-facts' then 'Open Food Facts'
		else 'blendCalc verified catalog'
	end,
	'sharedProductConfidence', product.confidence
)
from public.shared_products as product
where list_item.food ->> 'sharedProductId' = product.id::text;

update public.user_food_list_items
set food = food || jsonb_build_object(
	'sourceKey', public.food_source_key(food),
	'sourceLabel', case public.food_source_key(food)
		when 'usda' then 'USDA FoodData Central'
		when 'open-food-facts' then 'Open Food Facts'
		when 'shared-catalog' then 'blendCalc verified catalog'
		else 'Custom'
	end
)
where nullif(food ->> 'sharedProductId', '') is null;

drop table public.ingredient_source_options;
