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

The server first shadow-reads the isolated project and records only safe parity metrics.
The read switch remains reversible until post-cutover checks pass. Removing the old read
path is a later contract phase, not part of the initial switch.
