# Publication Database Isolation

## Purpose

blendCalcAPI uses a separate Supabase project as a server-only publication read model.
This separation reduces the data and privileges reachable from the API runtime without
creating a second canonical catalog or copying private application records.

## Ownership Boundary

The blendCalc application project remains authoritative for:

- Auth users, profiles, private foods, Fridge, Shopping List, Mix, and Saved data;
- provider caches and observations, raw evidence, source policy, and licensing review;
- submissions, moderation, conflicts, concerns, holds, and reviewer identity;
- canonical products, revisions, nutrients, servings, ingredients, allergens, images,
  safety notices, and publication readiness.

The blendCalcAPI project stores only complete public projections:

- current publication-ready product detail and search payloads;
- public revision summaries;
- enabled public category payloads;
- required public source attribution;
- generation hashes, counts, timestamps, and transition audit records.
- privacy-safe request, cache-validation, latency, result-count, shadow-parity, and
  publication-sync observations used by operators.

It never stores application Auth users, private foods, user-list state, submissions,
moderation notes, provider credentials, raw provider payloads, private evidence paths,
restricted source fields, or unpublished canonical observations.

## Publication Generations

Synchronization builds a complete immutable generation before making it readable. The
source catalog supplies expected counts and a content hash. The target database refuses
to mark the generation ready until products, revisions, categories, and attributions
match those counts.

Activation changes one complete generation at a time. Products omitted because of a
hold, withdrawal, source-policy change, or canonical correction disappear together when
the replacement activates. A partial or failed sync never alters the active generation.
The prior complete generation remains available for an immediate operator rollback.

Backup recovery starts from the canonical blendCalc backup, not from the isolated read
model. The maintained `recovery:blendCalcAPI` drill restores the backup at its recorded
migration point, migrates it forward, rebuilds the isolated generation, verifies
count/content-hash parity, and exercises the real rollback contract in two disposable
local Supabase stacks. The API database is therefore reproducible output and is never a
source of truth.

Generation state is:

1. `building` while the server writes a new snapshot;
2. `ready` after target-side count and integrity verification;
3. `active` after source-to-target parity verification;
4. `retired` after replacement while retained for bounded rollback;
5. `failed` when a safe machine-readable failure code ends the attempt.

## Runtime Boundary

Vercel remains the versioned HTTP, authentication, request-bound, rate-limit, and
serializer boundary. Browser code receives no URL or key for the isolated project. The
server validates the existing blendCalc session or future blendCalcAPI credential, then
uses a separate server-only client to read the active publication generation.
Vercel Functions run in `pdx1` so server-side reads stay beside the `us-west-2`
application and publication databases instead of crossing the country from the default
`iad1` region. Static assets remain globally distributed by Vercel.

Hosted Supabase keeps its required `public` and `graphql_public` Data API schemas in the
exposure list and appends `blendcalc_api`. The isolated migration grants no browser-role
access to the publication schema, so schema exposure does not bypass the server-only
privilege boundary.

The root Supabase CLI link must remain attached to the application project. Local API
database work uses `infrastructure/blendCalcAPI`, distinct ports, a distinct project ref,
and distinct credentials. No generic linked migration command may target both projects.

## Cutover Gates

Production reads remain on the application database until all of these pass:

1. Every currently published GTIN has identical v1 detail output.
2. Representative exact, partial, broad, empty, category, and deepest bounded searches
   return the same ordered public records and pagination metadata.
3. Revision history, categories, attribution, ETags, and missing-value semantics match.
4. A held or withdrawn product disappears from a complete replacement generation.
5. A failed or partial sync leaves the current generation untouched.
6. A previous generation can be restored without copying or rebuilding data.
7. Browser roles have no schema usage or table privileges.
8. Response, payload, query-plan, and bounded-load audits meet the existing v1 budgets.
9. Backup, restore, monitoring, alerts, and credential rotation are verified.

The scheduled server synchronization builds and atomically activates a complete target
generation. A protected GitHub workflow calls the production synchronization route
every 15 minutes. Vercel also calls it once daily as an independent Hobby-compatible
fallback. Both schedulers use the same `CRON_SECRET` authorization boundary, and the
GitHub workflow requires the public route URL in the `BLENDCALC_API_SYNC_URL` repository
variable. `BLENDCALC_API_READ_MODE=shadow` continues returning canonical source reads
while recording only hashes and match state from isolated reads. After parity passes,
`isolated` selects the publication database; `source` remains the immediate rollback.
Removing the old read path is a later contract phase, not part of the initial switch.

## Operational Visibility

The isolated project owns service-role-only operational views so monitoring cannot
become a dependency of the public read path. `api_request_operations_dashboard`
reports request volume, p50/p95 latency, database time, result counts, client/server
errors, rate limits, and conditional-request cache effectiveness over 24-hour, 7-day,
and 35-day windows. `api_shadow_parity_dashboard` reports source/target comparison
volume, failures, and p95 timings. `publication_generation_operations_dashboard` and
`publication_operations_dashboard` report generation state and age, expected and
target counts, source and verified-target hashes, sync duration and failures, product
additions/removals, and the most recently observed production read mode.

Raw request observations expire after 35 days. They never store URLs, query text,
barcodes, user or network identifiers, credentials, request bodies, or response
payloads. Recording is fail-open: an observation failure is logged safely and never
changes a blendCalcAPI response or publication result.

Operators can inspect the views in the blendCalcAPI Supabase SQL Editor or call the
server-only `GET /api/internal/blendCalcAPI/operations` route with
`Authorization: Bearer <CRON_SECRET>`. The route returns `private, no-store` JSON and
uses the same private operations credential as publication synchronization.
