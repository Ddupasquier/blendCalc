update public.food_image_assets
set crop_x = 50
where placement_version >= 2
	and crop_x < 50;

alter table public.food_image_assets
	drop constraint if exists food_image_assets_card_crop_x_check;

alter table public.food_image_assets
	add constraint food_image_assets_card_crop_x_check
	check (
		placement_version < 2
		or crop_x between 50 and 100
	);

comment on constraint food_image_assets_card_crop_x_check
	on public.food_image_assets is
	'Current card placements may remain flush with the outer edge or shift left, but cannot shift right and expose an outer gap.';
