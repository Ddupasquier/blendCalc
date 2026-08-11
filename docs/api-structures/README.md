# API Structures

## blendCalc API v1

The app-owned read contract is published at
[`/api/v1/openapi.json`](../../static/api/v1/openapi.json). API v1 is currently an
authenticated, read-only internal preview. It reads active canonical blendCalc catalog
records only and does not call external providers during a request.

## Endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /api/v1/products/{barcode}` | Read one publication-ready canonical product. |
| `GET /api/v1/products/{barcode}/revisions` | Read bounded immutable revision metadata and evidence-backed field changes. |
| `GET /api/v1/foods/search` | Search publication-ready canonical products with bounded pagination. |
| `GET /api/v1/categories` | Read enabled canonical food categories. |
| `GET /api/moderation/catalog/products/{productId}/provenance` | Read private accepted/candidate field evidence for an authorized moderator, admin, or developer. |

The existing app submission, evidence, and moderation pipeline remains the only write
path. Public API keys, billing, developer accounts, and a public write API are out of
scope until the contract, redistribution rights, rate limits, and correction process
are ready.

Canonical storage is intentionally broader than API publication. The versioned
DB-backed packaged-product profile requires complete evidence-backed identity,
nutrition, serving, provenance, recency, redistribution, and conflict checks. Rows that
fail remain in the catalog for enrichment or review but are absent from API v1 reads.
Numeric zero is accepted only when its stored state is explicitly `reported-zero`;
missing never becomes zero.

[`catalog-field-lineage.md`](./catalog-field-lineage.md) owns the canonical read path,
publication gate, product/category response mapping, missing-value semantics, revision
meaning, and moderator evidence boundary. The OpenAPI document and
`src/lib/api/v1/types.ts` remain the executable response contract.

The API contract version is independent from the blendCalc app release. App `V1`
currently means semantic version `1.0.0`; API v1 remains at response version `1.0`
and OpenAPI version `1.0.0` until its own response contract needs a deliberate version
change. The OpenAPI `x-blendcalc-status` field records that the API is still internal;
preview status is not part of the version number. Version-change rules and commands are
maintained in [`../versioning.md`](../versioning.md).

## Provider Reference Files

This folder also contains generated reference files that describe external food API
payloads observed by blendCalc scripts.

See [`source-data-inventory.md`](./source-data-inventory.md) for the app-owned source
map, useful fields, intake boundaries, and the required process for adding another
provider.

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
`scripts/generators/api/generate_api_structures.mjs` so this folder continues to reflect every active
external data source.
