# Source Data Inventory

This inventory explains what blendCalc can observe from each configured source and
where that information enters the app. It does not decide whether observed data may be
stored, promoted, rendered, or redistributed; those decisions belong to
[`data-source-licensing.md`](../data-source-licensing.md) and the database source
policy.

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

## Active Intake Sources

| Source | Useful observed fields | Intake module or path |
| --- | --- | --- |
| USDA FoodData Central | Exact GTIN, source food id/type, names, brand, ingredients, nutrients, units, serving size, household serving, package weight, market country, publication/availability/update/discontinued dates, and categories | `src/lib/server/products/sources/usdaBarcodeProduct.server.ts` |
| Open Food Facts | Exact GTIN, names, brand, raw and recursive structured ingredients, ingredient analysis, additives, explicit allergens, explicit traces, labels, categories, nutrients, serving text/weight/volume, package quantity, package images, language, market countries, record/schema revisions, source timestamps, completeness, quality/obsolete state, and tag-source metadata | `src/lib/server/products/sources/openFoodFactsBarcodeProduct.server.ts` |
| Canadian Nutrient File 2026 | Generic-food identity, groups, preparations, nutrients, units, measures, release metadata | `scripts/imports/nutrition/import_cnf_2026.mjs` |
| UK CoFID 2021 | Generic-food identity, groups, preparations, nutrients, units, measures, release metadata | `scripts/imports/nutrition/import_cofid_2021.mjs` |
| User nutrition-label OCR | Text and nutrient candidates from a user-provided label | Tesseract runs on the client; no value is accepted until the user confirms it; shared-submission images remain private evidence |
| Community review | User-observed product identity, label values, serving information, ingredients, warnings, and images | Moderation may create a versioned canonical revision; evidence stays private and approved public images use separate storage |
| GS1 Digital Link | Normalized GTIN and standards-safe identifier parsing | Used only to resolve identifiers unless a separately approved data source supplies product fields |
| UCUM | Reviewed unit codes and bounded mass, energy, and serving-measure conversion factors | Stored in Supabase and the maintained local reference catalog; no runtime or seed-time standards service request |

## Registered But Inactive Sources

| Source | Potential fields | Current intake state |
| --- | --- | --- |
| Australian Food Composition Database Release 3 | Generic-food identity, groups, preparations, nutrients, units, measures, release metadata | Dataset and source records exist, but imports are disabled. |
| Wikimedia Commons | Per-asset image and attribution metadata | The image schema supports the source, but there is no general ingestion feed. |
| FoodRepo | Exact-barcode product metadata | Retired and disabled; production code does not call it. |

The licensing document owns the reason and release conditions for every disabled or
restricted source. This inventory records only capability and intake state.

USDA exact-barcode lookup normally uses one bounded search plus one cached/coalesced
detail read. The detail record is retained because it adds source category and
availability metadata that search results omit. Open Food Facts remains the field-level
supplement for missing package images, ingredients, allergens, traces, labels,
categories, servings, and nutrition rather than a whole-product replacement.

Run `node scripts/audits/food-sources/audit_generic_dataset_contribution.mjs` to measure
CNF and CoFID records, nutrients, measures, exact identifiers, and a balanced search
corpus. Exact source identifiers are identity evidence; normalized-name or search
overlap is contribution evidence only and never merges foods.

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
- **Package information:** raw and structured ingredients, ingredient percentages and
  analysis, additives, explicit allergens, explicit traces/advisories, dietary labels,
  raw source categories, canonical category, package quantity, and warnings.
- **Images:** role, original and thumbnail locations, source, license, attribution,
  approval state, dimensions, and non-destructive card placement.
- **Quality:** exact-match evidence, cross-source agreement or disagreement, source
  record/schema revisions, language, source timestamps, tag-source evidence,
  completeness, quality tags, obsolete state, confidence, moderation decision, source
  metrics, and correction history.

Missing values stay missing. A source omission is never converted to zero, and records
from different foods or preparations are never merged only because their names are
similar.

When imported generic records declare an exact shared identifier, ingredient search may
assemble one read result per field. The strongest evidenced category, serving,
preparation detail, safety field, and canonical nutrient can come from different linked
records. The result preserves each selected field source and every complete dataset
attribution; it does not grant publication rights or alter the canonical catalog.
Private unmatched user foods do not participate in this provider-record merge.

## Ownership Boundaries

This inventory records provider capabilities and intake locations, not legal
interpretation or publication workflow:

- [`../data-source-licensing.md`](../data-source-licensing.md) owns the reviewed terms,
  attribution, storage, rendering, and redistribution decision for each source.
- [`../shared-product-catalog.md`](../shared-product-catalog.md) owns canonical promotion,
  field selection, revisions, and moderation.
- [`catalog-field-lineage.md`](catalog-field-lineage.md) owns the API v1 publication gate
  and response-field source mapping.
- [`../supabase-schema.md`](../supabase-schema.md) maps `product_data_sources`,
  `generic_food_datasets`, `food_image_assets`, and provider observation storage.

Provider adapters must preserve the fields listed here without treating observation as
permission to publish. The database policies referenced by those documents decide what
may become canonical or public.

## Adding A Source

1. Record source identity, terms, attribution, and storage policy in Supabase.
2. Add a focused server-only module under `src/lib/server/products/sources/`.
3. Use the shared request boundary; do not call `fetch` directly.
4. Preserve raw observations and map fields independently.
5. Translate the provider's identity vocabulary inside that provider adapter. Unknown
   record types must remain unknown rather than inheriting a packaged or generic
   fallback from shared application code.
6. Add request-count, exact-match, unknown-identity, missing-field, outage, cache, and
   legal-storage tests.
7. Update this inventory and generated API structure samples; update the licensing,
   catalog, API-lineage, or schema document only when its owned contract also changes.
