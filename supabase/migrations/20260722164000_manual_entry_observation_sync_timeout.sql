alter function public.sync_nutrient_manual_entry_fields()
	set statement_timeout = '60s';

comment on function public.sync_nutrient_manual_entry_fields() is
	'Rebuilds manual-entry nutrient and group evidence summaries once after a bounded bulk observation import. The maintenance-only function receives a 60-second database timeout because it deliberately aggregates the complete observation catalog; interactive requests must not call it.';
