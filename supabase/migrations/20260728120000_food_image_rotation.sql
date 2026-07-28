alter table public.food_image_assets
	add column if not exists rotation_degrees smallint not null default 0;

update public.food_image_assets
set rotation_degrees = 0
where rotation_degrees not in (0, 90, 180, 270);

alter table public.food_image_assets
	drop constraint if exists food_image_assets_rotation_degrees_check;

alter table public.food_image_assets
	add constraint food_image_assets_rotation_degrees_check
	check (rotation_degrees in (0, 90, 180, 270));

comment on column public.food_image_assets.rotation_degrees is
	'Clockwise card-image rotation in supported 90-degree increments.';
