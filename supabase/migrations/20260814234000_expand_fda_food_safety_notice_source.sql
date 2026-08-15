update public.product_data_sources
set
	display_name = 'FDA Food Safety Notices',
	homepage_url = 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts',
	canonical_policy_notes = 'Official FDA recall announcements and openFDA enforcement records may be retained with source attribution. Product matches remain evidence-backed notices and are not medical advice.',
	provenance = provenance || jsonb_build_object(
		'enforcementApiUrl', 'https://api.fda.gov/food/enforcement.json',
		'recallAnnouncementIndexUrl', 'https://www.fda.gov/datatables-json/recalls-market-withdrawals.json?_format=json',
		'sourceRole', 'official_food_safety_notices'
	)
where key = 'open-fda-food-enforcement';
