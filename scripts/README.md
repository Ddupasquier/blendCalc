# Repository Scripts

This directory contains operational workflows that support blendCalc without becoming
application runtime code. Scripts are grouped first by the kind of work they perform and
then by the domain they affect.

The root [README](../README.md) lists stable npm commands intended for routine developer
use. This file explains script ownership, safety, and task-specific execution. Every
executable script also begins with its exact command and write behavior; that header is
the final instruction to read before running it.

## Choose The Right Entry Point

- Use an **npm command** when `package.json` exposes a stable workflow.
- Use the documented **direct `node scripts/...` command** for narrow audits, protected
  recovery, or occasional backfills that do not need a permanent alias.
- Import a module under `scripts/lib/` only from another script. Those files are not
  standalone commands.
- Do not add an npm alias merely to make a one-time investigation easier to type.

All commands require Node.js 24. Database-writing and privileged workflows normally
load ignored credentials from `.env.moderation.local`; provider-only audits may use
`.env`. The exact variable ownership is defined in
[Environment Configuration](../docs/development/environment.md). Never pass secrets on
the command line or place generated data in tracked files.

## Quick Navigation

| Need                                  | Go to                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pick and run a safe entry point       | [Choose The Right Entry Point](#choose-the-right-entry-point) and [Safety Before Execution](#safety-before-execution)                                                           |
| Find a script owner                   | [Directory Map](#directory-map)                                                                                                                                                 |
| Work with databases or QA             | [Local Database And QA](#local-database-and-qa) and [Linked Migration Delivery](#linked-migration-delivery)                                                                     |
| Audit, import, seed, or backfill data | [Catalog And API Audits](#catalog-and-api-audits), [Imports And Reference Seeds](#imports-and-reference-seeds), and [Catalog Backfills](#catalog-backfills)                     |
| Run protected operations              | [Hosted Security And Recovery](#hosted-security-and-recovery), [Privileged Operations](#privileged-operations), and [API References And Releases](#api-references-and-releases) |
| Add or move a script                  | [Maintaining This Directory](#maintaining-this-directory)                                                                                                                       |

## Safety Before Execution

| Workflow type                            | Required practice                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Read-only audit                          | Confirm the target environment and use `--json` only when a machine-readable report is needed.        |
| Seed, import, or backfill                | Run the documented dry run first when one exists; review counts and exact write scope.                |
| Local QA database                        | Use only `db:test:*`; the manager rejects non-local Supabase URLs.                                    |
| Heavy local verification                 | Run `npm run resources:check`; maintained full-suite commands enforce it automatically.               |
| Linked migration                         | Use only `db:push`, `db:push:auto`, or `db:push:dry`; never bypass the remote-`main` promotion guard. |
| Privileged account or publication action | Verify the actor, target identifier, reason, and environment before writing.                          |
| Backup or recovery                       | Store output outside the repository and verify permissions and checksums.                             |

Database-backed reference data is authoritative. Scripts must not introduce repository
cache fallbacks, infer missing values, fabricate review evidence, or promote a provider
as a whole-product authority.

### Local Resource Safety

Builds, complete Vitest projects, browser suites, feature/release/nightly verification,
and full database verification run through
`operations/quality/run_with_resource_limits.mjs`. On a local machine, the runner
refuses to start when the macOS startup disk has less than 50 GiB free, swap use exceeds
8 GiB, or an existing development process exceeds 5 GiB resident memory. It also gives
child Node processes a 4 GiB old-space limit. CI skips machine-capacity checks but keeps
the worker and heap limits.

Use `npm run resources:check` for a read-only report. Resolve pressure before continuing.
`BLENDCALC_ALLOW_RESOURCE_PRESSURE=1` is an explicit one-command emergency override;
it is not a persistent setting and does not make an unsafe machine state acceptable.
The guard never deletes files, caches, containers, volumes, or databases.

## Directory Map

| Path                       | Responsibility                                                          |
| -------------------------- | ----------------------------------------------------------------------- |
| `audits/catalog/`          | Catalog publication, transparency, and barcode nutrition checks         |
| `audits/food-sources/`     | Provider coverage, quality, request-cost, and contribution checks       |
| `audits/security/`         | Hosted infrastructure and Auth checks                                   |
| `backfills/catalog/`       | Idempotent catalog and saved-source enrichment                          |
| `backfills/images/`        | Image discovery, metadata repair, and automatic placement               |
| `generators/api/`          | Documentation-only external provider references                         |
| `generators/rehearsal/`    | Reviewed Rehearsal schema-policy manifests                              |
| `imports/nutrition/`       | Licensed national nutrition dataset imports                             |
| `operations/blendCalcAPI/` | blendCalcAPI correction review and reversible publication controls      |
| `operations/auth/`         | Auth environment verification                                           |
| `operations/database/`     | Local database management and linked migration delivery                 |
| `operations/environment/`  | Safe local/test application and verification process launchers          |
| `operations/quality/`      | Repository linting and formatting verification helpers                  |
| `operations/recovery/`     | Protected hosted backups and offline verification                       |
| `operations/rehearsal/`    | Disposable production-shaped migration-rehearsal proofs                 |
| `operations/releases/`     | Application and API version consistency                                 |
| `operations/users/`        | Privileged role and account operations                                  |
| `operations/catalog/`      | Privileged catalog inspection and destructive product operations        |
| `qa/catalog/`              | Disposable catalog and image-moderation fixtures                        |
| `qa/database/`             | Deterministic hosted database and API checks                            |
| `seeds/catalog/`           | Category, product-source, serving, and nutrient-reference discovery     |
| `seeds/food-safety/`       | Ingredient, allergen, trace, and dietary evidence discovery             |
| `seeds/nutrition/`         | Manual-entry nutrient-policy observations                               |
| `lib/<domain>/`            | Reusable script-only code; never run directly                           |
| `lib/environment/`         | Clean process environments and local Supabase service helpers           |
| `lib/reference-data/`      | Reviewed source queries, unit standards, and cautious matching catalogs |
| `lib/rehearsal/`           | Reusable Rehearsal safety, restore, migration, and verification helpers |

## Local Database And QA

`operations/database/manage_test_database.mjs` owns every `db:test:*` command. It can
start or reset only localhost Supabase, writes an ignored test environment, applies
`supabase/seed.sql`, and repairs the maintained personas in
`lib/qa/local_qa_personas.mjs`.

`operations/environment/run_application_environment.mjs` owns `dev:local`, `dev:test`,
and `dev:rehearsal`. It starts the required local database workdirs and launches Vite
with an allowlisted environment. It never reads privileged or hosted environment files.
For Rehearsal only, the database manager reads the exact two-variable allowlist in
ignored `.env.rehearsal-auth.local` and passes it exclusively to local Supabase Auth so
the real Google flow can return to port `58321`. The app launcher never receives those
OAuth values.
`operations/environment/run_test_command.mjs` provides the same fail-closed boundary
for compile and unit-test commands without requiring the database stacks to be running.
The executable owners are the `@rehearsal-db/core` CLI,
`scripts/operations/environment/run_application_environment.mjs`,
`scripts/operations/environment/run_test_command.mjs`,
`scripts/operations/database/manage_local_database.mjs`, and
`scripts/operations/database/manage_blendcalc_api_local_database.mjs`.

`npm run db:rehearsal:prove-export-boundary` creates a uniquely named disposable
database and three temporary least-privilege roles inside the local application
PostgreSQL container. It proves that the login can read one explicit, versioned,
security-barrier export view while direct source reads, mutations, source/network
function calls, owner-role assumption, schema creation, and temporary objects fail. The
command verifies that no side effect occurred and removes the exact disposable database
and roles before returning. It never reads environment files, hosted credentials, or
production data and does not install the proposed export-boundary migration.

`npm run rehearsal:sanitization:generate` inventories only the running local
application database schema and writes the reviewed table-and-column policy to
`infrastructure/rehearsal/application/sanitization-policy.json`. The manifest records
an explicit action for every current column; generation never reads table rows. Review
the entire diff before accepting a generated change. Routine verification uses
`npm run rehearsal:sanitization:check`, which fails when a table or column was added,
removed, renamed, or retyped without a corresponding reviewed manifest update.

`node scripts/generators/rehearsal/generate_export_boundary_migration.mjs --write`
generates the additive `rehearsal_export` migration from that reviewed manifest. Use
`npm run rehearsal:export-migration:check` during routine verification; it fails when
the checked-in migration no longer matches the policy. The migration contains explicit
versioned security-barrier views, an inert owner, an inert reader group, forced-RLS
policies, and a hashed migration receipt. It does not create a login credential.

`npm run db:rehearsal:verify-local-history` compares every local migration file with the
installed local Supabase ledger, including an exact ordered-statement SHA-256. It fails
on edits, omissions, reordering, duplicate versions, filename mismatches, and database
versions not represented locally.

`npm run db:rehearsal:prove-installed-boundary` creates one disposable local login,
connects through the installed export surface, streams every included table in a single
serializable read-only transaction, sanitizes all records, atomically activates and
verifies a temporary checksummed baseline, and removes both the login and artifact. It
also creates a disposable Auth identity with the real `rehearsal_storage_reader` JWT,
downloads a bounded local object through Storage RLS, and cleans up that identity and
object. The command performs an elevated local `pg_net` grant cleanup that Supabase may
undo at container restart, then proves the local database login has no executable
network path. Hosted Supabase owns those grants and can restore them. Production
provisioning therefore rotates a random database credential that expires within 30
minutes, and the fixed export accepts it only inside one serializable read-only
transaction after verifying that every `net` function uses invoker rights.

`npm run db:rehearsal:refresh` is the hosted-source consumer and remains unusable until
the reviewed boundary is deployed and its two read-only identities are provisioned. It
reads exactly five values from owner-only `.env.rehearsal-source.local`: a dedicated
`rehearsal_*` PostgreSQL URL, the Storage URL and publishable key, and a short-lived
Storage-reader access/refresh token pair. It accepts no service-role key or reusable
Storage password. The database preflight returns the fixed owner UUID and email hash;
the separate Storage JWT must contain the `rehearsal_storage_reader` role and the same
owner scope before any byte is accepted. Sanitized identifiers remain stable across
refreshes through one random 32-byte key in ignored
`.rehearsal/sanitization.key`. The key is created once with owner-only permissions,
never leaves the machine, and is never written into a baseline or log.
After a replacement verifies and becomes active, refresh retains that generation and
one verified fallback, then removes older immutable generations through path-checked
cleanup.

`npm run db:rehearsal:provision-source -- --dry-run` validates the linked project and
requires exactly one Google-linked admin or developer as the approved source owner. The
confirmed command creates or rotates one ephemeral `rehearsal_*` database login, binds
its export scope to that owner, creates or rotates one dedicated Auth/Storage reader,
proves both credentials, and atomically
writes only the five allowed values to ignored `.env.rehearsal-source.local` with mode 600. It uses `.env.moderation.local` only inside the provisioning process; no privileged
value enters the generated source environment, command line, logs, or baseline. Hosted
CAPTCHA remains enabled because provisioning mints the Storage session through a
non-delivery Admin magic link rather than password authentication.

`npm run db:rehearsal:deprovision-source -- --dry-run` previews removal of only that
temporary database login and owner scope, the dedicated read-only Storage identity,
and the ignored source credential file. The confirmed command is idempotent and refuses
an Auth identity whose purpose metadata is not exact. It preserves the shared export
boundary, active baseline, and local Rehearsal runtime so a completed refresh stays
usable after every hosted credential has been revoked.

The `@rehearsal-db/core` dependency owns the persistent local runtime. It restores only an
atomically verified baseline under ignored `.rehearsal/`, checks the
exact migration-file prefix, streams records into PostgreSQL without constructing one
unbounded SQL argument, recreates referenced Auth identities as synthetic local users,
overlays the approved owner persona with one local developer login in an excluded
authorization table, restores every checksummed Storage object into local Storage, and recreates
the excluded catalog-monitor singleton in a disabled state so diagnostic reads retain
their contract without enabling worker side effects. The exact public catalog and
approved owner's non-secret private state are preserved; other identities and private
values remain sanitized. A failed restore or candidate migration discards the runtime instead of
leaving a database that could be mistaken for a verified Rehearsal.

`db:rehearsal:migrate` accepts candidate migrations only after their ordered filename
and content hashes produce the exact receipt printed by `db:rehearsal:candidates`.
`db:rehearsal:run` performs reset, candidate application, and verification as one
fail-closed operation. With no candidates it still proves the restored baseline.
Reset verifies every restored table count and foreign key before the runtime becomes
available. Later `verify` calls intentionally allow local row changes because Rehearsal
is a writable sandbox and candidate data migrations may alter counts; they continue to
verify the immutable source artifact, migration history, runtime boundary, and
project-owned invariants. Run `reset` whenever an exact baseline-data comparison is
required.

`npm run rehearsal -- doctor`, `explain`, `run --dry-run`, `inspect baseline`, and
`inspect migrations` expose the versioned package developer contract. The
initializer previews a typed configuration and writes only with an explicit `--write`.
Human and `--json` output share one redacted result/error model. The public configuration,
safety, compatibility, command, and support contracts live in the standalone
`rehearsal-db` repository; this repository documents only BlendCalc-owned integration.

`npm run rehearsal:app:prove` is BlendCalc's project-owned application proof. It starts
the app against the already verified Rehearsal runtime and waits for that newly started
process's directive-level CSP instead of accepting an older listener on port `5175`.
It renders restored profile-avatar and private submission-evidence Storage bytes in a
real headless browser; proves a reset-invalidated session clears once without retaining
privileged access or retrying the dead token; performs the restored owner-snapshot Auth
exchange; requires its local database-owned `developer` claim; creates and removes an
ordinary local account plus its application profile; proves Google OAuth initiation
uses Google's chooser plus the port `58321` local callback; and checks the isolated
blendCalcAPI route cannot fail from a missing or hosted target. It stops only the app
process and leaves the local database stacks available. Completing the external Google
consent/callback remains a direct browser check because Rehearsal never stores a real
Google account credential. Runtime verification separately performs a matching
Google-owner claim inside a rollback and proves the owner profile, list topology, and
Storage pointers survive the identity swap.

| Command                                                                 | Behavior                                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run db:test:start`                                                 | Start local Supabase and restore missing baseline fixtures without moving current tester list items. |
| `npm run db:test:reset`                                                 | Destructively recreate only the local database from migrations and fixtures.                         |
| `npm run db:test:verify`                                                | Recreate and test the local database, then stop the stack and manager-started Colima.                |
| `npm run db:test:status`                                                | Report local service status.                                                                         |
| `npm run db:test:stop`                                                  | Stop local Supabase.                                                                                 |
| `npm run db:rehearsal:prove-export-boundary`                            | Prove the least-privilege design in an isolated disposable local database.                           |
| `npm run db:rehearsal:prove-installed-boundary`                         | Stream, sanitize, verify, and clean a temporary baseline through the installed local boundary.       |
| `npm run db:rehearsal:verify-local-history`                             | Compare installed migration statements with immutable local migration source.                        |
| `npm run db:rehearsal:refresh-local`                                    | Produce and retain a verified baseline from the installed local export boundary.                     |
| `npm run db:rehearsal:provision-source -- --dry-run`                    | Preview the confirmed least-privilege production source provisioning operation.                      |
| `npm run db:rehearsal:deprovision-source -- --dry-run`                  | Preview revocation of the temporary production-source identities and local credential file.          |
| `npm run db:rehearsal:start`                                            | Start the persistent runtime, restoring it when no verified runtime exists.                          |
| `npm run db:rehearsal:reset`                                            | Discard and recreate the runtime from the active immutable baseline.                                 |
| `npm run db:rehearsal:status`                                           | Report runtime health, endpoints, baseline identity, and candidate state.                            |
| `npm run db:rehearsal:stop`                                             | Stop the runtime while retaining its local database volume.                                          |
| `npm run db:rehearsal:discard`                                          | Remove only the disposable Rehearsal runtime and its database volume.                                |
| `npm run db:rehearsal:candidates`                                       | Print the exact ordered candidate files and confirmation receipt.                                    |
| `npm run db:rehearsal:migrate -- --confirm-candidates=<sha256>`         | Apply only the candidate list matching the supplied immutable receipt.                               |
| `npm run db:rehearsal:verify`                                           | Verify artifact, migration, runtime-boundary, configuration, and project identity invariants.        |
| `npm run db:rehearsal:run`                                              | Reset, apply zero or confirmed candidates, and verify in one fail-closed workflow.                   |
| `npm run rehearsal -- doctor\|explain\|run --dry-run`                   | Validate readiness or inspect the immutable package-shaped plan without mutating state.              |
| `npm run rehearsal -- inspect baseline\|inspect migrations`             | Inspect safe provenance and exact migration classifications.                                         |
| `npm run rehearsal:app:prove`                                           | Prove the BlendCalc application, CSP, Auth, and API boundaries against Rehearsal.                    |
| `npm run rehearsal:sanitization:generate`                               | Regenerate the schema-only sanitization policy for deliberate review.                                |
| `npm run rehearsal:sanitization:check`                                  | Fail when the reviewed policy no longer exactly covers the local schema.                             |
| `npm run rehearsal:export-migration:generate`                           | Regenerate the explicit export-boundary migration for deliberate review.                             |
| `npm run rehearsal:export-migration:check`                              | Fail when the export migration differs from its reviewed generator inputs.                           |
| `npm run qa:deterministic`                                              | Run read-only hosted invariants without creating users or Fridge records.                            |
| `npm run catalog:qa-seed -- <email> <reviewable\|incomplete\|both>`     | Add local product-review fixtures.                                                                   |
| `npm run catalog:qa-clean -- <email>`                                   | Remove product-review fixtures created for that email.                                               |
| `npm run catalog:qa-image-seed -- <email> <addition\|adjustment\|both>` | Add local image-review fixtures.                                                                     |
| `npm run catalog:qa-image-clean -- <email>`                             | Remove unapproved image fixtures created for that email.                                             |

The full persona inventory, safe reset behavior, and database QA workflow live in
[Database Testing](../docs/development/database-testing.md).

## Visible Verification Dashboard

`operations/quality/run_verification_dashboard.mjs` runs the maintained verification
layers in one live terminal view. It stores duration estimates in ignored `.cache/`
state and writes complete diagnostics only for failed stages under ignored
`test-results/verification-dashboard/`.

`npm run format:check` runs
`operations/quality/check_new_file_formatting.mjs` to verify only changed and untracked
supported files against the maintained Prettier contract.
`scripts/operations/quality/run_affected_tests.mjs` maps changed paths to the smallest
maintained Vitest and Playwright ownership groups used by Quick and Feature checks.
`scripts/lib/releases/project_ticket_lifecycle.mjs` classifies verification-only,
implementation-delivery, and operational/manual Project work before release batching;
it rejects mixed delivery classes and ticket-specific shared evidence.

| Command                    | Scope                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run verify:quick`     | Formatting, lint, Svelte/TypeScript, and Vitest selected from changed ownership                       |
| `npm run verify:feature`   | Source gates plus Vitest and browser specs selected from changed ownership                            |
| `npm run verify:release`   | Dependency audit, source gates, disposable database, build, and bounded blocking browser tiers        |
| `npm run verify:promotion` | Validate a fresh content-addressed Release Check receipt for the exact clean promoted tree            |
| `npm run verify:nightly`   | Release confidence plus every scenario in all five browser/device projects; scheduled and nonblocking |

Use the VS Code tasks with the same names for a dedicated visible terminal. Continue to
run the narrowest direct test while editing; the dashboard is for confidence passes,
not a reason to rerun every layer after a small change.

A successful local Release Check stores its receipt under the repository's shared Git
directory so every local branch can validate the same immutable tree. The routine
release path runs the complete hosted checks once on the exact assembled candidate. A
successful manually dispatched `Verify (full)` run may be reused by an identical staging
tree; otherwise `mock-staging` or `staging` supplies the complete run.
`verify:promotion -- --against <candidate-ref>` validates unchanged promotions.
Promotion checks never reuse results across changed, dirty, stale, missing, failed, or
differently executed candidates. The short security and repository-policy preflight
finishes before expensive browser jobs begin, and the scheduled Dependency Audit reports
new moderate-or-higher lockfile advisories before release day.
`npm run verify:promotion -- --force-full` bypasses reuse and runs the full Release
Check.

## Linked Migration Delivery

`operations/database/push_supabase_db.mjs` protects all real migration delivery. A live
push refreshes `origin/main` and compares every local migration byte for byte with the
reviewed remote source before credentials are loaded or Supabase is called.

| Command                | Behavior                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `npm run db:push:dry`  | Show pending linked migrations without applying them.       |
| `npm run db:push`      | Apply reviewed migrations after an explicit confirmation.   |
| `npm run db:push:auto` | Apply the same reviewed migrations without a second prompt. |
| `npm run db:lint`      | Run linked database linting.                                |
| `npm run db:types`     | Regenerate linked TypeScript database types.                |

The isolated API publication database uses a different Supabase workdir and credential
set. `npm run blendCalcAPI:db:start`, `blendCalcAPI:db:reset`,
`blendCalcAPI:db:test`, and `blendCalcAPI:db:stop` operate only its local stack. Hosted
delivery uses the dedicated `npm run blendCalcAPI:db:push:dry`,
`npm run blendCalcAPI:db:push`, and `npm run blendCalcAPI:db:push:auto` promotion guard,
which verifies the isolated link and exact
remote-main migration source before reading credentials or writing. Generate the local
isolated contract with `npm run blendCalcAPI:db:types`; never repoint the root
application link.

Use schema-first delivery: release one backward-compatible expansion, apply and verify
it, then release dependent application code. Renames, removals, restrictive constraints,
and changed write semantics require a later contract migration.

## Catalog And API Audits

| Command                                                                        | What it checks                                                                                                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run audit:blendCalcAPI-catalog`                                           | Every active catalog row's publication status, gate failures, provenance, nutrition, servings, images, and rights metadata                         |
| `npm run audit:blendCalcAPI-catalog -- --strict`                               | The same audit, failing unless every active row is publication-ready                                                                               |
| `npm run audit:blendCalcAPI-catalog -- --json`                                 | The same fresh readiness reassessment with DB-owned automated-repair, review-owner, and unresolved-contract classifications as structured output   |
| `node scripts/audits/catalog/audit_blendCalcAPI_query_plans.mjs`               | Representative and bounded worst-case local PostgreSQL plans; flags only measured high-row sequential scans for index review                       |
| `npm run audit:blendCalcAPI-payloads`                                          | Read-only authenticated byte-size and gzip-size measurements for every blendCalcAPI v1 read shape                                                  |
| `node scripts/audits/catalog/audit_catalog_transparency.mjs`                   | Verification dates, revisions, observations, source quality, ingredients, uncertainty, compatibility, API exposure, and app reads                  |
| `node scripts/audits/catalog/audit_catalog_transparency.mjs --json`            | The same read-only transparency report as structured output                                                                                        |
| `node scripts/audits/catalog/audit_barcode_nutrition_accuracy.mjs --limit=300` | At least 300 exact GTINs plus every active catalog product across provider evidence, units, servings, normalized values, provenance, and conflicts |
| `npm run audit:blendCalcAPI-performance`                                       | Authenticated production-preview p50/p95 checks for product, category, first-page search, and browser-cached repeat reads                          |
| `npm run audit:blendCalcAPI-load`                                              | Bounded authenticated load corpus for common, broad, empty, warmed, and mixed concurrent blendCalcAPI reads                                        |

The barcode audit writes its detailed report to ignored `scripts/output/`. Provider
anomalies, source disagreements, app math defects, and legally blocked fields remain
separate findings; the audit never promotes data merely to improve its pass rate.

Run the performance audit while `npm run test:e2e:session:start` is serving the local
production build on port `5174`. It uses the disposable QA account and fails only the
audit process when a response budget regresses; the budgets never block application
traffic. Use `--json`, `--samples=15`, `--barcode=<14-digit GTIN>`, or `--query=<term>`
to produce structured evidence or change the representative input.

Run the load audit against the same prepared preview. It defaults to five concurrent
clients and five iterations, remains read-only, and fails on any HTTP error or missed
scenario-specific p95 budget. Use `--concurrency=2..10`, `--iterations=3..20`, and
`--json` for a controlled pre-beta run; do not point it at production without explicit
authorization.

## Source Coverage And Quality

| Command                                                                                   | Purpose                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node scripts/audits/food-sources/benchmark_product_sources.mjs --limit=10`               | Controlled same-barcode provider comparison recorded as benchmark metrics                                                                        |
| `npm run report:source-quality -- --days=30 --origin=runtime`                             | Runtime requests, cache use, coverage, selected field contributions, missing fields, and unresolved disagreements                                |
| `npm run report:source-quality -- --days=30 --origin=benchmark`                           | Controlled-benchmark metrics plus current contribution, missing-field, and disagreement evidence                                                 |
| `npm run report:source-quality -- --days=30 --origin=runtime --json`                      | The same privacy-safe report with field-level counts as structured JSON                                                                          |
| `node scripts/audits/food-sources/audit_barcode_provider_experience.mjs --sample-size=50` | Read-only USDA, Open Food Facts, and COLA Cloud exact-barcode coverage, latency, source math, and manual-entry experience audit                  |
| `npm run audit:off-nutrient-mappings`                                                     | Read-only Open Food Facts taxonomy plus anonymous observed key/unit reconciliation against approved, queued, candidate, and unsupported outcomes |
| `node scripts/audits/food-sources/audit_generic_dataset_contribution.mjs --queries=100`   | Read-only imported-dataset record, nutrient, measure, identity, and bounded search contribution                                                  |

These reports measure coverage and efficiency. They do not establish provider-wide
trust, merge similar food names, or change field-selection policy. Reviewed UCUM codes
and conversions live in `lib/reference-data/` and Supabase; product-reference seeding no
longer depends on the NLM UCUM network service.

The exact-barcode provider audit owns current USDA and Open Food Facts ingredient,
allergen, trace, and dietary-field coverage. The older provider-specific name-search
probes were removed because they selected one fuzzy result and duplicated a weaker
version of that maintained evidence.

## Imports And Reference Seeds

| Command                                                                                           | Write scope                                                                                                                      |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run import:nutrition:cnf -- --dry-run`                                                       | Download and validate Canadian Nutrient File 2026 without replacing dataset rows                                                 |
| `npm run import:nutrition:cofid -- --dry-run`                                                     | Download and validate UK CoFID 2021 without replacing dataset rows                                                               |
| `node scripts/seeds/food-safety/seed_food_preference_api_observations.mjs --dry-run`              | Preview provider-backed ingredient, allergen, trace, and dietary observations                                                    |
| `node scripts/seeds/catalog/seed_custom_food_categories.mjs --dry-run`                            | Preview category observations and canonical mapping rebuild                                                                      |
| `node scripts/seeds/catalog/seed_custom_food_categories.mjs --deep`                               | Run the wider category source sweep and rebuild mappings                                                                         |
| `node scripts/seeds/catalog/seed_custom_food_categories.mjs --rebuild-mappings-only`              | Rebuild mappings from stored observations only                                                                                   |
| `node scripts/seeds/nutrition/seed_manual_entry_nutrients.mjs --dry-run --pages=1 --page-size=25` | Preview nutrient metadata and manual-entry policy observations                                                                   |
| `node scripts/seeds/nutrition/seed_open_food_facts_nutrient_mapping_candidates.mjs`               | Preview observed exact Open Food Facts identities eligible for the private mapping-review queue; add `--apply` only after review |
| `node scripts/seeds/catalog/seed_product_reference_data.mjs --sample-size=200`                    | Idempotently store source identities, nutrient mappings, reviewed unit conversions, servings, and aliases; no dry run exists     |

Remove `--dry-run` only after reviewing the script's proposed scope and the governing
licence, catalog, nutrient, or food-safety documentation.

## Catalog Backfills

| Command                                                                                               | Purpose and guardrails                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/backfills/catalog/backfill_shared_product_categories.mjs --dry-run`                     | Preview exact-identity category repair; live mode can remove invalid category links.                                                         |
| `node scripts/backfills/catalog/backfill_source_food_details.mjs --dry-run --limit=10`                | Preview exact USDA identifier or GTIN enrichment for saved snapshots without fuzzy matching or changing user names/categories.               |
| `node scripts/backfills/catalog/backfill_catalog_metadata.mjs --dry-run --cached-only`                | Preview exact-barcode canonical metadata enrichment using only licensed cached data.                                                         |
| `node scripts/backfills/catalog/backfill_external_ingredient_statements.mjs --local`                  | Preview versioned external ingredient formatting from stored rows only; makes zero provider requests and never rewrites user/moderator text. |
| `node scripts/backfills/images/backfill_food_images.mjs --dry-run --limit=25`                         | Preview reusable Open Food Facts image discovery and licensed asset metadata.                                                                |
| `node scripts/backfills/images/backfill_food_image_placements.mjs --dry-run --limit=25`               | Preview OCR-based placement for untouched automatic or legacy front images.                                                                  |
| `node scripts/backfills/images/backfill_food_image_placements.mjs --dry-run --barcode=00000000119993` | Preview one exact image-placement candidate.                                                                                                 |

Catalog metadata backfill can recover missing USDA brand, ingredient statement,
explicit declarations, labels, package quantity, source dates/market, and legitimate
servings through canonical observation and enrichment RPCs. Open Food Facts metadata may
be cached and audited but is not promoted while its canonical-storage policy is disabled.

External ingredient statement normalization defaults to a read-only preview. Apply
requires both `--apply` and
`--confirm-apply=normalize-external-ingredients-v1`. Use `--local` for disposable QA;
the script refuses a non-local URL in that mode. It reads stored snapshots only, skips
user/community/moderator provenance, stops on concurrent record changes, preserves raw
provider caches and historical revisions, and records a new revision for canonical
products. A second preview after apply must report zero eligible changes.

Image-placement backfill is idempotent. It updates only confident untouched automatic
placements and never overwrites user adjustments, moderator-approved placement, or an
accepted smart placement. Ambiguous untouched legacy crops move only to the current
Full image default.

## Hosted Security And Recovery

Run the secret-safe hosted inventory:

```bash
node scripts/audits/security/audit_hosted_security.mjs
```

Add `--strict` to fail while launch controls are missing, or `--json` for structured
output. The report never prints secrets or trusted CIDRs.

Apply an explicitly requested hosted Auth setting after a successful dry run:

```bash
npm run auth:configure-hosted -- --turnstile --dry-run
npm run auth:configure-hosted -- --turnstile --confirm-project=<project-ref>
npm run auth:configure-hosted -- --smtp --dry-run
npm run auth:configure-hosted -- --smtp --confirm-project=<project-ref>
npm run auth:configure-hosted -- --templates --dry-run
npm run auth:configure-hosted -- --templates --confirm-project=<project-ref>
```

This command reads only the selected `SUPABASE_AUTH_*` inputs from the ignored
`.env.moderation.local`, identifies the linked project during dry run, requires that
exact project reference on apply, updates only those hosted fields, and never prints
protected values. Before a Turnstile update, it confirms that Cloudflare recognizes
the protected secret; afterward it verifies that Supabase accepted and retained an
opaque secret value without attempting to compare that protected value as plaintext.
For SMTP, it requires the returned protected password marker to remain present and
matches every non-secret field exactly. The separate hosted-security audit checks the
configured Resend sender domain through the provider API; configured credentials alone
remain blocked rather than being reported as delivery-ready.
For templates, it loads the tracked `supabase/templates/` catalog, updates every Auth
subject and HTML body together, enables password/email/MFA/identity security notices,
keeps phone-change notices disabled with phone Auth, and verifies exact hosted equality.
The dry run never prints message bodies or protected values.

Create and verify a protected backup outside the repository:

```bash
node scripts/operations/recovery/create_protected_hosted_backup.mjs
node scripts/operations/recovery/verify_protected_hosted_backup.mjs \
  "/absolute/path/to/backup"
npm run recovery:blendCalcAPI -- --backup-dir="/absolute/path/to/backup"
```

The backup workflow reads production without changing it. Verification checks required
database artifacts, migration history, Storage manifest coverage, owner-only permissions,
and SHA-256 checksums without contacting Supabase. The recovery drill restores the
backup in disposable local stacks, applies forward migrations, validates counts and
foreign keys, restores Storage bytes, rebuilds the isolated publication generation,
and proves rollback. Legacy backups require an independently verified explicit migration
cutoff. See
[Hosted Security](../docs/development/hosted-security.md)
for retention, restore drills, and incident procedures.

## Privileged Operations

| Command                                                                                 | Responsibility                                                            |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run moderate -- role <email> <moderator\|admin\|developer\|none> --user-id=<uuid>` | Grant or revoke an application role after email and Auth ID agree         |
| `npm run moderate -- ban <email> <reason>`                                              | Ban an account and record moderation history                              |
| `npm run catalog:product:purge -- preview <UPC>`                                        | Preview the exact local Supabase deletion graph for one product           |
| `npm run catalog:product:purge -- apply <UPC> --confirm=<UPC> --reason="<reason>"`      | Atomically delete that confirmed local graph and verify it is absent      |
| `npm run blendCalcAPI:publication -- list`                                              | Read publication concerns and active holds                                |
| `npm run blendCalcAPI:publication -- hold ...`                                          | Immediately withhold one exact product, image, dataset release, or source |
| `npm run blendCalcAPI:publication -- release ...`                                       | Release a reviewed hold while preserving its history                      |
| `npm run blendCalcAPI:publication -- resolve ...`                                       | Record the reviewed outcome of one concern                                |

These commands require service-role credentials and an authorized actor where
documented. They never authorize unrelated Git commits, migration pushes, or application
deployments.

Catalog product purge defaults to the disposable local stack and refuses any non-local
URL. `--hosted` is an explicit override for an intentional live operation; preview,
exact UPC confirmation, and a reason remain mandatory. The database audit stores counts
without retaining the deleted product identity.

## API References And Releases

| Command                                                             | Purpose                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run generate:api-structures`                                   | Regenerate sampled, documentation-only USDA and Open Food Facts payload references  |
| `npm run check:auth`                                                | Validate Auth-related environment values and endpoint health                        |
| `npm run auth:configure-hosted -- --turnstile\|--smtp\|--templates` | Apply one explicit hosted Supabase Auth configuration safely                        |
| `npm run version:check`                                             | Verify Node, app, build, API, OpenAPI, tests, and documentation version consistency |
| `npm run verify:vercel-routes`                                      | Reject root-function collisions and missing generated dynamic API functions         |
| `npm run version:bump -- patch\|minor\|major`                       | Update application release files without committing or tagging                      |

The API generator may call providers and read stored query terms but never mutates
Supabase. Generated references are not runtime types. See
[External API Structure References](../docs/development/api-structures/README.md) for
their ownership.

## Maintaining This Directory

- Give every executable `.mjs` file a concise `Purpose` header, exact command, and clear
  read/write, dry-run, idempotency, and cleanup behavior.
- Mark shared `lib/` modules as non-executable and name their parent workflow.
- Reuse existing HTTP, retry, environment, normalization, and database helpers.
- Bound external calls, identify the application, respect rate limits, and preserve
  source attribution.
- Fail loudly on invalid configuration. Never make an empty or failed write appear
  successful.
- Remove one-time scripts after their result is represented by maintained runtime code,
  a migration, a durable audit, or database-backed reference data.
- Keep this directory map current and remove empty folders when their final owner moves.
