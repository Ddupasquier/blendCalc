alter table public.food_image_assets
	add column if not exists placement_method text not null default 'default',
	add column if not exists placement_suggestion_version text,
	add column if not exists placement_suggestion_confidence numeric,
	add column if not exists placement_suggestion_accepted_at timestamptz;

update public.food_image_assets
set placement_method = case
	when
		placement_version >= 2
		and fit_mode = 'contain'
		and crop_x = 50
		and crop_y = 50
		and crop_zoom = 1
	then 'default'
	else 'manual'
end;

alter table public.food_image_assets
	drop constraint if exists food_image_assets_placement_method_check,
	add constraint food_image_assets_placement_method_check
		check (
			placement_method in (
				'default',
				'manual',
				'smart-ocr',
				'smart-ocr-adjusted'
			)
		),
	drop constraint if exists food_image_assets_placement_suggestion_confidence_check,
	add constraint food_image_assets_placement_suggestion_confidence_check
		check (
			placement_suggestion_confidence is null
			or placement_suggestion_confidence between 0 and 100
		),
	drop constraint if exists food_image_assets_smart_placement_provenance_check,
	add constraint food_image_assets_smart_placement_provenance_check
		check (
			placement_method not in ('smart-ocr', 'smart-ocr-adjusted')
			or (
				placement_suggestion_version is not null
				and placement_suggestion_confidence is not null
				and placement_suggestion_accepted_at is not null
			)
		);

comment on column public.food_image_assets.placement_method is
	'How the active card placement was chosen: default, manual, OCR suggestion, or an OCR suggestion followed by manual adjustment.';

comment on column public.food_image_assets.placement_suggestion_version is
	'App-owned version of the smart-placement scoring algorithm. Raw OCR text is intentionally not stored.';

comment on column public.food_image_assets.placement_suggestion_confidence is
	'Bounded 0-100 confidence assigned to the accepted smart-placement suggestion.';

comment on column public.food_image_assets.placement_suggestion_accepted_at is
	'Time the smart-placement draft was accepted through a save or moderation action.';
