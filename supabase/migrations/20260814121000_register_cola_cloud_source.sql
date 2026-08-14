insert into public.product_data_sources (
	key,
	display_name,
	source_type,
	homepage_url,
	api_base_url,
	terms_url,
	attribution_text,
	enabled,
	canonical_storage_allowed,
	canonical_license_name,
	canonical_policy_reviewed_at,
	canonical_policy_notes,
	api_redistribution_allowed,
	provenance
)
values (
	'cola-cloud',
	'COLA Cloud',
	'external_api',
	'https://colacloud.us/',
	'https://app.colacloud.us/api/v1',
	'https://colacloud.us/terms',
	'TTB COLA Public Registry data accessed through COLA Cloud',
	true,
	false,
	null,
	'2026-08-14T00:00:00Z'::timestamptz,
	'Approved only as an optional server-side exact-barcode lookup trial. COLA Cloud normalization, OCR, barcode extraction, and other enrichments are proprietary services even when underlying U.S. government facts are public domain. Do not promote provider responses into the canonical catalog, retain them as durable source observations, expose their label images, or redistribute them through API v1 without a separate written rights review or data licence.',
	false,
	jsonb_build_object(
		'identityOwner', 'migration',
		'sourceRole', 'us_alcohol_exact_barcode_fallback',
		'lifecycleStatus', 'trial',
		'supportedMarket', 'US',
		'barcodeMatchType', 'exact',
		'abvEvidenceType', 'source_or_ocr_reported',
		'officialSource', 'U.S. TTB COLA Public Registry',
		'officialSourceUrl', 'https://www.ttb.gov/regulated-commodities/labeling/cola-public-registry',
		'providerMethodologyUrl', 'https://docs.colacloud.us/trust/data-provenance',
		'apiDocumentationUrl', 'https://docs.colacloud.us/api-reference/barcodes/lookup-by-barcode',
		'termsReviewedAt', '2026-08-14T00:00:00Z',
		'publicApiEligible', false
	)
)
on conflict (key) do update
set
	display_name = excluded.display_name,
	source_type = excluded.source_type,
	homepage_url = excluded.homepage_url,
	api_base_url = excluded.api_base_url,
	terms_url = excluded.terms_url,
	attribution_text = excluded.attribution_text,
	enabled = excluded.enabled,
	canonical_storage_allowed = excluded.canonical_storage_allowed,
	canonical_license_name = excluded.canonical_license_name,
	canonical_policy_reviewed_at = excluded.canonical_policy_reviewed_at,
	canonical_policy_notes = excluded.canonical_policy_notes,
	api_redistribution_allowed = excluded.api_redistribution_allowed,
	provenance = public.product_data_sources.provenance || excluded.provenance;

insert into public.product_source_evaluations (
	source_key,
	evaluation_kind,
	decision,
	sample_size,
	matched_count,
	usable_count,
	summary,
	evidence_url,
	details,
	evaluated_at
)
select
	'cola-cloud',
	'lifecycle',
	'trial',
	1,
	1,
	1,
	'Initial exact-barcode smoke check returned an approved TTB label with explicit ABV and package volume. Representative cross-source coverage and field-accuracy benchmarking remain required before changing provider priority or permitting canonical use.',
	'https://docs.colacloud.us/trust/data-provenance',
	jsonb_build_object(
		'testedBarcode', '649754706570',
		'exactBarcodeMatch', true,
		'explicitAbvPresent', true,
		'providerCoverageClaim', 'Approximately 30 percent of COLA records contain an extractable barcode.',
		'benchmarkStatus', 'representative_benchmark_pending'
	),
	'2026-08-14T00:00:00Z'::timestamptz
where not exists (
	select 1
	from public.product_source_evaluations evaluation
	where evaluation.source_key = 'cola-cloud'
		and evaluation.evaluation_kind = 'lifecycle'
		and evaluation.evaluated_at = '2026-08-14T00:00:00Z'::timestamptz
);
