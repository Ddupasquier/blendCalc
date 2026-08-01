# Database Testing

blendCalc uses a resettable local Supabase stack for migration, RLS, Auth, Storage,
and database-integration testing. The local stack is isolated from the linked production
project and contains only disposable QA data.

## First Run

```bash
npm run db:test:start
```

This command starts the Docker-compatible runtime when Colima is installed, starts the
local Supabase services, writes local credentials to the gitignored
`.env.test.local`, applies deterministic runtime reference fixtures, and repairs six
purpose-built QA personas. The personas cover populated everyday use, food warnings,
empty states, guided onboarding, moderation, and administration without requiring
manual setup before each pass.
The local Auth service also runs the production-shaped blocked-signup and Custom Access
Token hooks, so regular, moderator, and administrator QA sessions receive the same
database-owned `app_role` claims that hosted sessions receive.

Run the app against the local database with:

```bash
npm run dev:test
```

The local account password and emails are printed by the database command and stored in
`.env.test.local` for local tooling.

## Seeded Personas

All accounts use `BlendCalc-Local-QA-2026!`. `npm run db:test:start` repairs missing
baseline records without moving a tester's existing list items. Use
`npm run db:test:reset` whenever the exact baseline below is required.

| Persona | Email | Deterministic state |
|---|---|---|
| Populated | `qa-user@blendcalc.local` | 15 Fridge items, 4 Shopping items, 4 Saved mixes, one active 10-food Mix, tutorial complete |
| Warnings | `qa-preferences@blendcalc.local` | Vegan and gluten-free restrictions; peanut and shellfish allergies; 7 foods covering beef, shrimp, dairy, peanut, wheat/soy, egg, and tree nuts |
| Empty | `qa-empty@blendcalc.local` | No list items, Saved mixes, or Mix state; tutorial complete |
| Onboarding | `qa-onboarding@blendcalc.local` | Guided tour pending, 10 Fridge foods, `QA Morning Green`, and an active Mix so every tour target exists |
| Moderator | `qa-moderator@blendcalc.local` | Moderator claim, 6 list items, one Saved mix, and access to two deterministic catalog-review cases |
| Admin | `qa-admin@blendcalc.local` | Admin claim, 6 list items, one Saved mix, moderation access, and data-health access |

The populated account includes `QA Morning Green` (10 ingredients), `QA Berry Repeat`,
`QA Export Berry Mix`, and `QA Server Load`. The Saved view can therefore test collapsed
cards, the more-than-eight ingredient disclosure, search, sorting, export/share actions,
server loading, and goal summaries immediately after reset.

The moderation queue includes `QA Reviewable Pantry Crisps` with three private local
evidence images and `QA Missing Evidence Pantry Crisps` without evidence. Existing
fixed-ID submissions are not recreated by `start` after they have been reviewed; a
`reset` restores both pending cases.

## Commands

| Command | Purpose |
|---|---|
| `npm run db:test:start` | Start the local stack, apply pending local migrations and reference fixtures, wait for Supabase services, and repair missing persona fixtures. |
| `npm run db:test:reset` | Destroy local data, replay every migration, refresh the local gateway, and reseed reference fixtures and QA accounts after services are ready. |
| `npm run db:test:verify` | Reset the local database and run all pgTAP database tests. |
| `npm run db:test:status` | Print local service URLs and status. |
| `npm run db:test:stop` | Stop the local Supabase stack while retaining its Docker volume. |
| `npm run dev:test` | Start SvelteKit in test mode against `.env.test.local`. |

## Safety Boundary

- Test commands always pass `--local` for destructive database resets and pgTAP tests.
- The generated environment writer rejects any Supabase URL that is not localhost.
- Never add `--linked` to a test command. The linked project contains live application
  data and is not a disposable test target.
- Never copy production users or private records into local seeds. Create synthetic QA
  fixtures instead.
- `supabase/seed.sql` contains only deterministic local reference fixtures for manual
  nutrients, serving measures, category selection, food-preference options, and approved
  catalog products. It remains safe to replay. Its synthetic category catalog
  intentionally exceeds 1,000 enabled rows so server-side category search and selection
  persistence can be tested beyond the former client-list cutoff without copying
  production data.
- The local catalog contains 22 approved synthetic foods: five packaged-product cases
  plus seventeen generic foods spanning produce, dairy, seeds, beverages, meat,
  shellfish, leafy greens, spices, and juice. `Strawberries, Raw` intentionally remains
  outside the populated account's lists so search always has a deterministic unsaved
  result.
  `Tomatoes, Green, Raw` preserves USDA SR Legacy identity `170456` and provides a
  deterministic multi-word partial-search result for `green tomat`.
- Local catalog products are authored package-label fixtures with normalized nutrients,
  servings, categories, ingredients, allergen declarations, traces, package metadata,
  and field-level provenance. They are available through the same blendCalc app and API
  routes as production catalog products. One fixture intentionally reports no serving.
- `npm run dev:test` disables runtime USDA and Open Food Facts lookups. A barcode missing
  from the local catalog returns the normal not-found result instead of silently spending
  provider or hosted-database quota. Provider adapters remain covered through injected
  unit tests and separate explicit live-source audits.
- Local login-capable users are created only after the local Auth and PostgREST APIs are
  available.

## Manual QA Database Changes

When a QA task needs a temporary database condition, use only the exact setup and
restoration commands written in that task. Run SQL against local Supabase Studio at
`http://127.0.0.1:54323`, never against the linked project.

Unless a task provides a narrower safe restoration script, restore the deterministic
local state with:

```bash
npm run db:test:reset
```

This reset deletes disposable local QA records, replays all migrations, and recreates
the maintained reference fixtures, personas, Saved mixes, Mix state, preferences,
tutorial state, Storage evidence, and moderation queue.

Resetting recreates Auth users with new IDs. A browser session created before the reset
is therefore invalid. Test mode validates the current Auth record and sends that stale
session back to sign-in; sign in again with a seeded account after the reset. The new
session should not show onboarding unless the active QA task explicitly removes that
account's tutorial preference with its supplied SQL.

## What This Enables

- Complete migration-chain verification from an empty database.
- Low-level pgTAP checks for schema, functions, constraints, and RLS configuration.
- Supabase-client integration tests against real Auth, PostgREST, Storage, and database
  policies rather than mocks.
- Repeatable destructive QA without risking production records.

## Verification Corpus Standard

A minimal reproduction identifies the original failure; it does not prove the affected
behavior is fixed. Deterministic database and data-flow QA must exercise a representative
corpus containing the original input, comparable positive cases across the affected
source or data path, and applicable negative and boundary controls. Record every tested
input and its result in the QA evidence. Do not clear a search, barcode, validation,
calculation, mapping, or data-behavior task from one successful example. See
[development rule 46](dev-rules/dev-rules.md#rule-qa-process) for the authoritative QA
requirement.

## Food-Safety Corpus

The maintained safety corpus has two deliberately separate layers:

| Layer | Fixture origin | Coverage | Current size |
|---|---|---|---:|
| Application | Authored synthetic Open Food Facts-shaped payloads plus synthetic private and generic foods | Provider normalization, ingredient/declaration mapping, policy evaluation, API serialization, and user-facing status copy | 17 cases |
| Database | Authored synthetic source observations stored in `shared_product_observations` | Relational ingredient projection, reviewed multilingual extraction, exact precautionary statements, immutable policy links, formulation changes, negative controls, and idempotency | 17 observations / 18 assertions |

The payloads are original test fixtures. They do not copy private user evidence, real
package-label prose, secrets, or provider records. Prepared compatibility facts remain
in a smaller evaluation-only unit corpus, but they are not accepted as proof that
source ingestion or database extraction works.

Coverage is reported separately by
`tests/lib/server/food-safety/foodSafetyEndToEndCorpus.test.ts` and
`supabase/tests/database/food_safety_end_to_end_corpus.test.sql`. New false positives,
false negatives, statement forms, supported languages, derivative rules, and
formulation changes must become source-shaped cases in the applicable layer.

A separate remote staging project can be added later for real-device and hosted-preview
QA. It should use the same migrations and synthetic fixtures, never a production data
copy.
