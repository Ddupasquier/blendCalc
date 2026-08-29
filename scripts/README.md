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
| Linked migration                         | Use only `db:push`, `db:push:auto`, or `db:push:dry`; never bypass the remote-`main` promotion guard. |
| Privileged account or publication action | Verify the actor, target identifier, reason, and environment before writing.                          |
| Backup or recovery                       | Store output outside the repository and verify permissions and checksums.                             |

Database-backed reference data is authoritative. Scripts must not introduce repository
cache fallbacks, infer missing values, fabricate review evidence, or promote a provider
as a whole-product authority.

## Directory Map

| Path                       | Responsibility                                                          |
| -------------------------- | ----------------------------------------------------------------------- |
| `audits/catalog/`          | Catalog publication, transparency, and barcode nutrition checks         |
| `audits/food-sources/`     | Provider coverage, quality, request-cost, and contribution checks       |
| `audits/security/`         | Hosted infrastructure and Auth checks                                   |
| `backfills/catalog/`       | Idempotent catalog and saved-source enrichment                          |
| `backfills/images/`        | Image discovery, metadata repair, and automatic placement               |
| `generators/api/`          | Documentation-only external provider references                         |
| `imports/nutrition/`       | Licensed national nutrition dataset imports                             |
| `operations/blendCalcAPI/` | blendCalcAPI correction review and reversible publication controls      |
| `operations/auth/`         | Auth environment verification                                           |
| `operations/database/`     | Local database management and linked migration delivery                 |
| `operations/quality/`      | Repository linting and formatting verification helpers                  |
| `operations/recovery/`     | Protected hosted backups and offline verification                       |
| `operations/releases/`     | Application and API version consistency                                 |
| `operations/users/`        | Privileged role and account operations                                  |
| `qa/catalog/`              | Disposable catalog and image-moderation fixtures                        |
| `qa/database/`             | Deterministic hosted database and API checks                            |
| `seeds/catalog/`           | Category, product-source, serving, and nutrient-reference discovery     |
| `seeds/food-safety/`       | Ingredient, allergen, trace, and dietary evidence discovery             |
| `seeds/nutrition/`         | Manual-entry nutrient-policy observations                               |
| `lib/<domain>/`            | Reusable script-only code; never run directly                           |
| `lib/reference-data/`      | Reviewed source queries, unit standards, and cautious matching catalogs |

## Local Database And QA

`operations/database/manage_test_database.mjs` owns every `db:test:*` command. It can
start or reset only localhost Supabase, writes an ignored test environment, applies
`supabase/seed.sql`, and repairs the maintained personas in
`lib/qa/local_qa_personas.mjs`.

| Command                                                                 | Behavior                                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run db:test:start`                                                 | Start local Supabase and restore missing baseline fixtures without moving current tester list items. |
| `npm run db:test:reset`                                                 | Destructively recreate only the local database from migrations and fixtures.                         |
| `npm run db:test:verify`                                                | Recreate the local database and run all pgTAP checks.                                                |
| `npm run db:test:status`                                                | Report local service status.                                                                         |
| `npm run db:test:stop`                                                  | Stop local Supabase.                                                                                 |
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

| Command                  | Scope                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `npm run verify:quick`   | Formatting, lint, Svelte/TypeScript, and Vitest selected from changed ownership                       |
| `npm run verify:feature` | Source gates, every Vitest project, and browser specs selected from changed ownership                 |
| `npm run verify:release` | Dependency audit, source gates, disposable database, build, and bounded blocking browser tiers        |
| `npm run verify:nightly` | Release confidence plus every scenario in all five browser/device projects; scheduled and nonblocking |

Use the VS Code tasks with the same names for a dedicated visible terminal. Continue to
run the narrowest direct test while editing; the dashboard is for confidence passes,
not a reason to rerun every layer after a small change.

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

Use schema-first delivery: release one backward-compatible expansion, apply and verify
it, then release dependent application code. Renames, removals, restrictive constraints,
and changed write semantics require a later contract migration.

## Catalog And API Audits

| Command                                                                        | What it checks                                                                                                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run audit:blendCalcAPI-catalog`                                           | Every active catalog row's publication status, gate failures, provenance, nutrition, servings, images, and rights metadata                         |
| `npm run audit:blendCalcAPI-catalog -- --strict`                               | The same audit, failing unless every active row is publication-ready                                                                               |
| `npm run audit:blendCalcAPI-catalog -- --json`                                 | The same fresh readiness reassessment with DB-owned automated-repair, review-owner, and unresolved-contract classifications as structured output   |
| `npm run audit:blendCalcAPI-payloads`                                          | Read-only authenticated byte-size and gzip-size measurements for every blendCalcAPI v1 read shape                                                  |
| `node scripts/audits/catalog/audit_catalog_transparency.mjs`                   | Verification dates, revisions, observations, source quality, ingredients, uncertainty, compatibility, API exposure, and app reads                  |
| `node scripts/audits/catalog/audit_catalog_transparency.mjs --json`            | The same read-only transparency report as structured output                                                                                        |
| `node scripts/audits/catalog/audit_barcode_nutrition_accuracy.mjs --limit=300` | At least 300 exact GTINs plus every active catalog product across provider evidence, units, servings, normalized values, provenance, and conflicts |

The barcode audit writes its detailed report to ignored `scripts/output/`. Provider
anomalies, source disagreements, app math defects, and legally blocked fields remain
separate findings; the audit never promotes data merely to improve its pass rate.

## Source Coverage And Quality

| Command                                                                                   | Purpose                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/audits/food-sources/benchmark_product_sources.mjs --limit=10`               | Controlled same-barcode provider comparison recorded as benchmark metrics                                                       |
| `npm run report:source-quality -- --days=30 --origin=runtime`                             | Stored runtime coverage, reliability, cache efficiency, and request cost                                                        |
| `npm run report:source-quality -- --days=30 --origin=benchmark`                           | Stored controlled-benchmark metrics                                                                                             |
| `node scripts/audits/food-sources/audit_barcode_provider_experience.mjs --sample-size=50` | Read-only USDA, Open Food Facts, and COLA Cloud exact-barcode coverage, latency, source math, and manual-entry experience audit |
| `node scripts/audits/food-sources/audit_generic_dataset_contribution.mjs --queries=100`   | Read-only imported-dataset record, nutrient, measure, identity, and bounded search contribution                                 |

These reports measure coverage and efficiency. They do not establish provider-wide
trust, merge similar food names, or change field-selection policy. Reviewed UCUM codes
and conversions live in `lib/reference-data/` and Supabase; product-reference seeding no
longer depends on the NLM UCUM network service.

The exact-barcode provider audit owns current USDA and Open Food Facts ingredient,
allergen, trace, and dietary-field coverage. The older provider-specific name-search
probes were removed because they selected one fuzzy result and duplicated a weaker
version of that maintained evidence.

## Imports And Reference Seeds

| Command                                                                                           | Write scope                                                                                                                  |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run import:nutrition:cnf -- --dry-run`                                                       | Download and validate Canadian Nutrient File 2026 without replacing dataset rows                                             |
| `npm run import:nutrition:cofid -- --dry-run`                                                     | Download and validate UK CoFID 2021 without replacing dataset rows                                                           |
| `node scripts/seeds/food-safety/seed_food_preference_api_observations.mjs --dry-run`              | Preview provider-backed ingredient, allergen, trace, and dietary observations                                                |
| `node scripts/seeds/catalog/seed_custom_food_categories.mjs --dry-run`                            | Preview category observations and canonical mapping rebuild                                                                  |
| `node scripts/seeds/catalog/seed_custom_food_categories.mjs --deep`                               | Run the wider category source sweep and rebuild mappings                                                                     |
| `node scripts/seeds/catalog/seed_custom_food_categories.mjs --rebuild-mappings-only`              | Rebuild mappings from stored observations only                                                                               |
| `node scripts/seeds/nutrition/seed_manual_entry_nutrients.mjs --dry-run --pages=1 --page-size=25` | Preview nutrient metadata and manual-entry policy observations                                                               |
| `node scripts/seeds/catalog/seed_product_reference_data.mjs --sample-size=200`                    | Idempotently store source identities, nutrient mappings, reviewed unit conversions, servings, and aliases; no dry run exists |

Remove `--dry-run` only after reviewing the script's proposed scope and the governing
licence, catalog, nutrient, or food-safety documentation.

## Catalog Backfills

| Command                                                                                               | Purpose and guardrails                                                                                                         |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `node scripts/backfills/catalog/backfill_shared_product_categories.mjs --dry-run`                     | Preview exact-identity category repair; live mode can remove invalid category links.                                           |
| `node scripts/backfills/catalog/backfill_source_food_details.mjs --dry-run --limit=10`                | Preview exact USDA identifier or GTIN enrichment for saved snapshots without fuzzy matching or changing user names/categories. |
| `node scripts/backfills/catalog/backfill_catalog_metadata.mjs --dry-run --cached-only`                | Preview exact-barcode canonical metadata enrichment using only licensed cached data.                                           |
| `node scripts/backfills/images/backfill_food_images.mjs --dry-run --limit=25`                         | Preview reusable Open Food Facts image discovery and licensed asset metadata.                                                  |
| `node scripts/backfills/images/backfill_food_image_placements.mjs --dry-run --limit=25`               | Preview OCR-based placement for untouched automatic or legacy front images.                                                    |
| `node scripts/backfills/images/backfill_food_image_placements.mjs --dry-run --barcode=00000000119993` | Preview one exact image-placement candidate.                                                                                   |

Catalog metadata backfill can recover missing USDA brand, ingredient statement,
explicit declarations, labels, package quantity, source dates/market, and legitimate
servings through canonical observation and enrichment RPCs. Open Food Facts metadata may
be cached and audited but is not promoted while its canonical-storage policy is disabled.

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

Create and verify a protected backup outside the repository:

```bash
node scripts/operations/recovery/create_protected_hosted_backup.mjs
node scripts/operations/recovery/verify_protected_hosted_backup.mjs \
  "/absolute/path/to/backup"
```

The backup workflow reads production without changing it. Verification checks required
database artifacts, Storage manifest coverage, owner-only permissions, and SHA-256
checksums without contacting Supabase. See
[Hosted Security](../docs/development/hosted-security.md)
for retention, restore drills, and incident procedures.

## Privileged Operations

| Command                                                                                 | Responsibility                                                            |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run moderate -- role <email> <moderator\|admin\|developer\|none> --user-id=<uuid>` | Grant or revoke an application role after email and Auth ID agree         |
| `npm run moderate -- ban <email> <reason>`                                              | Ban an account and record moderation history                              |
| `npm run blendCalcAPI:publication -- list`                                              | Read publication concerns and active holds                                |
| `npm run blendCalcAPI:publication -- hold ...`                                          | Immediately withhold one exact product, image, dataset release, or source |
| `npm run blendCalcAPI:publication -- release ...`                                       | Release a reviewed hold while preserving its history                      |
| `npm run blendCalcAPI:publication -- resolve ...`                                       | Record the reviewed outcome of one concern                                |

These commands require service-role credentials and an authorized actor where
documented. They never authorize unrelated Git commits, migration pushes, or application
deployments.

## API References And Releases

| Command                                       | Purpose                                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run generate:api-structures`             | Regenerate sampled, documentation-only USDA and Open Food Facts payload references  |
| `npm run check:auth`                          | Validate Auth-related environment values and endpoint health                        |
| `npm run version:check`                       | Verify Node, app, build, API, OpenAPI, tests, and documentation version consistency |
| `npm run version:bump -- patch\|minor\|major` | Update application release files without committing or tagging                      |

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
