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
| Understand future intake ownership  | [Shared Intake And Moderation](#shared-intake-and-moderation)                                                               |
| Understand database isolation       | [Publication Database Isolation](database-isolation.md)                                                                     |
| Inspect upstream provider samples   | [External API Structure References](../api-structures/README.md)                                                            |
| Review app-only intake observations | [App-Only Intake Contract](#app-only-intake-contract)                                                                       |

## blendCalcAPI v1 Status

| Property               | Current value                                                   |
| ---------------------- | --------------------------------------------------------------- |
| Status                 | Internal, read-only preview                                     |
| Access                 | Existing authenticated blendCalc Supabase session               |
| Base path              | `/api/v1`                                                       |
| Response version       | `1.0`                                                           |
| OpenAPI version        | `1.0.0`                                                         |
| Live provider requests | None; reads use stored canonical data only                      |
| Public API keys        | Credential lifecycle implemented; route access remains disabled |
| Public release         | Blocked pending the reviewed release process                    |

The executable contract is split between:

- [`static/api/v1/openapi.json`](../../../static/api/v1/openapi.json) for routes, schemas,
  status metadata, and authentication;
- `src/lib/blendCalcAPI/v1/blendCalcAPITypes.ts` for application-owned response types;
- versioned SvelteKit routes under `src/routes/api/v1/`;
- response serializers under `src/lib/server/blendCalcAPI/v1/`.

Open the OpenAPI document at `/api/v1/openapi.json`. To inspect raw API JSON in a
browser, sign in to blendCalc first and then open one of the endpoints below in the same
browser session. Public bearer keys and anonymous catalog access do not exist yet.

The application database remains the canonical source of truth. The separate
blendCalcAPI Supabase project is an isolated publication read model and receives only
complete, redistributable API snapshots. See
[Publication Database Isolation](database-isolation.md) for ownership, synchronization,
cutover, and rollback rules.

### Inspect The Published Catalog In Supabase

Open **Table Editor → Views → `blendcalc_api_v1_published_products`** to see every
canonical product currently exposed by blendCalcAPI v1. The view includes the product's
identity, catalog lineage, current revision, verification dates, publication profile,
quality dimensions, and exact API detail path. It is service-only and does not let app
clients bypass the versioned HTTP contract.

`shared_product_submissions` is community intake and review history. It is not the list
of products accepted for API publication. Accepted canonical records live in
`shared_products`; the published-products view contains only the subset that currently
passes `blendcalc_api_v1_product_readiness`.
Private user foods and their evidence never enter this intake automatically. Complete,
unchanged exact-source data may default to intake only when every represented source is
approved for canonical storage and the user leaves sharing enabled. User-entered
values, edits, corrections, and photos require an explicit community-share action
before the moderation and publication gates can consider that data.

The server can issue, expire, revoke, and atomically rotate high-entropy API keys while
storing only hashes and short display prefixes. This credential foundation does not by
itself expose any endpoint: keyed route access remains disabled until the reviewed
scope and public-access policies are implemented and enabled.

## Access Scopes

The database owns reviewed least-privilege scopes for the planned keyed API. Defining
these scopes does not enable public keys or anonymous access.

| Scope               | Planned responsibility                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| `catalog.read`      | Read bounded publication-ready catalog responses                         |
| `intake.write`      | Submit bounded observations through existing catalog intake              |
| `corrections.write` | Submit evidence-backed corrections without changing canonical data       |
| `moderation.read`   | Read private moderation work                                             |
| `moderation.write`  | Resolve moderation work and implicitly read the related queue            |
| `administration`    | Manage approved API access resources and explicitly includes every scope |

Scopes grant only their named responsibility. Catalog reads do not grant intake,
intake does not grant corrections, and neither ordinary write scope grants moderation.
Unknown scope values fail closed. Route enforcement will be enabled only through the
deliberate public-release process after API keys and terms are approved.

## App-Only Intake Contract

The versioned app-only intake payload is owned by
`src/lib/blendCalcAPI/intake/v1/blendCalcAPIIntakeTypes.ts`. It describes one current
package-label observation; it does not create an accepted product, select canonical
values, approve evidence, or publish anything through blendCalcAPI. Intake transport,
idempotency, persistence, moderation, and status routes remain separate implementation
responsibilities.

Every payload carries `intakeVersion: "1.0"`, its observation time, its catalog-share or
catalog-correction purpose, declared image evidence, and all nine source-neutral
observation sections:

1. product identity;
2. current label-revision context;
3. exact source servings;
4. numeric or qualitative nutrient observations;
5. ingredient statements and optional structure;
6. allergen and precautionary statements;
7. submitted category labels and optional validated app category selections;
8. GTIN and other source identifiers; and
9. image-evidence roles and intended use.

`reported`, `checked-none`, and `not-observed` remain distinct. An absent nutrient is
unknown, while an explicit label zero uses `reported-zero`. A count serving such as
`1 cookie` is valid without grams or milliliters and cannot produce per-100g math until
separate exact conversion evidence exists. Weight, volume, count, and package servings
retain their native basis rather than being converted by name.

Evidence descriptors contain a client-local reference, role, media type, byte count,
SHA-256 digest, and optional capture time. Observation fields reference those IDs; they
never contain Storage paths, private account identity, moderation decisions, or raw
image bytes. The trusted server derives the actor, verifies uploads and identifiers,
applies bounded validation, and creates immutable intake/moderation records. Canonical
selection and API publication continue to happen only after evidence review and the
existing readiness gates.

## Shared Intake And Moderation

Accepted app intake enters the existing catalog observation, submission, and moderation
pipeline through `submitCatalogIntake`. The current authenticated product-submission
route and any future app-only blendCalcAPI intake route share this boundary. It owns
unclaimed evidence cleanup and delegates validation, source comparison, duplicate
detection, revision classification, submission persistence, automated approval, and
moderator review to the established catalog services.

Intake does not write a second API-specific product or submission store. Canonical
products remain in `shared_products`, review work remains in
`shared_product_submissions`, and accepted source observations retain their existing
field-level provenance. The public v1 API remains read-only; this shared server boundary
does not expose a write endpoint or enable public API keys.

Future intake writes require an actor-scoped idempotency key and a server-computed
SHA-256 fingerprint before evidence upload or catalog mutation. The first request
acquires the key; concurrent retries remain in progress, changed payloads conflict, and
completed requests replay the original safe response. Processing keys are never stolen
after an arbitrary timeout, so an ambiguous worker failure cannot duplicate submissions,
revisions, observations, or images.

Future app-only intake persists each proposed field separately in
`shared_product_submission_field_evidence`. Every retained proposal keeps its exact
source value, nullable source unit and basis, matching source-observation record,
observation time, bounded unreviewed confidence, and private evidence identifiers.
Missing unit or basis never implies a conversion, and intake cannot label a proposal as
canonically verified. These rows are private moderation evidence; approval still
selects canonical lineage through `shared_product_field_provenance`.

App-only intake validates normalized product and brand identity before moderation can
accept proposed fields. The submitted identity is checked against the active canonical
record and every exact-barcode source record independently. Ordinary submissions fail
closed when canonical identity conflicts or every exact source is unrelated; mixed
source evidence, brand conflicts, unknown products, and explicit corrections require
complete package-evidence review. Exact identity never verifies unrelated fields.

## App-Only Intake

The signed-in blendCalc app is the first intake client. It submits product observations
through `POST /api/intake/v1/product-observations` using an existing verified Supabase
app session. API keys do not authorize this route, and `/api/v1` remains read-only.

The versioned app route reuses the existing catalog submission, evidence, deduplication,
and moderation pipeline; it never writes directly to the canonical catalog. The former
`POST /api/products/submissions` app route remains a compatibility alias while deployed
clients move to the versioned path. Intake versioning is independent from public read
API versioning, and enabling third-party writes requires a separate reviewed release.

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
response includes `x-blendcalc-api-version`; successful reads include a stable ETag,
honor `If-None-Match`, use private short-lived caching by default, and return errors with
`no-store`. Shared/CDN caching requires an explicit public route decision and is never
inferred from a successful authenticated response.

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

### Nutrient Basis And Provenance

Product nutrients remain normalized to `amountPer100g` for stable API comparisons. A
package-serving observation is converted only when its exact gram weight or another
reviewed, product-specific mass conversion is available. The normalized value is then
labeled `derived`,
while `quality.sourceValueStatus` continues to describe the untouched source
observation and `quality.derivationMethod` records
`exact-native-basis-to-100g`. Missing conversion evidence returns `null`; it never
creates an estimated mass value.

An exact package volume can satisfy the internal primary-serving requirement while
remaining volume-only. It does not make `amountPer100g` available by itself. Any
volume-to-mass conversion requires an active DB policy linked to the same product and
source observation. Serving completeness and provider redistribution eligibility are
independent gates, so repairing a serving does not publish restricted Open Food Facts
fields or nutrients.

An explicit bounded or unquantified label statement is published separately from exact
math. Its nutrient row uses `amountPer100g: null`, a qualitative `valueStatus`, and
`quality.reportedLimit` with the original statement and native basis. A limit such as
`<1 g per serving` is never serialized as exactly `1 g`, and a missing nutrient remains
missing rather than inheriting a qualitative state from its product category. Reviewed
package-label evidence may complete the app's internal food record without becoming API
output; it clears publication completeness only when its source policy independently
permits redistribution.

## Response Targets

The internal API has measured p95 response budgets for representative authenticated
reads. These are regression budgets for the repeatable local production-preview audit,
not promises enforced inside live request handling.

| Scenario            | p95 budget | What is measured                                 |
| ------------------- | ---------- | ------------------------------------------------ |
| Exact product       | 1,000 ms   | One publication-ready product by exact GTIN      |
| Category first page | 750 ms     | First 50 enabled canonical categories            |
| Search first page   | 1,000 ms   | First 15 publication-ready matches for one query |
| Warm product repeat | 250 ms     | Same exact product URL after one priming read    |

Run `npm run test:e2e:session:start`, then run
`npm run audit:blendCalcAPI-performance` in another terminal. The audit reports p50,
p95, and maximum latency. It uses `cache: no-store` with contract-valid URLs and a
stable URL for repeat reads so those two measurements cannot be silently conflated. Its
20-sample minimum keeps nearest-rank p95 distinct from the single slowest request. A
noisy audit failure does not alter API availability or catalog
data.

`npm run audit:blendCalcAPI-load` measures the common exact-product path, a broad first
search page, an empty search, a warmed product read, and a mixed concurrent read batch.
The bounded default uses five concurrent clients and fails on any unsuccessful response
or missed scenario p95 budget. It is a pre-beta regression audit, not a production
traffic generator or live request blocker.

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

The request boundary applies endpoint-specific burst and sustained quotas to each
available client identity: network address, authenticated account, and presented API
key. The private database consumes every applicable layer in one call; exceeding any
layer returns the documented `429 rate_limited` response and retry delay.

## Request Bounds

Every blendCalcAPI v1 read is bounded on the server:

- Authentication and account-block authorization use the verified server session. API
  routes do not accept an account, owner, role, or authorization decision from query,
  path, or browser state.
- Barcode path values must be exact digit-only GTINs with a valid check digit. The API
  does not apply the browser input sanitizer to punctuation, labels, or surrounding
  whitespace.
- Each endpoint accepts only its documented query parameters. Unknown and repeated
  parameters are rejected, pagination uses canonical base-10 whole numbers only, search
  text is limited to 120 characters, and the complete encoded query string is limited
  to 2,048 characters.
- Search, category, and revision pages enforce their documented maximum page sizes and
  a maximum offset of 1,000 before the database is queried.
- Catalog work has a 10-second deadline. The same abort signal is passed into the
  underlying database reads so timed-out work is stopped rather than merely hidden from
  the caller. A deadline returns the existing safe `503 service_unavailable` response.
- The v1 contract is read-only and exposes no request payload or upload endpoint.
  Mutable application routes must use the shared byte-limited JSON or form-data readers;
  an architecture test rejects direct request-body parsing elsewhere.
- Collection responses are bounded by pagination. Exact-product responses remain
  complete rather than being silently truncated; the read-only payload audit measures
  those responses before a new detail level or production response-size gate is added.

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
- Exact USDA nutrient identifiers can satisfy canonical mapping automatically only when
  the canonical unit and exact source reference also agree. Semantic nutrient matching
  never satisfies the publication gate automatically.
- Alcohol-by-volume and package-disclosure fields are included only when approved,
  redistributable field provenance exists.
- `safetyAlerts` contains only current exact or moderator-confirmed official notices
  with classification, reason, status, package-check guidance, source attribution, and
  the official link. An empty array means no current match was found in available data;
  it never means the product is guaranteed safe.
- Restricted provider evidence may support internal review without entering blendCalcAPI v1.
- A record can remain useful in the catalog while being withheld from public reads.
- Readiness reports classify source-licensing and redistribution exclusions separately
  from repairable catalog failures. A provider policy restriction is not a claim that
  the product data itself is inaccurate.

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
