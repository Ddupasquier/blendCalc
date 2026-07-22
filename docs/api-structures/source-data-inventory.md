# Source Data Inventory

This inventory explains what blendCalc may learn from each active source, where that
information enters the app, and what can become canonical blendCalc data. The database
policy is authoritative: a provider response is evidence, not automatic permission to
publish or redistribute it.

## Intake Flow

1. Read the active blendCalc catalog and legal source cache first.
2. Call an external source only for fields that are still missing.
3. Store the raw observation when its terms allow storage.
4. Map each accepted field to canonical data with its own source, reference, timestamp,
   confidence, and conversion or mapping method.
5. Publish only the active approved catalog record. Private evidence and raw cache rows
   never appear in API v1 responses.

`src/lib/server/products/externalProduct.server.ts` coordinates exact-barcode lookup.
Provider-specific behavior lives under `src/lib/server/products/sources/`, and outbound
requests use `src/lib/server/products/productApiRequests.server.ts` for timeouts,
coalescing, caching, request counts, and source-policy checks.

## Active Sources

| Source | Useful observed fields | Runtime/storage boundary |
| --- | --- | --- |
| USDA FoodData Central | Exact GTIN, source food id/type, names, brand, ingredients, nutrients, units, serving size, household serving, publication/update dates, categories | Barcode logic: `sources/usdaBarcodeProduct.server.ts`; search/detail caches and canonical promotion follow `product_data_sources` policy |
| Open Food Facts | Exact GTIN, names, brand, ingredients, allergens, traces, labels, categories, nutrients, serving text/weight/volume, package images, modification date | Barcode logic: `sources/openFoodFactsBarcodeProduct.server.ts`; reusable images require stored license and attribution metadata |
| Canadian Nutrient File 2026 | Generic-food identity, groups, preparations, nutrients, units, measures, release metadata | Imported through `scripts/imports/import_cnf_2026.mjs`; Open Government Licence – Canada canonical/API reuse is allowed with the stored Health Canada attribution and licence link; excluded third-party rights and non-endorsement limits still apply |
| UK CoFID 2021 | Generic-food identity, groups, preparations, nutrients, units, measures, release metadata | Imported through `scripts/imports/import_cofid_2021.mjs`; Open Government Licence v3.0 canonical/API reuse is allowed with the stored CoFID attribution and licence link; excluded third-party rights and non-endorsement limits still apply |
| Australian Food Composition Database | Generic-food identity, groups, preparations, nutrients, units, measures, release metadata | Registered but disabled until its click-through and share-alike terms are accepted for this project |
| User nutrition-label OCR | Text and nutrient candidates from a user-provided label | Tesseract runs on the client; no value is accepted until the user confirms it; shared-submission images remain private evidence |
| Community review | User-observed product identity, label values, serving information, ingredients, warnings, and images | Moderation may create a versioned canonical revision; evidence stays private and approved public images use separate storage |
| GS1 Digital Link | Normalized GTIN and standards-safe identifier parsing | Used only to resolve identifiers unless a separately approved data source supplies product fields |
| Wikimedia Commons | Licensed generic or product image metadata where a suitable asset is deliberately selected | May be rendered only from `food_image_assets` with stored license, attribution, and source reference |

## Useful Fields To Preserve

- **Identity:** normalized GTIN, provider ids, product and generic names, brand,
  manufacturer, preparation, region, language, and source subtype.
- **Dates and versions:** provider publication/modification dates, retrieval time,
  dataset release, file hash, label-observed date, canonical revision, and retirement
  state.
- **Composition:** raw and normalized nutrient ids, names, amounts, units, basis,
  reported/derived/missing state, uncertainty, mapping method, and conversions.
- **Serving and conversion:** label quantity, household measure, grams or milliliters,
  serving count, density evidence, aliases, and conversion provenance.
- **Package information:** ingredients, allergens, traces, dietary labels, raw source
  categories, canonical category, package quantity, and warnings.
- **Images:** role, original and thumbnail locations, source, license, attribution,
  approval state, dimensions, and non-destructive card placement.
- **Quality:** exact-match evidence, cross-source agreement or disagreement,
  completeness, confidence, moderation decision, source metrics, and correction history.

Missing values stay missing. A source omission is never converted to zero, and records
from different foods or preparations are never merged only because their names are
similar.

## Legal And Canonical Rules

- `product_data_sources` owns source identity, terms, attribution, enablement, and
  provenance.
- `generic_food_datasets` owns release-specific license review, import enablement,
  attribution, hashes, and activation.
- `food_image_assets` owns image license and attribution data.
- Raw provider caches are separate from approved blendCalc catalog records.
- New sources remain disabled for canonical storage until their terms are recorded and
  reviewed. Do not infer storage permission from a provider name.
- API v1 reads approved blendCalc catalog data only and never makes an external provider
  request.

## Adding A Source

1. Record source identity, terms, attribution, and storage policy in Supabase.
2. Add a focused server-only module under `src/lib/server/products/sources/`.
3. Use the shared request boundary; do not call `fetch` directly.
4. Preserve raw observations and map fields independently.
5. Add request-count, exact-match, missing-field, outage, cache, and legal-storage tests.
6. Update this inventory, generated API structure samples, and the schema documentation.
