# blendCalcAPI

This directory documents the app-owned, versioned HTTP contract for approved canonical
catalog data. External provider payloads remain separately documented under
[`docs/development/api-structures`](../api-structures/README.md); they are not blendCalcAPI contracts.

`blendCalcAPI` is the canonical product name for blendCalc's app-owned food-data API.
Use `blendCalcAPI v1` when referring to the current contract, `internal blendCalcAPI v1`
for its current access state, and `public blendCalcAPI` for the planned public service.
Technical identifiers such as `/api/v1`, `BlendCalcAPIV1*`, database object names, and response
fields retain their stable versioned names.

## Quick Navigation

| Need                                | Sections                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Understand API access and stability | [blendCalcAPI v1 Status](#blendcalcapi-v1-status), [Versioning](#versioning), and [Privacy And Rights](#privacy-and-rights) |
| Inspect available reads             | [Read Endpoints](#read-endpoints)                                                                                           |
| Review response budgets             | [Response Targets](#response-targets)                                                                                       |
| Understand publication rules        | [What Can Be Published](#what-can-be-published) and [Corrections And Rapid Removal](#corrections-and-rapid-removal)         |
| Inspect upstream provider samples   | [External API Structure References](../api-structures/README.md)                                                            |

## blendCalcAPI v1 Status

| Property               | Current value                                     |
| ---------------------- | ------------------------------------------------- |
| Status                 | Internal, read-only preview                       |
| Access                 | Existing authenticated blendCalc Supabase session |
| Base path              | `/api/v1`                                         |
| Response version       | `1.0`                                             |
| OpenAPI version        | `1.0.0`                                           |
| Live provider requests | None; reads use stored canonical data only        |
| Public API keys        | Not available                                     |
| Public release         | Blocked pending the reviewed release process      |

The executable contract is split between:

- [`static/api/v1/openapi.json`](../../../static/api/v1/openapi.json) for routes, schemas,
  status metadata, and authentication;
- `src/lib/blendCalcAPI/v1/blendCalcAPITypes.ts` for application-owned response types;
- versioned SvelteKit routes under `src/routes/api/v1/`;
- response serializers under `src/lib/server/blendCalcAPI/v1/`.

Open the OpenAPI document at `/api/v1/openapi.json`. To inspect raw API JSON in a
browser, sign in to blendCalc first and then open one of the endpoints below in the same
browser session. Public bearer keys and anonymous catalog access do not exist yet.

## Read Endpoints

| Method and path                            | Returns                                                              |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `GET /api/v1/products/{barcode}`           | One publication-ready canonical product identified by exact GTIN     |
| `GET /api/v1/products/{barcode}/revisions` | Bounded approved revision metadata and evidence-backed field changes |
| `GET /api/v1/foods/search?q={query}`       | Bounded, paginated publication-ready catalog search results          |
| `GET /api/v1/categories`                   | Bounded, paginated enabled canonical categories                      |

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

### Pagination

| Read              | Default limit | Maximum limit | Maximum offset |
| ----------------- | ------------: | ------------: | -------------: |
| Product search    |            15 |            50 |          1,000 |
| Categories        |            50 |           100 |          1,000 |
| Product revisions |            25 |           100 |          1,000 |

`limit` and `offset` must be whole numbers inside those bounds. Every paginated response
returns the applied limit and offset, total result count, whether another page exists,
and the next offset. Search results, categories, and revisions each use deterministic
database ordering with a unique final key, so following `nextOffset` visits the bounded
result set once without page overlap.

Route tests validate every status against the exact OpenAPI schema. Undeclared response
fields are rejected rather than silently entering blendCalcAPI v1.

## Response Targets

The internal API has measured p95 response budgets for representative authenticated
reads. These are regression budgets for the repeatable local production-preview audit,
not promises enforced inside live request handling.

| Scenario            | p95 budget | What is measured                                 |
| ------------------- | ---------- | ------------------------------------------------ |
| Exact product       | 1,000 ms   | One publication-ready product by exact GTIN      |
| Category first page | 750 ms     | First 50 enabled canonical categories            |
| Search first page   | 1,000 ms   | First 15 publication-ready matches for one query |
| Warm product repeat | 150 ms     | Same exact product URL after one priming read    |

Run `npm run test:e2e:session:start`, then run
`npm run audit:blendCalcAPI-performance` in another terminal. The audit reports p50,
p95, and maximum latency. It uses unique URLs for cold scenarios and a stable URL for
repeat reads so those two measurements cannot be
silently conflated. A noisy audit failure does not alter API availability or catalog
data.

## Query Plan Audit

Run `node scripts/audits/catalog/audit_blendCalcAPI_query_plans.mjs` after starting the
local test database. The read-only audit measures exact-product, representative search,
broad search, deepest bounded search and revision pages, plus first and deepest category
pages. It also inspects the exact-product and broad-search core predicates so index use
is visible even though PostgreSQL reports security-definer API functions as function
scans.

The report includes planning and execution time, buffers, node types, and sequential
scans. A sequential scan requests index review only after processing at least 10,000
rows. This keeps small-table scans visible without adding speculative indexes that cost
more to maintain than they save.

## Provider Independence

Every blendCalcAPI read uses stored, publication-ready canonical data. API routes never
contact USDA, Open Food Facts, COLA, recall feeds, or another external provider while
serving a request. Provider enrichment and monitoring remain separate background intake
workflows, so an upstream outage or rate limit cannot turn into a blendCalcAPI read
failure. Architecture and route tests block live-provider imports, direct outbound
requests, and accidental provider fallback inside the versioned read boundary.

Optional analytics and intake processing are not read-path dependencies. Required
source attribution uses a short server cache with stale-on-error protection: a transient
refresh failure may reuse the last complete verified attribution catalog, while an
initial failure still fails closed. Core catalog failures continue to return the safe
documented unavailable response.

## Payload Measurement

Run `npm run audit:blendCalcAPI-payloads` against the prepared local preview to measure
the exact and gzip-estimated byte size of a full product, first search page, maximum
category page, and maximum revision page. The audit is read-only, authenticates like an
ordinary app session, and does not turn observational measurements into a production
request blocker.

No reduced-detail response shape exists today because no current client has demonstrated
a need for one. Adding summary/detail modes would expand the versioned contract and its
test matrix; that complexity is justified only when measured payloads and a real client
workflow show that the complete canonical response is wasteful.

## What Can Be Published

The shared catalog intentionally stores more than the API publishes. blendCalcAPI v1 returns only
the current approved revision of a record that passes its DB-backed publication profile.
The gate checks identity, required nutrition, serving basis, provenance, recency,
redistribution rights, image rights, and unresolved material conflicts.

Important semantics:

- Missing information remains `null` or absent; it never becomes numeric zero.
- Zero is publishable only when its state is explicitly `reported-zero`.
- Derived values require their exact derivation evidence.
- Alcohol-by-volume and package-disclosure fields are included only when approved,
  redistributable field provenance exists.
- `safetyAlerts` contains only current exact or moderator-confirmed official notices
  with classification, reason, status, package-check guidance, source attribution, and
  the official link. An empty array means no current match was found in available data;
  it never means the product is guaranteed safe.
- Restricted provider evidence may support internal review without entering blendCalcAPI v1.
- A record can remain useful in the catalog while being withheld from public reads.

[Catalog Field Lineage](catalog-field-lineage.md) owns the field-by-field read path,
publication gate, missing-value semantics, revisions, and moderator evidence boundary.
[Shared Product Catalog](../shared-product-catalog.md) owns intake, canonicalization,
review, and revision behavior.

## Privacy And Rights

Versioned HTTP routes are the only client-facing catalog API boundary. Browser sessions
cannot call the service-role catalog RPCs directly. Serializers use explicit allowlists
instead of returning database rows or stored JSON snapshots.

blendCalcAPI v1 excludes:

- private custom foods and user list state;
- pending, rejected, incomplete, or privately held submissions;
- submitter and reviewer identities;
- private evidence, internal notes, and private Storage paths;
- secrets and provider credentials;
- package-instance details such as lot, serial, and expiration values.

Official safety output also excludes raw recall payloads, private matching evidence,
probable matches awaiting review, moderator identity, and per-user notification state.

Each represented source must have reviewed database policy for its name, URL, licence,
required credit, and redistribution status. Each image must independently carry complete
public rights and attribution metadata. Missing image rights omit that image rather than
the entire otherwise eligible product.

[Data Source Licensing](../data-source-licensing.md) owns source-specific legal and
attribution requirements. [Public blendCalcAPI Release](public-release.md) owns the
professional terms review and deliberate public-access procedure; environment variables
alone cannot enable public release.

## Corrections And Rapid Removal

Normal product corrections use immutable update submissions and moderation. A bounded
publication concern can also identify one exact product, image, dataset release, or
source for correction, attribution, privacy, or rights review.

Related operational routes are deliberately outside `/api/v1`:

| Method and path                                               | Responsibility                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `POST /api/publication-concerns`                              | Submit one bounded concern and receive an opaque tracking identifier |
| `GET /api/moderation/catalog/products/{productId}/provenance` | Read private accepted and candidate evidence with an elevated role   |
| `GET /api/moderation/publication-concerns`                    | Read unresolved concerns and active holds with elevated AAL2 access  |
| `PATCH /api/moderation/publication-concerns`                  | Record a reviewed concern resolution                                 |
| `POST /api/moderation/publication-holds`                      | Withhold one exact product, image, dataset release, or source        |
| `DELETE /api/moderation/publication-holds`                    | Release a reviewed hold without deleting its history                 |

Publication holds are reversible. They never delete the canonical product, revision,
observation, image, or submitted evidence. The stable operator entry point is
`npm run blendCalcAPI:publication -- ...`; exact examples live in that script's header and in
[Repository Scripts](../../../scripts/README.md).

## Versioning

The API contract is versioned independently from the application. Compatible additions
remain under `/api/v1`; breaking response changes require a deliberate new major route.
Preview status is stored separately from semantic version metadata.

[Versioning](../versioning.md) owns release rules and consistency commands. Do not infer
an API release from the application package version.

## Related Provider Documentation

The [External API Structure References](../api-structures/README.md) own sampled USDA
and Open Food Facts payload shapes plus the maintained source-capability inventory.
Those documents support adapters and source policy; they do not define blendCalcAPI.
