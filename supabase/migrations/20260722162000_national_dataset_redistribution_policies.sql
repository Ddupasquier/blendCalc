update public.product_data_sources
set
	canonical_storage_allowed = true,
	canonical_license_name = 'Open Government Licence – Canada',
	canonical_policy_reviewed_at = '2026-07-22T00:00:00Z'::timestamptz,
	canonical_policy_notes = 'Repository policy review confirmed that the published Open Government Licence – Canada permits commercial and non-commercial copying, modification, publication, adaptation, distribution, and other lawful reuse with source attribution. Canonical/API reuse must retain the configured Health Canada attribution and licence URL, must not imply endorsement, and must exclude third-party rights, protected marks, logos, or personal information not covered by the licence.',
	provenance = coalesce(provenance, '{}'::jsonb) || jsonb_build_object(
		'canonical_policy_review', jsonb_build_object(
			'reviewed_at', '2026-07-22T00:00:00Z',
			'dataset_key', 'cnf-2026',
			'dataset_url', 'https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109',
			'licence_url', 'https://open.canada.ca/en/open-government-licence-canada',
			'official_guidance_url', 'https://open.canada.ca/en/frequently-asked-questions',
			'requires_attribution', true,
			'public_api_eligible', true
		)
	)
where key = 'health-canada-cnf';

update public.product_data_sources
set
	canonical_storage_allowed = true,
	canonical_license_name = 'Open Government Licence v3.0',
	canonical_policy_reviewed_at = '2026-07-22T00:00:00Z'::timestamptz,
	canonical_policy_notes = 'Repository policy review confirmed that the published Open Government Licence v3.0 permits copying, publication, distribution, adaptation, and commercial or non-commercial reuse with source acknowledgement. Canonical/API reuse must retain the configured CoFID attribution and licence URL, must not imply endorsement, and must exclude third-party rights, protected marks, logos, or personal information not covered by the licence.',
	provenance = coalesce(provenance, '{}'::jsonb) || jsonb_build_object(
		'canonical_policy_review', jsonb_build_object(
			'reviewed_at', '2026-07-22T00:00:00Z',
			'dataset_key', 'cofid-2021',
			'dataset_url', 'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid',
			'licence_url', 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
			'requires_attribution', true,
			'public_api_eligible', true
		)
	)
where key = 'uk-cofid';

update public.generic_food_datasets
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
	'canonical_policy_reviewed_at', '2026-07-22T00:00:00Z',
	'canonical_storage_allowed', true,
	'requires_attribution', true
)
where key in ('cnf-2026', 'cofid-2021');
