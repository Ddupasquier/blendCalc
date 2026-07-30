# Data Architecture

## Purpose

blendCalc uses Supabase as the permanent source of truth for account data and the
canonical food catalog. Browser storage is not a second database.

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
- short-lived session context for the currently loaded saved drink.

Fridge, Shopping List, custom foods, saved drinks, profiles, and canonical catalog data
must not be mirrored into local storage.

The account appearance theme is profile-owned durable data. A validated
`blendcalc-theme` cookie mirrors only that preference so SvelteKit can select the
correct theme before the page paints. The cookie is not a competing source of truth:
authenticated layout loads reconcile it from `profiles.appearance_theme`, and invalid
or missing values resolve to the device theme.

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

The provider capability map, legal policy, and catalog merge behavior are maintained in
the [`source data inventory`](api-structures/source-data-inventory.md),
[`licensing ledger`](data-source-licensing.md), and
[`shared product catalog`](shared-product-catalog.md), respectively.

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

## Server-Owned Compatibility Policy

Compatibility rules and ingredient/taxonomy match patterns remain behind the server
boundary. Server coordinators evaluate versioned DB policy and canonical/source facts
against the signed-in user's preferences, then return bounded disclosures, warnings,
coverage, and stable issue codes. Browser components render those results and friendly
messages; they do not infer safety from product text or execute policy patterns.

The schema map owns compatibility tables and version relationships. The catalog
document owns product fact extraction, evidence meaning, and moderation lifecycle. This
document owns only the server/client boundary.

## Module Boundaries

- `src/routes/**/+page.server.ts`: route authentication handoff and thin load wiring.
- `src/lib/server/user-data`: page-level server coordination.
- `src/lib/server/user-data/foodListPlacement.server.ts`: exact-source enrichment before
  authoritative Fridge or Shopping List placement.
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
