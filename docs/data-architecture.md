# Data Architecture

## Purpose

blendCalc uses Supabase as the permanent source of truth for account data and the
canonical food catalog. Browser storage is not a second database.

## API Correction Boundary

Public-data concerns are accepted only by the server route and stored in private
`api_publication_concerns`; browser roles have no direct table privileges. Exact targets
resolve against canonical IDs before storage, while contact details and evidence remain
outside API responses. Elevated AAL2 moderation routes read and resolve the queue.

`api_publication_holds` is a reversible publication control, not another canonical-data
store. Product holds feed the existing material-conflict readiness gate, source and
dataset holds feed field-level attribution eligibility, and image holds are filtered
during public API image hydration. App reads may retain canonical records for review,
but API v1 omits held output. No hold path deletes revision or evidence history.

## Read Flow

1. A protected route verifies the current user through `locals.getVerifiedUser()`.
2. Its `+page.server.ts` calls a focused server coordinator.
3. The coordinator starts independent Supabase reads together.
4. Server repositories receive an explicit `{ supabase, userId }` context.
5. SvelteKit serializes the result into `page.data` before the UI renders.
6. Later user-triggered refreshes use authenticated app endpoints whenever server-owned
   policy, canonical hydration, or personalized evaluation is required.

Fridge, Mix, and Saved follow this flow. They must not start their first durable-data
read from `onMount` or display a browser-storage mirror while Supabase is unavailable.

The same server-loaded application reference catalog owns fallback food symbols and
their reviewed resolution rules. Category rules select a broad symbol family; name
rules may refine only within that family. Prepared-food overrides run first, while a
bounded name-only fallback is reserved for missing or untrusted categories. Durable
food writes and backfills use the equivalent database resolver so stored snapshots and
rendered cards cannot drift into separate symbol policies.

The server-loaded application reference catalog also owns optional delight copy from
`app_delight_messages`. Client resolvers provide reviewed semantic trigger keys and may
render at most one matching line as secondary presentation. Standard and reviewed
playful copy are available by default to signed-in accounts, and the account can turn
playful messages off. The resolver independently restricts playful rows to approved
non-safety success triggers. This catalog never owns or replaces
authentication, safety, validation, warning, or failure instructions; those remain
stable code-based messages backed by server and database evidence.

## Write Flow

Durable writes use narrowly scoped Supabase functions. The database function:

- derives ownership from `auth.uid()`;
- validates the current database state;
- handles conflicts and related changes atomically;
- returns a small typed outcome such as `saved`, `duplicate`, or `move-required`;
- prevents direct authenticated table writes from bypassing the rule.

Client checks may provide faster feedback, but they are never the final authority.

## Browser State

Browser storage is limited to data that can be discarded safely:

- an unfinished, account-scoped Mix draft;
- device-only preferences;
- short-lived session context for the currently loaded saved recipe.

Fridge, Shopping List, custom foods, saved recipes, profiles, and canonical catalog data
must not be mirrored into local storage.

The account appearance theme is profile-owned durable data. A validated
`blendcalc-theme` cookie mirrors only that preference so SvelteKit can select the
correct theme before the page paints. The cookie is not a competing source of truth:
authenticated layout loads reconcile it from `profiles.appearance_theme`, and invalid
or missing values resolve to the device theme.

Profile-image policy acceptances preserve upload consent, while
`profile_image_reports` owns private, exact-image report and review history. Ordinary
uploads remain active and outside the moderation queue. Future social report intake and
current moderator reads/writes cross trusted server boundaries; browser clients receive
neither the report table nor reporter identity.

Mix section order and open/closed disclosure state are account-owned presentation
preferences stored in `mix_preferences`. Authenticated RPCs validate the complete set
of stable section identifiers before saving either preference; browser storage is not
used as a fallback authority.

Mix nutrient goals are normalized account data rather than browser preferences or a
numeric JSON map. DB-owned presets use stable identities and immutable reviewed
versions; private user presets are reusable snapshots. Applying a preset atomically
copies its targets into `user_mix_nutrient_goals`, preserving explicit exact, minimum,
maximum, or range semantics plus tolerance, weighting, basis, and source version. Later
preset revisions never mutate active goals silently. The shared evaluation utility is
the only app calculation path for chart status, warnings, adjustment scoring, Saved goal
progress, and aggregate goal match.

## External Sources

External food APIs are enrichment inputs, not live UI databases. Server code checks
blendCalc data first, requests only missing permitted fields, records field-level source
and license information, and stores accepted data in Supabase. Public/catalog reads do
not call external providers.

Product enrichment is field-based rather than provider-winner based. Exact identifiers
may link records, but similar names never establish identity. Raw or restricted
observations remain in their licensed cache/evidence boundary, while accepted canonical
fields retain their own provenance. Existing records receive the same applicable
backfill as future writes.

Exact USDA barcode lookup preserves its bounded detail read because the detail record
adds category and availability metadata omitted by search results. Shared caching and
request coalescing prevent repeated outbound detail calls. Stable UCUM unit codes and
bounded reviewed conversion factors are database reference data; seeding and runtime
reads do not depend on a remote unit-conversion service.

Ingredient search follows the same boundary. Exact normalized GTIN, USDA FDC, or
reviewed legacy-source identifiers may connect noncanonical search records. The search
read model then resolves names, categories, servings, preparation details, safety data,
and each canonical nutrient independently from field provenance; it never averages
values or joins records by title similarity. Every complete dataset attribution remains
attached to the merged result. If a shared-catalog product is present, its accepted
canonical revision remains untouched—transient provider data cannot enrich it without a
persisted observation and revision.

Catalog storage and API publication are separate trust boundaries. Useful immutable
observations may be retained broadly, accepted fields may enter the canonical catalog,
and only canonical revisions satisfying the active DB-backed publication profile enter
API v1. Publication fails closed on incomplete identity, nutrition, serving, provenance,
source policy, recency, or unresolved material conflicts. Withholding never deletes the
underlying evidence or revision history.

The reusable `catalog_product_readiness` record makes that separation explicit. Shared
catalog state controls whether blendCalc can search and use a canonical product; API v1
readiness independently controls whether that product may be redistributed publicly.
Operational gaps are normalized through `catalog_health_issue_occurrences` and stable
`app_issue_codes`, rather than reconstructed independently in each dashboard.
The product-readiness passport is the bounded per-product projection of that model for
privileged review and operations. It exposes status and coverage summaries while raw
evidence remains behind its existing server and database boundaries.
Approved catalog-health repairs follow the same boundary. An AAL2 data operator first
runs a non-mutating exact-evidence check, then may apply only the candidates returned by
that current check. Immutable run and item records preserve what was considered and
what changed; unresolved evidence cannot be promoted by the repair path. Revision
repairs use a dedicated private handler behind the same public RPC: exact approved
submissions or source observations may restore a missing baseline, and an existing
valid structured revision summary may restore its queryable field-change rows. No
snapshot comparison or best-effort inference is permitted.
Canonical product images follow the same evidence-first rule without creating routine
review work. The database selects one exact licensed or moderator-approved front image
only when no eligible canonical image exists, keeps later alternatives as candidates,
and automatically promotes a replacement only after the selected image becomes
ineligible. App hydration prefers that durable selection; API hydration excludes
alternate and barcode-only images.

Nutrient mapping follows the same automation-first boundary. Exact reviewed provider
identifiers and source keys remain active without human review. Name or observation
similarity may create a disabled candidate, but only a focused AAL2 data-operations
decision can promote it. The database limits the selector to nutrients with an exact
unit match or reviewed source-specific conversion and records approval or exclusion as
immutable private evidence. Resolved and rejected mappings leave the operational queue;
historical nutrient facts are never silently rewritten by the decision.

API v1 database readers are server-service-role-only. Browser sessions reach catalog
data through the versioned HTTP routes, whose serializers rebuild explicit public
objects and reject undeclared fields. Private foods, user-list state, pending review
records, identities, evidence paths, secrets, package-instance data, arbitrary revision
JSON, and unrelated same-barcode image assets cannot bypass that boundary.

The provider capability map, legal policy, and catalog merge behavior are maintained in
the [`source data inventory`](api-structures/source-data-inventory.md),
[`licensing ledger`](data-source-licensing.md), and
[`shared product catalog`](shared-product-catalog.md), respectively.

### Scheduled Revalidation And Official Safety Notices

External data maintenance is asynchronous. An hourly Supabase Cron request invokes the
secret-authenticated `catalog-monitor` Edge Function, which claims small due batches
from Supabase rather than scanning the catalog or calling providers during a user read.
The monitor is disabled by default until its deployment and secrets are verified.
During the additive rollout, current application readers recognize only the exact
missing-table, missing-column, or missing-function errors introduced by this migration.
They omit optional delight copy and recall data, preserve the existing food-symbol
catalog, and leave monitoring paused until the expanded schema is present. Permission
errors and unrelated database failures still fail closed. This keeps every established
view usable before, during, and after migration delivery without disguising access or
integrity failures.

Product revalidation follows this sequence:

1. The database prioritizes recently used products and queues only exact known Open
   Food Facts or USDA source identities.
2. Open Food Facts revision/update metadata is checked before a full payload. USDA
   re-fetches only the known FDC id under the configured request budget.
3. The provider response is normalized and hashed. Unchanged records are rescheduled
   without creating duplicate evidence.
4. A changed response creates an immutable source observation and normalized snapshot.
   Material identity, serving, nutrient, ingredient, allergen, image, or ABV differences
   become a review candidate; the active catalog product is not overwritten.
5. An accepted correction still uses the ordinary catalog revision workflow. A monitor
   review cannot claim acceptance without linking the approved revision it produced.

Provider changes, product conflicts, and confirmed warning reports keep immutable
correction-origin rows separate from mutable queue status. The database links an origin
to a real evidence-backed correction by exact product, base revision, and overlapping
changed fields. One approval transaction records the resulting immutable revision and
resolves every linked origin; an unsuccessful correction releases the origin rather
than discarding it. This preserves automatic intake while preventing monitoring or a
moderation decision from fabricating canonical product changes.

Official FDA recall announcements and enforcement records share one FDA-owned cursor
with independent bounded offsets; USDA FSIS uses its own cursor, retry, and history.
An unchanged FDA announcement index is skipped with conditional requests, and an
unavailable safety source does not stop the other source or product revalidation.
The database matches exact normalized GTINs automatically, sends strong brand/product/
package identity matches to moderation, and ignores weak title-only similarity. Exact
and confirmed active matches are hydrated onto catalog-backed foods, enqueue owner-only
notification records, and tell the user when package, lot, or use-by details still need
checking. Closed official records supersede visible matches without deleting evidence.

The safety surface is an official-data aid, not proof that an unmatched package is safe
and not medical advice. Public responses expose only current normalized notice fields,
source attribution, and the official link; raw provider payloads, match evidence,
moderator identity, and user notification state stay private.

## Operational Analytics

Vercel Web Analytics owns anonymous page-view collection and the explicitly registered
`auth_login_success`, `auth_logout_success`, and `page_reload` events. Application code
sends only the stable event name; it does not attach email addresses, user ids, product
identifiers, search terms, or free-form properties. Analytics and Speed Insights strip
query strings and URL hashes before sending page URLs.

A protected production cron route queries Vercel's aggregate API each day for the
previous three completed UTC days. It atomically replaces that bounded range in
`app_interaction_daily_metrics`, allowing delayed Vercel processing to settle without
collecting raw clickstream data. The sync stores totals, anonymous daily visitor counts,
and framework route patterns—not request paths or Vercel visitor hashes. Raw Vercel
Drains are intentionally not used.

Production configuration requires `VERCEL_ANALYTICS_ACCESS_TOKEN`, the Vercel-provided
`VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` for team-owned projects, and `CRON_SECRET`.
`VERCEL_ANALYTICS_SYNC_LOOKBACK_DAYS` may be set from 1 through 31 and defaults to 3.
Vercel plan support is required for custom-event collection; page-view aggregation
remains independently useful when custom events are unavailable.

## Serving Provenance And Conversion

Serving labels, gram weights, household measures, and conversion lineage cross the
provider boundary as one typed record. Source adapters require an explicit recognized
unit and preserve whether a measure came from a package label, a source household
measure, a direct reported weight, or unknown evidence. Manual values are explicitly
user-entered. Bare provider quantities never inherit the interactive form's default
gram unit.

Normalized `food_servings` rows retain the exact observation, source measure metadata,
serving origin, gram-weight method, and measured calculation basis. Nutrition presents
that information in Product details. Mix performs basic weight math in code and may
calculate weight from volume only when the food has a source-reported or user-reported
weight/volume pair. Food names, categories, provider identity, and water-like defaults
never supply density.

## Nutrient Values And Uncertainty

Normalized nutrient math and source-review evidence are separate contracts. Accepted
numeric values live in `food_nutrients` and `foodNutrients`; each retains whether the
value was reported, explicitly reported as zero, or derived. Source-reported standard
error, source nutrient identifiers, mapping status/method, review reference, and exact
derivation method travel with the value but never modify its amount.

Generic source facts that cannot enter math—trace, present but unquantified, missing,
invalid, excluded, or unmapped rows—remain in `nutrientSourceReview`. They are not
coerced to zero and are not discarded. Ordinary nutrition details translate only
bounded useful summaries into the closed Data quality disclosure. The public API omits
internal mapping review references; moderator-only provenance reads receive the exact
normalized rows and complete source review trail.

Nutrition-detail routes may attach fresh canonical catalog metadata to the hydrated food
read model for the closed Food passport. That route-only metadata includes accepted
record creation, last verification, latest revision, and label-observation dates. It is
read from normalized catalog tables, is not copied into user list snapshots or browser
storage, and remains absent for private or generic foods when the concepts do not apply.

## Server-Owned Compatibility Policy

Compatibility rules and ingredient/taxonomy match patterns remain behind the server
boundary. Server coordinators evaluate versioned DB policy and canonical/source facts
against the signed-in user's preferences, then return bounded disclosures, warnings,
coverage, and stable issue codes. Browser components render those results and friendly
messages; they do not infer safety from product text or execute policy patterns.

The server selects the sole active policy version, then reads extraction and conflict
rows explicitly bound to that version. Database active-only views preserve stable names
for trigger and RPC execution without allowing draft or retired rules into runtime
evaluation. Policy activation is one service-only database transaction that snapshots
and hashes the complete bundle, changes the active version, refreshes all compatibility
facts, and rebuilds preference options. Application code never combines rows from
different policy versions or performs an independent partial activation.

Raw account preference wording remains in `user_food_preferences`. A database trigger
projects it into server-owned `user_compatibility_rules`, where every value is either
linked to one exact reviewed tag/term/alias mapping for the active policy or marked
unresolved. Application warning logic consumes only resolved canonical tags; browser
code receives bounded resolution status and never performs synonym or fuzzy matching.

The schema map owns compatibility tables and version relationships. The catalog
document owns product fact extraction, evidence meaning, and moderation lifecycle. This
document owns only the server/client boundary.

Reported ingredient lists and trees are normalized by database triggers into ordered,
source-linked relational evidence. That projection preserves provider wording and
structure but does not guess missing percentages, split raw statements, or create
canonical taxonomy automatically. Reviewed ingredient terms, derivative relationships,
processing states, jurisdiction rules, and compatibility inheritance remain
server-owned policy; clients receive only bounded explanations and disclosures.
The server also builds the ingredient presentation contract used by nutrition details:
nested paths, explicitly reported percentage labels, additives, source analysis,
coverage, and exact warning evidence. Browser components render that bounded contract
and never reinterpret source percentages, infer ingredient classifications, or rebuild
the policy evidence behind a warning.
The server policy loader also resolves reviewed language-tagged aliases and immutable
regional exemption conditions for one active version. Structured ingredient and
explicit allergen/trace fields may create canonical facts only through those reviewed
rows. Unsupported declared languages make policy coverage incomplete; ordinary client
code never translates, fuzzily matches, or supplies a synonym fallback.

Food identity also fails closed. A provider adapter translates only its own reviewed
record vocabulary into `packaged` or `generic`; private manual entries use
`private-custom`. The source-neutral resolver may recognize concrete package evidence
such as an exact GTIN or brand, but it never interprets provider datatype strings.
Records without explicit identity remain `unknown`, receive no generic or packaged
nutrition-completeness profile, and cannot be reported as fully checked by
identity-dependent food-safety policy.

Package precautionary statements use the same evidence-first boundary. Source adapters
preserve exact wording and classify only the statement form (`may contain`, shared
equipment, shared facility, or another precautionary form). Database projections attach
the statement to its observation and revision; policy facts attach the reviewed match
rule. Clients may present friendly headings, but they do not rewrite the source
statement, infer risk severity from the wording, or promote ingredient hypotheses into
package declarations.

When a provider supplies both a flat trace array and exact precautionary wording for
the same allergen, the exact statement-linked fact is canonical. Extraction removes
the duplicate flat trace fact while preserving the lossless statement, source field,
observation, revision, and immutable policy link. Internal predecessor implementations
live outside the public schema so database helpers do not silently expand the Data API.

## Module Boundaries

- `src/routes/**/+page.server.ts`: route authentication handoff and thin load wiring.
- `src/lib/server/moderation`: shared moderator role enforcement and bounded privileged
  read repositories. Catalog health uses the caller's authenticated client so the RPC
  must pass its independent role check; browser code never scans operational tables.
- `src/lib/server/user-data`: page-level server coordination.
- `src/lib/server/user-data/foodListPlacement.server.ts`: exact-source enrichment before
  authoritative Fridge or Shopping List placement.
- `src/lib/utils/food/records/exactSourceListEnrichment.ts`: evidence-aware list
  snapshot resolution. Exact identity permits field comparison, not whole-record
  replacement. Missing fields may be filled, while populated fields change only for
  stronger accepted evidence after review state, confidence, completeness, and
  observation time are compared. Private foods and user-label fields remain owned by
  the user, and every accepted change stores its field, source, and selection reason in
  the saved snapshot.
- `src/lib/server/food-safety`: cached DB policy loading, compatibility evaluation,
  allergen disclosure normalization, and personalized warning annotation.
- `src/lib/utils/storage/supabase`: browser-safe identity reads and authoritative RPC
  adapters that do not evaluate canonical food-safety data.
- `src/lib/utils/storage/client`: browser event coordination and temporary UI state.
- `src/routes/api`: authenticated server boundaries for user-triggered writes and
  browser pagination/search reads that require server-owned policy evaluation.
- `supabase/migrations`: constraints, policies, triggers, and authoritative write
  functions.

## Adding Durable Data

Before adding a new durable feature:

1. Design the normalized schema, indexes, constraints, and RLS.
2. Add one authoritative write path that derives the user from the session.
3. Add a focused server repository that accepts an explicit server context.
4. Load initial route data on the server.
5. Keep only temporary drafts or device preferences in browser storage.
6. Test success, conflicts, missing data, permission boundaries, and database failure.
