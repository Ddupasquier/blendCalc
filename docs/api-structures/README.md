# API Structures

This folder contains generated reference files that describe the external food API payloads observed by blendCalc scripts.

These files are documentation only. Do not import them from app code.

If runtime code needs types, create focused app-owned types in `src/lib/types` or the relevant `src/lib/utils/**` module. Runtime types should model what the app actually consumes, not every field a vendor may return.

The generator does not seed or mutate Supabase. It reads existing observed query terms when Supabase script credentials are available, calls the external APIs, and writes local documentation files.

## Regenerate

```bash
npm run generate:api-structures
```

The generator uses existing Supabase API-observation tables for sample queries. You can pass explicit query terms for targeted inspection:

```bash
npm run generate:api-structures -- --query="almond milk" --query="protein bar" --samples=2
```

## Current coverage

- USDA FoodData Central search responses
- USDA FoodData Central food detail responses
- Open Food Facts search responses
- Open Food Facts product detail responses

These files represent observed response shapes from sampled payloads, not a vendor-guaranteed complete contract.

When new external food APIs are added to the app, update `scripts/generate_api_structures.mjs` so this folder continues to reflect every active external data source.
