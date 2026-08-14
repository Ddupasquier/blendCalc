# blendCalc API And Provider References

This directory documents two separate boundaries:

1. **blendCalc API v1** — the app-owned, versioned HTTP contract for approved canonical
   catalog data.
2. **Provider reference files** — sampled documentation of external payloads used to
   maintain source adapters. These files are not runtime contracts.

## API v1 Status

| Property | Current value |
| --- | --- |
| Status | Internal, read-only preview |
| Access | Existing authenticated blendCalc Supabase session |
| Base path | `/api/v1` |
| Response version | `1.0` |
| OpenAPI version | `1.0.0` |
| Live provider requests | None; reads use stored canonical data only |
| Public API keys | Not available |
| Public release | Blocked pending the reviewed release process |

The executable contract is split between:

- [`static/api/v1/openapi.json`](../../static/api/v1/openapi.json) for routes, schemas,
  status metadata, and authentication;
- `src/lib/api/v1/types.ts` for application-owned response types;
- versioned SvelteKit routes under `src/routes/api/v1/`;
- response serializers under `src/lib/server/api/v1/`.

Open the OpenAPI document at `/api/v1/openapi.json`. To inspect raw API JSON in a
browser, sign in to blendCalc first and then open one of the endpoints below in the same
browser session. Public bearer keys and anonymous catalog access do not exist yet.

## Read Endpoints

| Method and path | Returns |
| --- | --- |
| `GET /api/v1/products/{barcode}` | One publication-ready canonical product identified by exact GTIN |
| `GET /api/v1/products/{barcode}/revisions` | Bounded approved revision metadata and evidence-backed field changes |
| `GET /api/v1/foods/search?q={query}` | Bounded, paginated publication-ready catalog search results |
| `GET /api/v1/categories` | Bounded, paginated enabled canonical categories |

All successful responses use the same envelope:

```json
{
  "apiVersion": "1.0",
  "data": {}
}
```

Paginated responses add `meta.pagination`. Errors use the documented safe error envelope
and never expose raw database, provider, moderation, or server exception text. Every
response includes `x-blendcalc-api-version`; successful reads use private short-lived
caching and errors use `no-store`.

Route tests validate every status against the exact OpenAPI schema. Undeclared response
fields are rejected rather than silently entering API v1.

## What Can Be Published

The shared catalog intentionally stores more than the API publishes. API v1 returns only
the current approved revision of a record that passes its DB-backed publication profile.
The gate checks identity, required nutrition, serving basis, provenance, recency,
redistribution rights, image rights, and unresolved material conflicts.

Important semantics:

- Missing information remains `null` or absent; it never becomes numeric zero.
- Zero is publishable only when its state is explicitly `reported-zero`.
- Derived values require their exact derivation evidence.
- Alcohol-by-volume and package-disclosure fields are included only when approved,
  redistributable field provenance exists.
- Restricted provider evidence may support internal review without entering API v1.
- A record can remain useful in the catalog while being withheld from public reads.

[Catalog Field Lineage](catalog-field-lineage.md) owns the field-by-field read path,
publication gate, missing-value semantics, revisions, and moderator evidence boundary.
[Shared Product Catalog](../shared-product-catalog.md) owns intake, canonicalization,
review, and revision behavior.

## Privacy And Rights

Versioned HTTP routes are the only client-facing catalog API boundary. Browser sessions
cannot call the service-role catalog RPCs directly. Serializers use explicit allowlists
instead of returning database rows or stored JSON snapshots.

API v1 excludes:

- private custom foods and user list state;
- pending, rejected, incomplete, or privately held submissions;
- submitter and reviewer identities;
- private evidence, internal notes, and private Storage paths;
- secrets and provider credentials;
- package-instance details such as lot, serial, and expiration values.

Each represented source must have reviewed database policy for its name, URL, licence,
required credit, and redistribution status. Each image must independently carry complete
public rights and attribution metadata. Missing image rights omit that image rather than
the entire otherwise eligible product.

[Data Source Licensing](../data-source-licensing.md) owns source-specific legal and
attribution requirements. [Public API Release](../public-api-release.md) owns the
professional terms review and deliberate public-access procedure; environment variables
alone cannot enable public release.

## Corrections And Rapid Removal

Normal product corrections use immutable update submissions and moderation. A bounded
publication concern can also identify one exact product, image, dataset release, or
source for correction, attribution, privacy, or rights review.

Related operational routes are deliberately outside `/api/v1`:

| Method and path | Responsibility |
| --- | --- |
| `POST /api/publication-concerns` | Submit one bounded concern and receive an opaque tracking identifier |
| `GET /api/moderation/catalog/products/{productId}/provenance` | Read private accepted and candidate evidence with an elevated role |
| `GET /api/moderation/publication-concerns` | Read unresolved concerns and active holds with elevated AAL2 access |
| `PATCH /api/moderation/publication-concerns` | Record a reviewed concern resolution |
| `POST /api/moderation/publication-holds` | Withhold one exact product, image, dataset release, or source |
| `DELETE /api/moderation/publication-holds` | Release a reviewed hold without deleting its history |

Publication holds are reversible. They never delete the canonical product, revision,
observation, image, or submitted evidence. The stable operator entry point is
`npm run api:publication -- ...`; exact examples live in that script's header and in
[Repository Scripts](../../scripts/README.md).

## Versioning

The API contract is versioned independently from the application. Compatible additions
remain under `/api/v1`; breaking response changes require a deliberate new major route.
Preview status is stored separately from semantic version metadata.

[Versioning](../versioning.md) owns release rules and consistency commands. Do not infer
an API release from the application package version.

## Provider Reference Files

| File | Purpose |
| --- | --- |
| [`source-data-inventory.md`](source-data-inventory.md) | Maintained map of provider capabilities, useful fields, and intake ownership |
| [`food-data-central.reference.ts`](food-data-central.reference.ts) | Sampled USDA FoodData Central search and detail payload shape |
| [`open-food-facts.reference.ts`](open-food-facts.reference.ts) | Sampled Open Food Facts search and detail payload shape |
| [`api-structure-summary.json`](api-structure-summary.json) | Machine-readable summary of the sampled provider structures |
| [`catalog-field-lineage.md`](catalog-field-lineage.md) | App-owned API v1 population and publication lineage |

The generated provider files are documentation only. They describe observed samples,
not complete vendor guarantees, and must never be imported into runtime code. Runtime
types should model only the fields blendCalc consumes and belong in the relevant
application source domain.

Regenerate the sampled files with:

```bash
npm run generate:api-structures
```

Use explicit terms for a focused inspection:

```bash
npm run generate:api-structures -- --query="almond milk" --query="protein bar" --samples=2
```

The generator may read stored observation terms and call external APIs, but it does not
seed or mutate Supabase. It currently covers USDA FoodData Central and Open Food Facts
search and product-detail responses.

When adding a provider, update the intake owner, source policy, licence record, provider
adapter, observed reference generator when applicable, tests, and
[Source Data Inventory](source-data-inventory.md) together. A new provider must improve a
specific field or coverage gap; it does not become a whole-product authority.
