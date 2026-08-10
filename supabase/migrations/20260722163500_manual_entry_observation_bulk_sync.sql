drop trigger if exists sync_nutrient_manual_entry_observations_after_change
	on public.nutrient_manual_entry_observations;

comment on function public.sync_nutrient_manual_entry_fields() is
	'Rebuilds manual-entry nutrient and group evidence summaries after a bounded bulk observation import. Maintenance writers must call this once after all observation batches complete; per-statement synchronization is intentionally disabled to avoid rescanning the full observation catalog after every batch.';
