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

All commands require Node.js 24. Database-writing, provider, and privileged workflows
load their exact ignored credentials from `.env.moderation.local`; no maintained script
falls back to ambient `.env` or `.env.local` files. The exact variable ownership is defined in
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

`node scripts/operations/quality/audit_dependencies.mjs` is the shared read-only
dependency gate for CI, release/nightly verification and promotion reuse. It runs
bounded, scripts-disabled full and production lockfile audits, prints both reports,
and checks the public upstream advisory before accepting the one approved temporary
development-tool risk. The reviewed paths, record digests and absolute deadline live
in `config/dependencyAuditException.json`; no flag or environment value extends them.
Audit errors, production findings, drift and expiration fail closed. See the
[dependency safety policy](../docs/development/dev-rules/dev-rules.md#rule-dependency-supply-chain)
for risk acceptance and patch-removal requirements. The command never modifies
dependencies, databases or credentials. The verification dashboard retains even a
passing audit's complete report under ignored `test-results/verification-dashboard/`
and prints its location and risk warning at closeout. Raw `npm audit` remains an
unsuppressed report.

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
refuses to start when the macOS startup disk has less than 50 GiB free, current memory
pressure is warning or critical, swap use exceeds one physical-RAM-sized budget capped
at 16 GiB, or an existing development process exceeds 5 GiB resident memory. A 16 GiB
Mac therefore permits 16 GiB used swap while pressure is normal; smaller Macs retain
their smaller budget. Missing macOS RAM/pressure measurements fail closed. It also gives
child Node processes a 4 GiB old-space limit. CI skips machine-capacity checks but keeps
the worker and heap limits.

Use `npm run resources:check` for a read-only report. Resolve pressure before continuing.
The report distinguishes retained swap from current pressure and displays the effective
budget. The pressure sysctl uses exported notification flags, not the internal kernel
enum described in some XNU documentation.
`BLENDCALC_ALLOW_RESOURCE_PRESSURE=1` is an explicit one-command emergency override;
it is not a persistent setting and does not make an unsafe machine state acceptable.
The guard never deletes files, caches, containers, volumes, or databases.

## Directory Map

Documentation workflows: `npm run docs -- build` generates and checks all public pages;
`npm run docs` serves their loopback preview; `npm run docs -- test` runs the independent
documentation browser matrix. See [Maintaining this site](../docs/development/documentation-site.md).

The family entry point is `scripts/operations/documentation/run_documentation.mjs`.
It dispatches `scripts/generators/documentation/build_documentation.mjs` and
`scripts/operations/documentation/preview_documentation.mjs`, or the independent
documentation browser runner. Use the npm family command instead of adding aliases.

| Path                        | Responsibility                                                          |
| --------------------------- | ----------------------------------------------------------------------- |
| `audits/catalog/`           | Catalog publication, transparency, and barcode nutrition checks         |
| `audits/food-sources/`      | Provider coverage, quality, request-cost, and contribution checks       |
| `audits/security/`          | Hosted infrastructure and Auth checks                                   |
| `backfills/catalog/`        | Idempotent catalog and saved-source enrichment                          |
| `backfills/images/`         | Image discovery, metadata repair, and automatic placement               |
| `generators/api/`           | Documentation-only external provider references                         |
| `generators/documentation/` | Public Markdown-to-site build with link and anchor validation           |
| `imports/nutrition/`        | Licensed national nutrition dataset imports                             |
| `operations/blendCalcAPI/`  | blendCalcAPI correction review and reversible publication controls      |
| `operations/auth/`          | Auth environment verification                                           |
| `operations/database/`      | Local database management and linked migration delivery                 |
| `operations/environment/`   | Safe local/test application and verification process launchers          |
| `operations/documentation/` | Loopback-only documentation preview; no app or database startup         |
| `operations/quality/`       | Repository linting and formatting verification helpers                  |
| `operations/recovery/`      | Protected hosted backups and offline verification                       |
| `operations/releases/`      | Application and API version consistency                                 |
| `operations/users/`         | Privileged role and account operations                                  |
| `operations/catalog/`       | Privileged catalog inspection and destructive product operations        |
| `qa/catalog/`               | Disposable catalog and image-moderation fixtures                        |
| `qa/database/`              | Deterministic hosted database and API checks                            |
| `seeds/catalog/`            | Category, product-source, serving, and nutrient-reference discovery     |
| `seeds/food-safety/`        | Ingredient, allergen, trace, and dietary evidence discovery             |
| `seeds/nutrition/`          | Manual-entry nutrient-policy observations                               |
| `lib/<domain>/`             | Reusable script-only code; never run directly                           |
| `lib/environment/`          | Clean process environments and local Supabase service helpers           |
| `lib/documentation/`        | Static documentation shell and Markdown rendering                       |
| `lib/reference-data/`       | Reviewed source queries, unit standards, and cautious matching catalogs |

## Local Database And QA

`operations/database/manage_test_database.mjs` owns every `db:test:*` command. It can
start or reset only localhost Supabase, writes an ignored test environment, applies
`supabase/seed.sql`, and repairs the maintained personas in
`lib/qa/local_qa_personas.mjs`.

`scripts/operations/environment/run_production_development.mjs` owns `dev:local` and port
`5173`. It reads only the reviewed production-development allowlist from the ignored,
owner-only `.env`, verifies the established hosted application/API projects, and starts
Vite with an explicit production-connected environment. It never reads or receives a
Google client secret; Google is owned by hosted Supabase Auth. Every 5173 mutation and
configured side effect is real.

`operations/environment/run_application_environment.mjs` owns only `dev:test` and
`dev:test:auth`. It starts the QA databases and launches Vite with an allowlisted
isolated environment. `npm run rehearsal -- open` independently starts the sandbox
through the installed package, without this launcher or an application-owned adapter.
Rehearsal reads `.env.rehearsal-auth.local` only for its local Google provider and
returns through port `58321`.
`operations/environment/run_test_command.mjs` provides the same fail-closed boundary
for compile and unit-test commands without requiring the database stacks to be running.
The executable owners are the `@rehearsal-db/core` CLI,
`scripts/operations/environment/run_application_environment.mjs`,
`scripts/operations/environment/run_test_command.mjs`,
`scripts/operations/database/manage_local_database.mjs`, and
`scripts/operations/database/manage_blendcalc_api_local_database.mjs`.

Rehearsal owns source planning, reader verification, privacy transformations, baseline
activation and physical Storage preparation. BlendCalc retains only reviewed declarations
under `infrastructure/rehearsal/` and ordinary application acceptance tests. Generic
package regression verification belongs to [Rehearsal Test Lab](https://github.com/Ddupasquier/rehearsal-test-lab).

The active configuration is `rehearsal.config.mjs` beside `package.json`. Source access
is separate from ordinary runtime commands: review `source plan`, apply its exact
confirmation digest, run `baseline refresh`, then review and confirm `source retire`.
Repeat each step with `--config=infrastructure/rehearsal/publication/rehearsal.config.mjs`
for the publication target. Run state-changing commands sequentially.

The current source policies accept only the approved loopback copies and their exact
provider-managed reader groups/views. Supply the named server-only variables through
an owner-only environment manager; the CLI does not automatically load a source dotenv
file. Source operations require separately approved credentials and never inherit
authority from a runtime launch. See [source setup](../docs/development/environment.md#package-owned-source-preparation).

Native baselines, credentials and keys live under ignored
`.rehearsal-native/{primary,publication}/.rehearsal/`. Existing `.rehearsal/` and
`.rehearsal-publication/` copies remain protected historical baselines; their version-1
policy files remain for restoration, not new extraction. Never replace or rotate a key
merely to complete setup. `baseline refresh` leaves runtime edits and older generations
alone; deliberate reset or cleanup is a separate reviewed operation.

`node scripts/operations/database/verify_local_migration_history.mjs` remains an ordinary
local database check. QA verification retains pgTAP and migration-history checks; it
does not run a second Rehearsal extraction or sanitizer.

`npm run rehearsal -- migrate` accepts candidate migrations only after their ordered
filename and content hashes produce the exact receipt printed by
`npm run rehearsal -- candidates`. `npm run rehearsal -- run` performs reset, candidate
application, and verification as one fail-closed operation. With no candidates it still
proves the restored baseline.
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

`npm run rehearsal -- open` starts BlendCalc directly using the package-owned
application session. Ctrl+C and Ctrl+Z close only the application, preserving database
and Storage services. There is no consumer runtime adapter, copied-owner password,
callback claim hook or sandbox launcher.

`scripts/operations/quality/prove_local_application.mjs` is an ordinary application
test against an already-running isolated app. During `run`, the package supplies local
service variables, starts the app and invokes the test. Chromium, Firefox and WebKit
exercise a purpose-created account, database-backed role and refresh claims, owner-only
profile reads, MFA denial, profile save/reload, three publication products/searches,
anonymous/malformed/missing API controls, signed avatar/evidence image rendering and
synthetic expired/tampered-session cleanup, not natural JWT expiration. Only its own
synthetic account is removed. It does not start,
stop, reset or claim a Rehearsal runtime.

`scripts/operations/quality/prove_local_publication.mjs` reads the active publication
generation and three detail/search payloads through the package-supplied local service
environment. It performs no writes.

Genuine Google interaction and copied-account association use ordinary sign-in followed
by the public reviewed `identity plan`/`identity claim` workflow, then a fresh sign-in.
The runtime and identity declarations live under `infrastructure/rehearsal/application/`.
The publication target has its own config and native baseline under ignored
`.rehearsal-native/publication/.rehearsal/`.

| Command                                                                                                                                                              | Behavior                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run db:test -- start`                                                                                                                                           | Start local Supabase and restore missing baseline fixtures without moving current tester list items. |
| `npm run db:test -- reset`                                                                                                                                           | Destructively recreate only the local database from migrations and fixtures.                         |
| `npm run db:test -- verify`                                                                                                                                          | Recreate and test the local database, then stop the stack and manager-started Colima.                |
| `npm run db:test -- status`                                                                                                                                          | Report local service status.                                                                         |
| `npm run db:test -- stop`                                                                                                                                            | Stop local Supabase.                                                                                 |
| `node scripts/operations/database/verify_local_migration_history.mjs`                                                                                                | Compare installed migration statements with immutable local migration source.                        |
| `npm run rehearsal -- source plan`                                                                                                                                   | Preview the reviewed primary source access; performs no copy.                                        |
| `npm run rehearsal -- source apply --confirm-source-access=<sha256>`                                                                                                 | Validate the exact reviewed reader and save its temporary credential.                                |
| `npm run rehearsal -- baseline refresh`                                                                                                                              | Sanitize and activate a baseline without resetting the runtime or pruning older copies.              |
| `npm run rehearsal -- source retire`                                                                                                                                 | Preview retirement; apply only with its exact `--confirm-source-retirement=<sha256>`.                |
| `npm run rehearsal -- start`                                                                                                                                         | Start the persistent runtime, restoring it when no verified runtime exists.                          |
| `npm run rehearsal -- reset`                                                                                                                                         | Discard and recreate the runtime from the active immutable baseline.                                 |
| `npm run rehearsal -- status`                                                                                                                                        | Report runtime health, endpoints, baseline identity, and candidate state.                            |
| `npm run rehearsal -- stop`                                                                                                                                          | Stop the runtime while retaining its local database volume.                                          |
| `npm run rehearsal -- discard`                                                                                                                                       | Remove only the disposable Rehearsal runtime and its database volume.                                |
| `npm run rehearsal -- candidates`                                                                                                                                    | Print the exact ordered candidate files and confirmation receipt.                                    |
| `npm run rehearsal -- migrate --confirm-candidates=<sha256>`                                                                                                         | Apply only the candidate list matching the supplied immutable receipt.                               |
| `npm run rehearsal -- verify`                                                                                                                                        | Verify artifact, migration, runtime-boundary, configuration, and project identity invariants.        |
| `npm run rehearsal -- run`                                                                                                                                           | Reset, apply zero or confirmed candidates, and verify in one fail-closed workflow.                   |
| `npm run rehearsal -- doctor\|explain\|run --dry-run`                                                                                                                | Validate readiness or inspect the immutable package-shaped plan without mutating state.              |
| `npm run rehearsal -- inspect baseline\|inspect migrations`                                                                                                          | Inspect safe provenance and exact migration classifications.                                         |
| `node scripts/operations/quality/prove_local_application.mjs`                                                                                                        | Prove the already-running isolated application, CSP, Auth, signed images and publication API.        |
| `node scripts/operations/quality/prove_local_publication.mjs`                                                                                                        | Read-only active publication-generation and product-payload checks.                                  |
| `node scripts/qa/database/run_deterministic_qa.mjs`                                                                                                                  | Run read-only hosted invariants without creating users or Fridge records.                            |
| `node scripts/operations/environment/run_test_command.mjs -- node scripts/qa/catalog/seed_catalog_submission.mjs seed <email> <reviewable\|incomplete\|both>`        | Add local product-review fixtures.                                                                   |
| `node scripts/operations/environment/run_test_command.mjs -- node scripts/qa/catalog/seed_catalog_submission.mjs cleanup <email>`                                    | Remove product-review fixtures created for that email.                                               |
| `node scripts/operations/environment/run_test_command.mjs -- node scripts/qa/catalog/seed_image_moderation_submission.mjs seed <email> <addition\|adjustment\|both>` | Add local image-review fixtures.                                                                     |
| `node scripts/operations/environment/run_test_command.mjs -- node scripts/qa/catalog/seed_image_moderation_submission.mjs cleanup <email>`                           | Remove unapproved image fixtures created for that email.                                             |

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
set. `npm run blendCalcAPI:db -- start`, `npm run blendCalcAPI:db -- reset`,
`npm run blendCalcAPI:db -- test`, and `npm run blendCalcAPI:db -- stop` operate only its
local stack. Hosted
delivery uses the dedicated `npm run blendCalcAPI:db:push -- --dry-run`,
`npm run blendCalcAPI:db:push`, and `npm run blendCalcAPI:db:push -- --yes` promotion guard,
which verifies the isolated link and exact
remote-main migration source before reading credentials or writing. Generate the local
isolated contract with `npm run blendCalcAPI:db:types`; never repoint the root
application link.

Use schema-first delivery: release one backward-compatible expansion, apply and verify
it, then release dependent application code. Renames, removals, restrictive constraints,
and changed write semantics require a later contract migration.

## Catalog And API Audits

| Command                                                                         | What it checks                                                                                                                                     |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/audits/catalog/audit_blendCalcAPI_catalog_readiness.mjs`          | Every active catalog row's publication status, gate failures, provenance, nutrition, servings, images, and rights metadata                         |
| `node scripts/audits/catalog/audit_blendCalcAPI_catalog_readiness.mjs --strict` | The same audit, failing unless every active row is publication-ready                                                                               |
| `node scripts/audits/catalog/audit_blendCalcAPI_catalog_readiness.mjs --json`   | The same fresh readiness reassessment with DB-owned automated-repair, review-owner, and unresolved-contract classifications as structured output   |
| `node scripts/audits/catalog/audit_blendCalcAPI_query_plans.mjs`                | Representative and bounded worst-case local PostgreSQL plans; flags only measured high-row sequential scans for index review                       |
| `node scripts/audits/catalog/audit_blendCalcAPI_payload_sizes.mjs`              | Read-only authenticated byte-size and gzip-size measurements for every blendCalcAPI v1 read shape                                                  |
| `node scripts/audits/catalog/audit_catalog_transparency.mjs`                    | Verification dates, revisions, observations, source quality, ingredients, uncertainty, compatibility, API exposure, and app reads                  |
| `node scripts/audits/catalog/audit_catalog_transparency.mjs --json`             | The same read-only transparency report as structured output                                                                                        |
| `node scripts/audits/catalog/audit_barcode_nutrition_accuracy.mjs --limit=300`  | At least 300 exact GTINs plus every active catalog product across provider evidence, units, servings, normalized values, provenance, and conflicts |
| `node scripts/audits/catalog/audit_blendCalcAPI_response_performance.mjs`       | Authenticated production-preview p50/p95 checks for product, category, first-page search, and browser-cached repeat reads                          |
| `node scripts/audits/catalog/audit_blendCalcAPI_read_load.mjs`                  | Bounded authenticated load corpus for common, broad, empty, warmed, and mixed concurrent blendCalcAPI reads                                        |

The barcode audit writes its detailed report to ignored `scripts/output/`. Provider
anomalies, source disagreements, app math defects, and legally blocked fields remain
separate findings; the audit never promotes data merely to improve its pass rate.

Run the performance audit while `npm run test:e2e:prepare && npm run test:e2e:server` is serving the local
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

| Command                                                                                                | Purpose                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node scripts/audits/food-sources/benchmark_product_sources.mjs --limit=10`                            | Controlled same-barcode provider comparison recorded as benchmark metrics                                                                        |
| `node scripts/audits/food-sources/report_product_source_quality.mjs --days=30 --origin=runtime`        | Runtime requests, cache use, coverage, selected field contributions, missing fields, and unresolved disagreements                                |
| `node scripts/audits/food-sources/report_product_source_quality.mjs --days=30 --origin=benchmark`      | Controlled-benchmark metrics plus current contribution, missing-field, and disagreement evidence                                                 |
| `node scripts/audits/food-sources/report_product_source_quality.mjs --days=30 --origin=runtime --json` | The same privacy-safe report with field-level counts as structured JSON                                                                          |
| `node scripts/audits/food-sources/audit_barcode_provider_experience.mjs --sample-size=50`              | Read-only USDA, Open Food Facts, and COLA Cloud exact-barcode coverage, latency, source math, and manual-entry experience audit                  |
| `node scripts/audits/food-sources/audit_open_food_facts_nutrient_mappings.mjs`                         | Read-only Open Food Facts taxonomy plus anonymous observed key/unit reconciliation against approved, queued, candidate, and unsupported outcomes |
| `node scripts/audits/food-sources/audit_generic_dataset_contribution.mjs --queries=100`                | Read-only imported-dataset record, nutrient, measure, identity, and bounded search contribution                                                  |

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
node scripts/operations/recovery/run_blendcalc_api_recovery_drill.mjs --backup-dir="/absolute/path/to/backup"
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

| Command                                                                                                             | Responsibility                                                            |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `node scripts/operations/users/moderate_user.mjs role <email> <moderator\|admin\|developer\|none> --user-id=<uuid>` | Grant or revoke an application role after email and Auth ID agree         |
| `node scripts/operations/users/moderate_user.mjs ban <email> <reason>`                                              | Ban an account and record moderation history                              |
| `node scripts/operations/catalog/purge_catalog_product.mjs preview <UPC>`                                           | Preview the exact local Supabase deletion graph for one product           |
| `node scripts/operations/catalog/purge_catalog_product.mjs apply <UPC> --confirm=<UPC> --reason="<reason>"`         | Atomically delete that confirmed local graph and verify it is absent      |
| `node scripts/operations/blendCalcAPI/manage_blendCalcAPI_publication.mjs list`                                     | Read publication concerns and active holds                                |
| `node scripts/operations/blendCalcAPI/manage_blendCalcAPI_publication.mjs hold ...`                                 | Immediately withhold one exact product, image, dataset release, or source |
| `node scripts/operations/blendCalcAPI/manage_blendCalcAPI_publication.mjs release ...`                              | Release a reviewed hold while preserving its history                      |
| `node scripts/operations/blendCalcAPI/manage_blendCalcAPI_publication.mjs resolve ...`                              | Record the reviewed outcome of one concern                                |

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
| `node scripts/generators/api/generate_api_structures.mjs`           | Regenerate sampled, documentation-only USDA and Open Food Facts payload references  |
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
