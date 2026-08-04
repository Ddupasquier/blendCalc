alter table public.mix_preferences
	alter column section_disclosure_state set default jsonb_build_object(
		'nutrient-shape', true,
		'goals', true,
		'selected-ingredients', true,
		'add-ingredients', true,
		'warnings', false,
		'suggested-adjustments', false,
		'nutrient-contributions', false
	);

update public.mix_preferences
set section_disclosure_state = section_disclosure_state || jsonb_build_object(
	'warnings', false,
	'suggested-adjustments', false,
	'nutrient-contributions', false
);
