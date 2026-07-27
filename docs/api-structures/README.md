# API Structures

## blendCalc API v1

The app-owned read contract is published at
[`/api/v1/openapi.json`](../../static/api/v1/openapi.json). API v1 is currently an
authenticated, read-only internal preview. It reads active canonical blendCalc catalog
records only and does not call external providers during a request.

Every product read starts from `shared_products`, which is the canonical catalog
authority. The API hydrates that row from normalized nutrients, normalized servings,
the canonical category catalog, selected field provenance, revisions, compatibility
facts, and licensed image assets. It does not choose one external provider as the
winner for the complete product.

The existing app submission, evidence, and moderation pipeline remains the only write
path. Provider results and user label observations are intake evidence; they do not
write directly to the canonical API record.

Every product response includes a deduplicated `sourceAttributions` collection for the
sources represented by its accepted fields. The collection is loaded from
`product_data_sources` and preserves the configured source name, source URL, licence,
licence URL, and attribution statement instead of inferring legal metadata from a
provider key.

Product responses also preserve accepted structured ingredient trees, ingredient
analysis, additives, explicit allergen/trace disclosures, labels, package quantity,
provider record metadata, and field-specific sources. Missing values remain `null` or
empty collections according to the contract; derived ingredient trace hypotheses do
not become explicit `May contain` disclosures.

The database publication gate excludes any active catalog row whose populated fields,
nutrients, or servings lack accepted provenance or use a source without complete
reviewed redistribution metadata. Images are licensed independently and are omitted
when their asset-level licence or attribution is incomplete.

Public API keys, billing, developer accounts, and a public write API are deliberately
out of scope until the contract, redistribution rights, rate limits, and correction
process are ready.

The API contract version is independent from the blendCalc app release. App `V1`
currently means semantic version `1.0.0`; API v1 remains at response version `1.0`
and OpenAPI version `1.0.0` until its own response contract needs a deliberate version
change. The OpenAPI `x-blendcalc-status` field records that the API is still internal;
preview status is not part of the version number.

This folder contains generated reference files that describe the external food API
payloads observed by blendCalc scripts.

See [`source-data-inventory.md`](./source-data-inventory.md) for the app-owned source
map, useful fields, legal-storage boundaries, caching behavior, and the required process
for adding another provider.

See [`catalog-field-lineage.md`](./catalog-field-lineage.md) for the exact
`shared_products` read path, publication gate, response-field mapping, and row-level
audit command.

See [`../data-source-licensing.md`](../data-source-licensing.md) for the tracked licence,
attribution, current-compliance, and public-redistribution requirements for every source.

These files are documentation only. Do not import them from app code.

If runtime code needs types, create focused app-owned types in `src/lib/types` or the
relevant `src/lib/utils/**` module. Runtime types should model what the app actually
consumes, not every field a vendor may return.

The generator does not seed or mutate Supabase. It reads existing observed query terms
when Supabase script credentials are available, calls the external APIs, and writes
local documentation files.

## Regenerate

```bash
npm run generate:api-structures
```

The generator uses existing Supabase API-observation tables for sample queries. You can
pass explicit query terms for targeted inspection:

```bash
npm run generate:api-structures -- --query="almond milk" --query="protein bar" --samples=2
```

## Current coverage

- USDA FoodData Central search responses
- USDA FoodData Central food detail responses
- Open Food Facts search responses
- Open Food Facts product detail responses

These files represent observed response shapes from sampled payloads, not a
vendor-guaranteed complete contract.

When new external food APIs are added to the app, update
`scripts/generators/generate_api_structures.mjs` so this folder continues to reflect every active
external data source.
