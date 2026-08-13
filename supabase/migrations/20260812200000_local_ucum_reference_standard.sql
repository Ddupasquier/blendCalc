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
	'ucum-standard',
	'Unified Code for Units of Measure',
	'standards_api',
	'https://ucum.org/',
	null,
	'https://ucum.org/license',
	'Copyright 1999-2024 Regenstrief Institute, Inc. All rights reserved. Licensed under the UCUM License, Version 1.1. Provided AS IS without warranties or conditions of any kind. https://ucum.org/license',
	true,
	true,
	'UCUM License v1.1',
	'2026-08-12T00:00:00Z'::timestamptz,
	'blendCalc stores only a bounded reviewed set of UCUM unit codes and conversion factors. Public reuse must preserve UCUM origin, licence, and warranty-disclaimer references and must not imply endorsement or modify the meaning of UCUM codes.',
	false,
	jsonb_build_object(
		'identityOwner', 'migration',
		'sourceRole', 'reviewed_unit_standard',
		'specificationVersion', '2.2',
		'specificationUrl', 'https://ucum.org/ucum',
		'licenseVersion', '1.1',
		'licenseUrl', 'https://ucum.org/license',
		'reviewedAt', '2026-08-12T00:00:00Z'
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

update public.product_data_sources
set
	enabled = false,
	canonical_storage_allowed = false,
	api_redistribution_allowed = false,
	canonical_policy_notes = 'Historical NLM-hosted UCUM conversion service identity. blendCalc stopped making service requests after freezing its bounded reviewed conversions under ucum-standard.',
	provenance = coalesce(provenance, '{}'::jsonb) || jsonb_build_object(
		'retiredAt', '2026-08-12T00:00:00Z',
		'retirementReason', 'Replaced a seed-time network dependency with reviewed database reference data.',
		'replacementSourceKey', 'ucum-standard'
	)
where key = 'ucum-nlm';

update public.serving_measure_units
set
	source_key = 'ucum-standard',
	source_reference = 'https://ucum.org/ucum',
	observed_at = '2026-08-12T00:00:00Z'::timestamptz
where source_key = 'ucum-nlm';

update public.serving_measure_aliases
set source_key = 'ucum-standard'
where source_key = 'ucum-nlm';

alter table public.nutrient_unit_conversions
	drop constraint if exists nutrient_unit_conversions_conversion_method_check;

alter table public.nutrient_unit_conversions
	add constraint nutrient_unit_conversions_conversion_method_check check (
		conversion_method in (
			'api_observed_ratio',
			'standards_api',
			'reviewed_standard',
			'moderator_verified'
		)
	);

update public.nutrient_unit_conversions
set
	conversion_method = 'reviewed_standard',
	provenance = coalesce(provenance, '{}'::jsonb) || jsonb_build_object(
		'previousServiceReference', provenance ->> 'sourceReference',
		'sourceReference', 'https://ucum.org/ucum',
		'specificationVersion', '2.2',
		'licenseName', 'UCUM License v1.1',
		'licenseUrl', 'https://ucum.org/license',
		'reviewedAt', '2026-08-12T00:00:00Z'
	)
where conversion_method = 'standards_api'
	and coalesce(provenance ->> 'sourceReference', '') like 'https://ucum.nlm.nih.gov/%';
