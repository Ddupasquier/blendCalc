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

Product enrichment is field-based rather than provider-winner based. Nutrition, images,
categories, servings, ingredient text and structure, additives, explicit allergens,
explicit traces, labels, package quantity, and provider record metadata are evaluated
independently. Structured source metadata is retained in the canonical food snapshot
only when database source policy permits that storage; raw or restricted observations
remain in their licensed cache/evidence boundary. New accepted fields require an
applicable existing-record backfill and the same provenance rules as future writes.

Generic-food identity links are exact and relational. Dataset-declared identifiers such
as a USDA NDB number are stored separately from descriptions and can connect the same
food across national datasets without a fuzzy title match. Generic search excludes
records that have no canonical measured nutrient. When a source-derived food is placed
in Fridge or Shopping List, the authenticated server write path resolves its exact
barcode or positive USDA FDC identifier, enriches only from that exact source record,
and then performs the authoritative list placement. A bounded backfill applies the same
rule to older unlinked list snapshots. Provider misses remain unchanged rather than
being substituted with a similar food.

Food identity is explicit: `packaged`, `generic`, or `private-custom`. Packaged titles
and categories are never allergen evidence. An authoritative generic dataset record may
produce an intrinsic food-taxonomy compatibility fact, while explicit package
`Contains` and `May contain` disclosures remain separate.

All compatibility policies remain behind the server boundary. The browser reference
catalog does not receive conflict rules or ingredient/taxonomy match patterns. Server
page coordinators and authenticated food-list/search endpoints load the DB policy,
evaluate canonical/source facts against the current user's stored preferences, and add
bounded `allergenDisclosure` and `preferenceWarnings` fields to each returned food.
Svelte components render those fields and friendly issue-code messages only; they do not
infer safety information from raw food text or execute compatibility patterns.

Compatibility policy is explicitly versioned. The database preserves snapshots of the
match rules, conflict mappings, effective date, review date, and official regulatory
references for every deployed version. Product compatibility facts and user feedback
retain the version used for their evaluation, while current reads use only the active
version.

Jurisdiction-specific allergen profiles are normalized separately from user
preferences. Reviewed United States, Canadian, United Kingdom, European Union, and
Australia/New Zealand profiles describe regulated coverage and official source labels;
they provide policy context without disabling warnings for preferences selected by the
user.

Users can report a likely false-positive warning through an authenticated server
boundary. The report records the exact warning code, parameters, matched facts, product
identity, and policy version. Moderators confirm or dismiss the report and identify
whether the correction belongs to a rule, source record, or canonical product. Policy
changes create a new version instead of rewriting prior evaluations.

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
