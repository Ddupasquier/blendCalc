insert into public.product_data_sources (
	key,
	display_name,
	source_type,
	homepage_url,
	terms_url,
	attribution_text,
	enabled,
	provenance
)
values (
	'gs1-digital-link',
	'GS1 Digital Link',
	'standards_api',
	'https://www.gs1.org/standards/gs1-digital-link',
	'https://ref.gs1.org/standards/digital-link-uri-syntax/',
	'GS1 Digital Link standard',
	true,
	jsonb_build_object(
		'role', 'product_identifier_carrier',
		'gtin_application_identifier', '01',
		'lookup_policy', 'extract_gtin_locally_then_use_existing_db_first_lookup',
		'network_policy', 'never_fetch_arbitrary_scanned_urls',
		'privacy_policy', 'discard_lot_serial_query_and_fragment_before_persistence',
		'accessed_on', '2026-07-18'
	)
)
on conflict (key) do update
set
	display_name = excluded.display_name,
	source_type = excluded.source_type,
	homepage_url = excluded.homepage_url,
	terms_url = excluded.terms_url,
	attribution_text = excluded.attribution_text,
	enabled = excluded.enabled,
	provenance = excluded.provenance;
