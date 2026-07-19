alter table public.food_image_assets
	add column if not exists fit_mode text,
	add column if not exists placement_version integer;

update public.food_image_assets
set
	fit_mode = coalesce(fit_mode, 'cover'),
	placement_version = coalesce(placement_version, 1)
where fit_mode is null or placement_version is null;

alter table public.food_image_assets
	alter column fit_mode set default 'contain',
	alter column fit_mode set not null,
	alter column placement_version set default 2,
	alter column placement_version set not null;

alter table public.food_image_assets
	drop constraint if exists food_image_assets_fit_mode_check,
	add constraint food_image_assets_fit_mode_check
		check (fit_mode in ('contain', 'cover', 'custom')),
	drop constraint if exists food_image_assets_placement_version_check,
	add constraint food_image_assets_placement_version_check
		check (placement_version >= 1),
	drop constraint if exists food_image_assets_crop_zoom_check,
	add constraint food_image_assets_crop_zoom_check
		check (crop_zoom >= 1 and crop_zoom <= 8);

comment on column public.food_image_assets.fit_mode is
	'Card rendering preset. contain shows the full image, cover fills the card frame, and custom uses saved position and zoom.';

comment on column public.food_image_assets.placement_version is
	'Placement rendering contract. Version 1 preserves legacy cover behavior; version 2 uses full-image-relative geometry.';
