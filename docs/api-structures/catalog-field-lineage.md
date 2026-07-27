# Catalog API Field Lineage

## Canonical Read Path

Every product returned by API v1 starts with one active row in `shared_products`.
That table is the canonical blendCalc catalog authority. External APIs and imported
datasets supply evidence for individual fields; no provider becomes the winner for an
entire product.

The read path is:

1. `get_blendcalc_product_v1` or `search_blendcalc_products_v1` selects an active
   `shared_products` row that passes the publication-readiness gate.
2. `catalogRead.server.ts` hydrates that row with its latest revision, enabled canonical
   category, selected field provenance, normalized nutrients, normalized servings, and
   active image assets.
3. `catalogApi.server.ts` serializes only the versioned API contract.
4. The response identifies `blendcalc-shared-catalog` as its authority and lists the
   underlying accepted data sources separately in `sourceAttributions`.

Private custom foods, user-list rows, submissions, rejected evidence, moderator
identities, and private Storage paths never enter this read path.

## Publication Readiness

`blendcalc_api_v1_product_readiness` evaluates every active shared-catalog row. Product
and search RPCs expose only rows with no readiness reasons.

A publishable row must have:

- an active shared-catalog record and at least one revision;
- a verification timestamp and enabled canonical category;
- selected evidence for every populated tracked field, including name and category;
- only database-approved sources with reviewed storage, licence, terms, and attribution
  metadata;
- at least one normalized nutrient, with a source reference and confidence for every
  nutrient;
- valid source references, confidence, and positive gram weights for every stored
  serving; and
- no selected field, nutrient, or serving from a source that is ineligible for API
  redistribution.

Images are evaluated independently. An otherwise publishable product remains available
when it has no image, but an image is omitted unless its asset row contains a licence
name, licence URL, and attribution text.

This gate records and enforces the repository's reviewed publication policy. It is an
engineering safeguard, not a substitute for professional legal review before a public
API launch.

## Product Response Fields

| API field | Canonical source | Population and validation |
| --- | --- | --- |
| `id` | `shared_products.id` | Stable canonical product UUID. |
| `barcode` | `shared_products.barcode` | Normalized GTIN-14 enforced by DB constraints and route validation. |
| `name` | `shared_products.product_name` | Requires selected `productName` provenance; provider-derived names are normalized before canonical storage. |
| `brand` | `shared_products.brand_owner` | `null` when absent; a populated brand requires selected `brandOwner` provenance. |
| `category` | `shared_products.category_option_id` → `custom_food_category_options` | Returns the enabled canonical option ID, label, normalized slug, and category update time. Selected `categories` provenance is required. |
| `ingredients.text` | `shared_products.food.ingredients` | Preserves the accepted source text; populated text requires selected `ingredients` provenance. |
| `ingredients.items` | `shared_products.food.ingredientList` | Deduplicated accepted ingredient strings. |
| `ingredients.structured` | `shared_products.food.structuredIngredients` | Accepted structured ingredient tree with percentages and nested ingredients; requires selected provenance when populated. |
| `ingredients.analysis` | `shared_products.food.ingredientAnalysis` | Accepted source analysis only; hypotheses do not become explicit allergen disclosures. |
| `ingredients.additives` | `shared_products.food.additives` | Deduplicated accepted additive identifiers with selected provenance when populated. |
| `ingredients.allergens` | `shared_products.food.allergens` | Explicit `contains`-style source evidence only. |
| `ingredients.traces` | `shared_products.food.traces` | Explicit `may contain`/trace source evidence only. |
| `ingredients.dietaryTags` | `shared_products.food.dietaryTags` | Accepted source dietary classifications with field provenance. |
| `ingredients.labels` | `shared_products.food.labels` | Accepted package/provider labels with field provenance. |
| `packageQuantity` | `shared_products.food.packageQuantity` | Accepted package label, amount, and unit; never used as an invented serving. |
| `sourceRecord` | `shared_products.food.sourceMetadata` | Preserves accepted provider record language, timestamps, schema/revision, quality tags, completeness, obsolescence, and per-field tag-source metadata. |
| `nutrients[]` | `food_nutrients` + `nutrient_definitions` | Normalized per-100g values, canonical names/numbers/units, value status, source reference, and confidence. Missing is `null`/absent, never invented zero. |
| `servings[]` | `food_servings` | Normalized label, gram weight, quantity, unit, primary state, conversion, source reference, and confidence. No serving produces an empty array and an honest 100g basis. |
| `images[]` | active `food_image_assets` | Public URL, thumbnail, role, placement, source, approval time, and asset-level licence/attribution. Private paths and reviewer IDs are excluded. |
| `warnings[]` | `shared_products.compatibility_summary` | DB-derived compatibility facts with stable code, friendly label, category, fact type, evidence source type, confidence, and source text. |
| `sourceAttributions[]` | `product_data_sources` | Deduplicated underlying sources actually represented by accepted fields, nutrients, or servings. Image credits stay on each image rather than changing product-data licensing. |
| `catalog` | API serializer + canonical row | Identifies `blendcalc-shared-catalog` as authority and reports active status, canonical verification state, reviewed redistribution policy, and represented source count. |
| `fieldSources` | selected `shared_product_field_provenance` → `shared_product_observations` | Field-by-field source, reference, and confidence for identity, category, ingredients, allergens, labels, package, and source metadata. |
| `revision` | latest `shared_product_revisions` + `shared_products` timestamps | Current revision ID/number, current-since time, observed label date, canonical update time, and verification time. |
| `links.self` | API serializer | Stable API v1 product URL using the canonical GTIN-14. |

## Category Response Fields

`GET /api/v1/categories` reads enabled `custom_food_category_options` directly.

| API field | DB column |
| --- | --- |
| `id` | `custom_food_category_options.id` |
| `name` | `custom_food_category_options.label` |
| `slug` | `custom_food_category_options.normalized_value` |
| `updatedAt` | `custom_food_category_options.updated_at` |

## What blendCalc Adds

API v1 is not a proxy for USDA, Open Food Facts, or a national dataset. It adds:

- one versioned canonical product identity and revision history;
- field-level source selection rather than whole-provider winners;
- normalized nutrient IDs, units, value status, and per-100g basis;
- normalized serving-to-weight conversions when evidence supports them;
- canonical category resolution across source vocabularies;
- explicit allergen versus trace separation;
- compatibility facts derived from stored evidence and DB rules;
- public image placement plus asset-specific rights metadata;
- source-policy gating and complete response attribution; and
- deterministic DB-only reads with no provider request during API traffic.

## Audit Command

Run the read-only row audit after migrations, source-policy changes, imports, moderation
publishing, or backfills:

```bash
npm run audit:api-catalog
```

It prints every active `shared_products` row, whether API v1 includes or withholds it,
the exact readiness reasons, selected field lineage, nutrient/serving/image source
counts, and image-rights status.

Use strict mode only when the release requirement is that every active catalog row must
be publishable:

```bash
npm run audit:api-catalog -- --strict
```
