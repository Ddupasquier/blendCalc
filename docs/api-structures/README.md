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
| `POST /api/publication-concerns` | Submit a bounded correction, attribution, privacy, source, or rights concern for one exact API subject. |
| `GET /api/moderation/publication-concerns` | Read the private unresolved concern queue and active holds through elevated AAL2 access. |
| `PATCH /api/moderation/publication-concerns` | Record the reviewed resolution of one concern. |
| `POST /api/moderation/publication-holds` | Immediately withhold one exact product, image, dataset release, or source. |
| `DELETE /api/moderation/publication-holds` | Release a hold after evidence-backed review without deleting its history. |

The existing app submission, evidence, and moderation pipeline remains the only path
that can propose canonical product data. Publication concerns can request review or
temporary withholding, but cannot directly rewrite catalog fields. Public API keys,
billing, developer accounts, and a public data-write API are out of scope until the
contract, redistribution rights, rate limits, and correction process are ready.
The source-controlled access policy and professional terms-review requirements live in
[`../public-api-release.md`](../public-api-release.md); public access cannot be enabled
through an environment-only switch.

Canonical storage is intentionally broader than API publication. The versioned
DB-backed packaged-product profile requires complete evidence-backed identity,
nutrition, serving, provenance, recency, redistribution, and conflict checks. Rows that
fail remain in the catalog for enrichment or review but are absent from API v1 reads.
Numeric zero is accepted only when its stored state is explicitly `reported-zero`;
missing never becomes zero.

Product responses include nullable explicit alcohol-by-volume and package-disclosure
fields only when the approved canonical revision has redistributable selected-field
provenance. Restricted temporary provider evidence is never substituted into API v1.

[`catalog-field-lineage.md`](./catalog-field-lineage.md) owns the canonical read path,
publication gate, product/category response mapping, missing-value semantics, revision
meaning, and moderator evidence boundary. The OpenAPI document and
`src/lib/api/v1/types.ts` remain the executable response contract.

Every route response is validated in tests against the exact OpenAPI schema for its
method and HTTP status. Success and error envelopes reject undeclared fields, so adding
an unversioned or private field to a serializer fails before release instead of silently
drifting from this contract.

## Privacy Boundary

The versioned HTTP routes are the only client-facing API boundary. Raw catalog RPCs are
restricted to the server service role; browser sessions cannot call them directly and
bypass the response serializer. The serializer uses explicit field allowlists rather
than returning database rows or stored JSON documents.

API v1 omits private custom foods, user-list state, pending or rejected submissions,
incomplete catalog candidates, submitter and moderator identities, private evidence and
Storage paths, secrets, and package-instance details such as lot, serial, and expiration
data. Revision history publishes only approved field names and bounded value shapes.
Images must be linked to the canonical product and carry complete public rights metadata;
an unrelated image with the same barcode is not an API fallback. Category responses are
rebuilt from the four documented public columns.

Every represented product-data source fails closed unless its database policy supplies
the source name and URL, licence name and URL, required credit, and redistribution-policy
review date. National composition records additionally resolve their exact imported
dataset release and expose its name, version, source URL, licence, credit, and import
date. Each image carries its own source name and URL, licence metadata, credit, and
retrieval date; incomplete asset attribution omits only that image, not the product.

These boundaries are covered by hostile serializer fixtures, route/OpenAPI contract
tests, RPC privilege tests, canonical-image association tests, and database fixtures for
explicit private and pending records. A new response field must pass those checks before
it can enter API v1.

## Corrections And Rapid Removal

Ordinary product corrections continue through the existing immutable product-update
submission and moderation flow. Providers, brands, users, rights holders, and other
reporters can additionally submit one exact product, image, dataset-release, or source
concern through `POST /api/publication-concerns`. The route accepts bounded HTTPS
evidence references, rate-limits signed-out callers, and returns only an opaque report
identifier and workflow status. Reporter contact details, private evidence, reviewer
identity, and internal notes never enter API v1.

An elevated AAL2 reviewer can inspect the private queue and place a reversible
publication hold. Product holds enter the existing material-conflict readiness gate;
source and dataset holds fail field attribution eligibility; image holds remove only
the affected image from public API hydration. A hold never deletes the canonical
product, revision history, source observation, image record, or submitted evidence.
Releasing it preserves the audit row and resolves only the conflict created by that
hold. The stable emergency operator command is `npm run api:publication -- ...`.

API v1 uses one safe error envelope for route validation, authentication, account
access, missing resources, unsupported methods, rate limits, catalog outages, and
unexpected server failures. Stable error codes and their HTTP statuses are owned by
`src/lib/api/v1/errors.ts` and mirrored by OpenAPI. Raw database, provider, moderation,
or server exception text is never returned. Request parsers may provide bounded,
user-correctable validation details; all later failures use the catalog's fixed wording.

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
