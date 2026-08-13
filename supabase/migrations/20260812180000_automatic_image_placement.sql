alter table public.food_image_assets
	drop constraint if exists food_image_assets_placement_method_check,
	add constraint food_image_assets_placement_method_check
		check (
			placement_method in (
				'default',
				'manual',
				'automatic-ocr',
				'smart-ocr',
				'smart-ocr-adjusted'
			)
		),
	drop constraint if exists food_image_assets_smart_placement_provenance_check,
	add constraint food_image_assets_smart_placement_provenance_check
		check (
			placement_method not in (
				'automatic-ocr',
				'smart-ocr',
				'smart-ocr-adjusted'
			)
			or (
				placement_suggestion_version is not null
				and placement_suggestion_confidence is not null
				and (
					placement_method = 'automatic-ocr'
					or placement_suggestion_accepted_at is not null
				)
			)
		);

comment on column public.food_image_assets.placement_method is
	'How the active card placement was chosen: untouched default, manual adjustment, automatically applied OCR, accepted OCR suggestion, or accepted OCR followed by manual adjustment.';

comment on column public.food_image_assets.placement_suggestion_accepted_at is
	'Time a person accepted a smart-placement draft. This remains null for automatic-ocr backfills that were not individually accepted.';
