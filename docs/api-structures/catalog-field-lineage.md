# blendCalcAPI Field Lineage

This guide traces each public API field from the canonical catalog through readiness,
resolution, and serialization. It does not replace the schema map or provider ledger.

## Quick Navigation

| Need                               | Sections                                                                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Follow the read pipeline           | [Canonical Read Path](#canonical-read-path) and [Field Resolution](#field-resolution)                                                                                   |
| Understand publication gates       | [Publication Readiness](#publication-readiness)                                                                                                                         |
| Trace response data                | [Product Response Fields](#product-response-fields), [Category Response Fields](#category-response-fields), and [Revision History Boundary](#revision-history-boundary) |
| Inspect private evidence           | [Moderator Evidence Read](#moderator-evidence-read)                                                                                                                     |
| Understand blendCalc's added value | [What blendCalc Adds](#what-blendcalc-adds) and [Audit Command](#audit-command)                                                                                         |

## Canonical Read Path

Every product returned by API v1 starts with one active row in `shared_products`.
That table is the canonical blendCalc catalog authority. External APIs and imported
datasets supply evidence for individual fields; no provider becomes the winner for an
entire product.

The server-only read path is:

1. A trusted server service-role client calls `get_blendcalc_product_v1` or
   `search_blendcalc_products_v1` to select an active `shared_products` row that passes
   the publication-readiness gate. Browser roles cannot execute these raw RPCs.
2. `catalogRead.server.ts` adds its latest revision, enabled canonical
   category, selected field provenance, normalized nutrients, normalized servings, and
   explicitly linked active image assets. Same-barcode image fallback remains available
   to the private app read model but is disabled for API v1.
3. `catalogApi.server.ts` rebuilds and sanitizes only the versioned API contract. It
   allowlists revision fields and value shapes, source tag keys, source references, and
   category columns rather than spreading raw database or JSON objects.
4. The response identifies `blendcalc-shared-catalog` as its authority and lists the
   underlying accepted data sources separately in `sourceAttributions`.

Private custom foods, user-list rows, submissions, rejected evidence, moderator
identities, private evidence and Storage paths, secrets, and package-instance data never
enter this read path. Pending, incomplete, and otherwise publication-ineligible catalog
records are withheld without deleting their evidence.

## Field Resolution

Exact-barcode drafts are resolved through field-resolution policy version 1. The policy
does not rank USDA, Open Food Facts, or another provider as the whole-product winner.
Each populated field—including product name and brand—must retain its own evidence
before it can be selected.

Candidates are compared by:

1. accepted field confidence;
2. completeness of that field;
3. observation recency; and
4. a deterministic tie-break that does not imply provider trust.

Nutrients are selected independently by canonical nutrient ID. Values are never
averaged, and mixed-source nutrient sets retain nutrient-level lineage rather than
receiving a fabricated whole-nutrition source. Data without explicit field lineage may
remain available for review, but it cannot receive canonical provenance or public API
publication readiness.

## Publication Readiness

`blendcalc_api_v1_product_readiness` evaluates every active shared-catalog row. Product
and search RPCs expose only rows with no readiness reasons.

A versioned row in `blendcalc_api_publication_profiles` owns the hard gates. The current
packaged-product profile requires:

- a valid exact GTIN, active shared-catalog record, current verification timestamp, and
  at least one immutable revision;
- product name, brand, enabled canonical category, ingredient statement, market, and
  source metadata, each with selected field evidence;
- only database-approved sources with reviewed storage, source name and URL, licence
  name and URL, attribution credit, and policy-review date; dataset-backed fields must
  also identify one active imported release with complete release attribution;
- every required nutrient from the linked completeness profile, with a nonnegative
  `reported`, `reported-zero`, or exactly explained `derived` value, approved canonical
  mapping, selected nutrient provenance, source reference, and confidence;
- an evidence-backed primary serving plus selected serving and gram-weight provenance;
- ingredient-list allergen evidence at minimum; and
- no unresolved medium/high material conflict or selected field, nutrient, or serving
  from a source that is ineligible for API redistribution.

Missing, trace, present-but-unquantified, invalid, and unmapped nutrient facts never
become numeric zero. An explicit zero is publishable only as `reported-zero` with the
same provenance requirements as any other value. Failed rows remain canonical review
candidates with observations and revision history intact; they are withheld rather than
deleted. The service-only readiness view reports `verified`, `under_review`, or
`incomplete`, exact block reasons, and separate identity, nutrition, serving,
ingredient/allergen, provenance, source-agreement, recency, and redistribution
dimensions for audit and moderation.

Images are evaluated independently. An otherwise publishable product remains available
when it has no image, but an image is omitted unless its asset row contains a source
identity and URL, licence name and URL, attribution text, and retrieval date.

This gate records and enforces the repository's reviewed publication policy. It is an
engineering safeguard, not a substitute for professional legal review before a public
API launch.

## Product Response Fields

| API field                 | Canonical source                                                           | Population and validation                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                      | `shared_products.id`                                                       | Stable canonical product UUID.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `barcode`                 | `shared_products.barcode`                                                  | Normalized GTIN-14 enforced by DB constraints and route validation.                                                                                                                                                                                                                                                                                                                                                                                               |
| `name`                    | `shared_products.product_name`                                             | Requires selected `productName` provenance; provider-derived names are normalized before canonical storage.                                                                                                                                                                                                                                                                                                                                                       |
| `brand`                   | `shared_products.brand_owner`                                              | `null` when absent; a populated brand requires selected `brandOwner` provenance.                                                                                                                                                                                                                                                                                                                                                                                  |
| `category`                | `shared_products.category_option_id` → `custom_food_category_options`      | Returns the enabled canonical option ID, label, normalized slug, and category update time. Selected `categories` provenance is required.                                                                                                                                                                                                                                                                                                                          |
| `ingredients.text`        | `shared_products.food.ingredients`                                         | Preserves the accepted source text; populated text requires selected `ingredients` provenance.                                                                                                                                                                                                                                                                                                                                                                    |
| `ingredients.items`       | `shared_products.food.ingredientList`                                      | Deduplicated accepted ingredient strings.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `ingredients.structured`  | `shared_products.food.structuredIngredients`                               | Accepted structured ingredient tree with percentages and nested ingredients; requires selected provenance when populated.                                                                                                                                                                                                                                                                                                                                         |
| `ingredients.analysis`    | `shared_products.food.ingredientAnalysis`                                  | Accepted source analysis only; hypotheses do not become explicit allergen disclosures.                                                                                                                                                                                                                                                                                                                                                                            |
| `ingredients.additives`   | `shared_products.food.additives`                                           | Deduplicated accepted additive identifiers with selected provenance when populated.                                                                                                                                                                                                                                                                                                                                                                               |
| `ingredients.allergens`   | `shared_products.food.allergens`                                           | Explicit `contains`-style source evidence only.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ingredients.traces`      | `shared_products.food.traces`                                              | Explicit `may contain`/trace source evidence only.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ingredients.dietaryTags` | `shared_products.food.dietaryTags`                                         | Accepted source dietary classifications with field provenance.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `ingredients.labels`      | `shared_products.food.labels`                                              | Accepted package/provider labels with field provenance.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `packageQuantity`         | `shared_products.food.packageQuantity`                                     | Accepted package label, amount, and unit; never used as an invented serving.                                                                                                                                                                                                                                                                                                                                                                                      |
| `sourceRecord`            | `shared_products.food.sourceMetadata`                                      | Preserves accepted provider record language(s), market countries, created/published/available/modified/updated/discontinued timestamps, schema/revision, quality tags, completeness, obsolescence, and per-field tag-source metadata.                                                                                                                                                                                                                             |
| `nutrients[]`             | `food_nutrients` + `nutrient_definitions`                                  | Normalized per-100g values, canonical names/numbers/units, source reference, confidence, and safe quality metadata: source value status, source-reported standard error, source nutrient key/code, mapping status/method, and derivation method. Missing is `null`/absent, never invented zero; internal mapping review references are excluded.                                                                                                                  |
| `servings[]`              | `food_servings`                                                            | Normalized label, gram weight, quantity, unit, primary state, measure type, household flag, source measure key, serving origin, gram-weight method, measured calculation basis, source reference, and confidence. No serving produces an empty array and an honest 100g basis.                                                                                                                                                                                    |
| `images[]`                | explicitly linked active `food_image_assets` + `product_data_sources`      | Public URL, thumbnail, role, placement, source name and URL, approval time, retrieval date, and asset-level licence/attribution. Private paths and reviewer IDs are excluded; an unrelated same-barcode image is never attached as an API fallback.                                                                                                                                                                                                               |
| `warnings[]`              | `shared_products.compatibility_summary`                                    | DB-derived compatibility facts with stable code, friendly label, category, fact type, evidence source type, confidence, and source text.                                                                                                                                                                                                                                                                                                                          |
| `compatibilityEvaluation` | API serializer + canonical food evidence                                   | Shared four-state compatibility contract and evidence coverage. Public API reads have no user profile, so they remain `not_checked`; authenticated app reads apply the same contract with the user's current policy and preferences.                                                                                                                                                                                                                              |
| `sourceAttributions[]`    | `product_data_sources` + `generic_food_datasets`                           | Deduplicated underlying sources actually represented by accepted fields, nutrients, or servings, including source name/URL, licence name/URL, credit, and policy-review date. Dataset-backed records additionally expose the exact imported release name, version, source URL, credit, and import date. Missing attribution withholds the product rather than inventing a fallback. Image credits stay on each image rather than changing product-data licensing. |
| `catalog`                 | API serializer + canonical row                                             | Identifies `blendcalc-shared-catalog` as authority and reports active status, canonical verification state, reviewed redistribution policy, and represented source count.                                                                                                                                                                                                                                                                                         |
| `fieldSources`            | selected `shared_product_field_provenance` → `shared_product_observations` | Field-by-field selected observation ID, neutral source/reference, confidence, observation date, bounded evidence method, and review state for identity, category, ingredients, allergens, labels, package, and source metadata. Missing lineage remains `null`; raw payloads, submissions, users, evidence paths, URLs, path-like references, and shared-catalog submission references are excluded.                                                              |
| `revision`                | latest `shared_product_revisions` + `shared_products` timestamps           | Current revision ID/number, current-since time, observed label date, canonical update time, and verification time.                                                                                                                                                                                                                                                                                                                                                |
| `links.self`              | API serializer                                                             | Stable API v1 product URL using the canonical GTIN-14.                                                                                                                                                                                                                                                                                                                                                                                                            |

## Moderator Evidence Read

`GET /api/moderation/catalog/products/{productId}/provenance` provides the deeper
field-evidence record needed for moderation. It requires a verified moderator, admin,
or developer role and always returns `Cache-Control: private, no-store`.

The response includes each field candidate's source and normalized values, selection
state, confidence, stored verification method, exact observation ID, source reference,
source licence, and observation dates. It also includes each accepted normalized
nutrient's source status, standard error, exact source key/code, mapping status/method,
internal mapping review reference, derivation method, and source observation, plus the
parent record's retained nonnumeric source nutrient facts. It deliberately excludes raw
provider payloads, submitter IDs, submission IDs, private evidence paths, and reviewer
identities.

Ordinary catalog and API v1 reads continue to receive only the bounded public-safe
vocabulary: exact barcode, package label, corroborated sources, or moderator reviewed.
An unrecognized verification method remains `null`.

## Category Response Fields

`GET /api/v1/categories` reads enabled `custom_food_category_options` directly.

| API field   | DB column                                       |
| ----------- | ----------------------------------------------- |
| `id`        | `custom_food_category_options.id`               |
| `name`      | `custom_food_category_options.label`            |
| `slug`      | `custom_food_category_options.normalized_value` |
| `updatedAt` | `custom_food_category_options.updated_at`       |

Additional database columns cannot enter the category response because the server query
selects and remaps only these four fields and OpenAPI rejects undeclared properties.

## Revision History Boundary

`get_blendcalc_product_revision_history_v1` is also server-service-role-only. The HTTP
serializer publishes immutable revision metadata plus only approved identity, serving,
ingredient, allergen, trace, and canonical nutrient changes. Stored moderator labels are
replaced with API-owned labels, unknown field paths are dropped, and nested objects are
reduced to bounded nutrient value/unit pairs. Revision snapshots, submission links,
reviewer identities, private evidence, and arbitrary stored JSON never cross the API.

## What blendCalc Adds

API v1 is not a proxy for USDA, Open Food Facts, or a national dataset. It adds:

- one versioned canonical product identity and revision history;
- field-level source selection rather than whole-provider winners;
- normalized nutrient IDs, units, value status, and per-100g basis;
- normalized serving-to-weight conversions when evidence supports them;
- canonical category resolution across source vocabularies;
- explicit allergen versus trace separation;
- compatibility facts derived from stored evidence and DB rules;
- one bounded compatibility evaluation contract that keeps source disclosures,
  personalized conflicts, and evidence coverage distinct;
- public image placement plus asset-specific rights metadata;
- source-policy gating and complete response attribution; and
- deterministic DB-only reads with no provider request during API traffic.

## Audit Command

The maintained catalog-readiness command, strict-mode behavior, and output contract are
documented in [`scripts/README.md`](../../scripts/README.md#catalog-and-api-audits). Run that
audit after migrations, source-policy changes, imports, moderation publishing, or
backfills that can affect this field-lineage contract.
