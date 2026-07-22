# API Structures

## blendCalc API v1

The app-owned read contract is published at
[`/api/v1/openapi.json`](../../static/api/v1/openapi.json). API v1 is currently an
authenticated, read-only internal preview. It reads active canonical blendCalc catalog
records only and does not call external providers during a request.

The existing app submission, evidence, and moderation pipeline remains the only write
path. Provider results and user label observations are intake evidence; they do not
write directly to the canonical API record.

Public API keys, billing, developer accounts, and a public write API are deliberately
out of scope until the contract, redistribution rights, rate limits, and correction
process are ready.

The API contract version is independent from the blendCalc app release. App `V1`
currently means semantic version `1.0.0`; API v1 remains at response version `1.0`
until its own response contract needs a deliberate version change.

This folder contains generated reference files that describe the external food API
payloads observed by blendCalc scripts.

See [`source-data-inventory.md`](./source-data-inventory.md) for the app-owned source
map, useful fields, legal-storage boundaries, caching behavior, and the required process
for adding another provider.

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
`scripts/generate_api_structures.mjs` so this folder continues to reflect every active
external data source.
