# External API Structure References

This directory documents external provider capabilities and sampled payload shapes.
These files help maintain source adapters; they are not blendCalcAPI contracts and must
not be imported into application code.

| File                                                               | Purpose                                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------- |
| [`source-data-inventory.md`](source-data-inventory.md)             | Provider capabilities, useful fields, and intake ownership     |
| [`food-data-central.reference.ts`](food-data-central.reference.ts) | Sampled USDA FoodData Central search and detail payload shapes |
| [`open-food-facts.reference.ts`](open-food-facts.reference.ts)     | Sampled Open Food Facts search and detail payload shapes       |
| [`api-structure-summary.json`](api-structure-summary.json)         | Machine-readable summary of sampled provider structures        |

Regenerate the sampled references with:

```bash
npm run generate:api-structures
```

For a focused inspection:

```bash
npm run generate:api-structures -- --query="almond milk" --query="protein bar" --samples=2
```

The generator may read stored observation terms and call external APIs, but it never
mutates Supabase. Samples document observed responses rather than complete provider
guarantees. When adding a provider, update its adapter, source policy, licensing entry,
source inventory, and generated reference coverage together.

The application-owned API contract is documented separately in
[blendCalcAPI](../blendCalcAPI/README.md).
