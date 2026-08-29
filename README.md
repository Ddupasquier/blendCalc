# blendCalc

blendCalc helps people understand food, organize what they have, build food
combinations, and compare those combinations with personal nutrition goals.

The project is a pre-MVP SvelteKit application. Its shared catalog and
internal API are designed around evidence-backed food data: missing information stays
missing, source attribution stays attached, and external providers contribute fields
without becoming blanket authorities.

## Quick Navigation

| Goal                               | Start here                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------- |
| Understand the product             | [What The App Does](#what-the-app-does) and [Technology](#technology)       |
| Run the app locally                | [Start Developing](#start-developing)                                       |
| Find a maintained command          | [Command Guide](#command-guide)                                             |
| Understand repository ownership    | [Repository Map](#repository-map)                                           |
| Find rules or domain documentation | [Documentation](#documentation) and the [Documentation Map](docs/README.md) |

## What The App Does

| Area                   | Capability                                                                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Find food              | Search generic foods, packaged products, and the approved blendCalc catalog; scan barcodes; and combine complementary source data field by field.                      |
| Organize food          | Keep account-backed Fridge and Shopping List items mutually exclusive and easy to move.                                                                                |
| Build and save         | Create a Mix with serving controls, explicit nutrition goals, warnings, and suggestions, then save reusable Recipes without overwriting the original unless requested. |
| Understand food        | Review ingredients, allergens, package disclosures, source history, images, and detailed nutrition when that evidence exists.                                          |
| Personalize and review | Save profile and food-preference settings, submit image or label evidence, and expose permission-scoped review and operations tools to elevated roles.                 |

## Technology

| Area                       | Primary tools                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Application                | SvelteKit, Svelte 5, TypeScript, Sass                                                                                  |
| Data and authentication    | Supabase Postgres, Auth, Storage, and RLS                                                                              |
| Food data                  | blendCalc catalog, USDA FoodData Central, Open Food Facts, imported national datasets, and licensed specialist sources |
| Image and label processing | Sharp and Tesseract.js                                                                                                 |
| Testing                    | Vitest, pgTAP, Playwright, and Svelte Check                                                                            |
| Deployment                 | Vercel                                                                                                                 |

## Start Developing

### Requirements

- **Node.js 24.** `.nvmrc`, `.node-version`, `package.json`, and the command preflight
  enforce this major.
- **npm.** The committed `package-lock.json` is the dependency source of truth.
- **Docker and the Supabase CLI** only when running the disposable local database or
  authenticated browser tests.

### 1. Install Dependencies

```bash
npm install
```

Dependency install scripts are deny-by-default. Reviewed package versions are listed in
`package.json` under `allowScripts`; do not approve new lifecycle scripts globally.

### 2. Configure The Environment

```bash
cp .env.example .env
cp .env.moderation.example .env.moderation.local
```

Use `.env` for the local application runtime. Only `PUBLIC_*` values are intended for
the browser; every other credential stays server-only. Use the ignored
`.env.moderation.local` for privileged CLI and linked-database operations.

Each runtime has a separate tracked example so Edge Function, Vercel, test, and
privileged-operation variables do not leak into environments that never consume them.
See [Environment Configuration](docs/development/environment.md) for the file map,
deployment ownership, and synchronization workflow. Never prefix a server secret with
`PUBLIC_` or `VITE_`; ignored value files must never be committed.

See [Authentication](docs/development/authentication.md) for the complete hosted Auth
configuration and verification checklist.

The scheduled catalog monitor also requires Vault values named
`blendcalc_project_url` and `blendcalc_catalog_monitor_cron_secret`. Keep the monitor's
database setting disabled until the deployed Edge Function and matching secret pass a
manual smoke run. The full table, retry, and enablement contract is documented in
[Supabase Schema](docs/development/supabase-schema.md#catalog-monitoring-and-food-safety).

### 3. Run The App

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The isolated test application uses
port `5174` and is started with `npm run dev:test`.

## Command Guide

`package.json` is the executable command source of truth. The tables below list the
stable commands intended for direct use; npm lifecycle helpers such as `predev` are
intentionally omitted.

### Development And Verification

| Command                          | Purpose                                                                   |
| -------------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`                    | Start the normal development server on port `5173`.                       |
| `npm run dev:test`               | Start the app on port `5174` against disposable local Supabase.           |
| `npm run build`                  | Create the production build.                                              |
| `npm run preview`                | Preview the production build.                                             |
| `npm run check`                  | Run TypeScript and Svelte diagnostics.                                    |
| `npm run check:watch`            | Keep TypeScript and Svelte diagnostics running while editing.             |
| `npm run check:auth`             | Validate authentication environment and endpoint configuration.           |
| `npm run lint`                   | Run the maintained TypeScript, Svelte, and SCSS lint contract.            |
| `npm run lint:code`              | Run ESLint for application, test, and script code.                        |
| `npm run lint:code:all`          | Include tracked migration warnings while auditing code.                   |
| `npm run lint:styles`            | Run Stylelint for component and app-wide SCSS.                            |
| `npm run format -- <paths...>`   | Apply the maintained Prettier layout to selected source or documentation. |
| `npm run format:check`           | Verify newly added supported files match the maintained layout.           |
| `npm run format:check:all`       | Audit remaining legacy formatting debt without rewriting it.              |
| `npm test`                       | Run the non-browser Vitest suite with compact output.                     |
| `npm run test:affected`          | Run Vitest files related to the current branch and working-tree changes.  |
| `npm run test:focused -- <path>` | Run one focused Vitest file or directory in its configured runtime.       |
| `npm run test:watch -- <path>`   | Run focused Vitest checks in watch mode.                                  |
| `npm run test:e2e`               | Run the bounded authenticated Playwright release tiers.                   |
| `npm run test:e2e:affected`      | Prepare and run browser specs selected from changed feature ownership.    |
| `npm run test:e2e:chromium`      | Run desktop Chromium plus compact/touch Chromium coverage.                |
| `npm run test:e2e:compatibility` | Run tagged compatibility smoke coverage across maintained projects.       |
| `npm run test:e2e:nightly`       | Run every browser scenario in every maintained project.                   |
| `npm run test:e2e:session:start` | Prepare Supabase and keep one test build running on port `5174`.          |
| `npm run test:e2e:headed`        | Run desktop Chromium in a visible browser.                                |
| `npm run test:e2e:ui`            | Open Playwright's interactive test explorer.                              |
| `npm run test:e2e:update`        | Review and update tracked Chromium visual snapshots.                      |
| `npm run test:e2e:install`       | Install Chromium, Firefox, and WebKit for Playwright.                     |
| `npm run verify:quick`           | Show source checks and affected Vitest in the live dashboard.             |
| `npm run verify:feature`         | Add every Vitest project and affected browser coverage.                   |
| `npm run verify:release`         | Run the bounded blocking release profile in the dashboard.                |
| `npm run verify:nightly`         | Run exhaustive nonblocking browser confidence in the dashboard.           |

Use the [Testing Strategy](docs/development/testing.md) to choose a test layer. Browser
setup lives in [Browser Testing](docs/development/browser-testing.md); database fixtures
and personas live in [Database Testing](docs/development/database-testing.md).

### Database And QA

| Command                                           | Purpose                                                         |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `npm run db:test:start`                           | Start local Supabase and repair missing QA baseline data.       |
| `npm run db:test:reset`                           | Recreate the exact local QA baseline.                           |
| `npm run db:test:verify`                          | Recreate local Supabase and run every database test.            |
| `npm run db:test:status`                          | Show local Supabase service status.                             |
| `npm run db:test:stop`                            | Stop local Supabase.                                            |
| `npm run supabase -- <args>`                      | Run the repository-installed Supabase CLI.                      |
| `npm run db:link`                                 | Link the CLI to the configured blendCalc Supabase project.      |
| `npm run db:new -- <name>`                        | Create a forward-only migration.                                |
| `npm run db:push:dry`                             | Preview linked migrations without applying them.                |
| `npm run db:push`                                 | Confirm and apply migrations already reviewed on remote `main`. |
| `npm run db:push:auto`                            | Apply the same reviewed migrations without another prompt.      |
| `npm run db:lint`                                 | Run linked Supabase database linting.                           |
| `npm run db:types`                                | Regenerate linked Supabase TypeScript types.                    |
| `npm run qa:deterministic`                        | Run safe, read-only deterministic hosted data checks.           |
| `npm run catalog:qa-seed -- <email> <mode>`       | Add disposable local catalog review fixtures.                   |
| `npm run catalog:qa-clean -- <email>`             | Remove those catalog fixtures.                                  |
| `npm run catalog:qa-image-seed -- <email> <mode>` | Add disposable local image-review fixtures.                     |
| `npm run catalog:qa-image-clean -- <email>`       | Remove those image fixtures.                                    |

Never reset a linked or production database. Real migration pushes fail closed unless
the exact migration source already exists on remote `main`.

### Data, Catalog, And Operations

| Command                                        | Purpose                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run import:nutrition:cnf -- --dry-run`    | Validate the Canadian Nutrient File import without writing.                                            |
| `npm run import:nutrition:cofid -- --dry-run`  | Validate the UK CoFID import without writing.                                                          |
| `npm run audit:blendCalcAPI-catalog`           | Audit blendCalcAPI publication readiness and field lineage.                                            |
| `npm run audit:blendCalcAPI-catalog -- --json` | Reassess active products and print machine-repair, review, and unresolved readiness ownership as JSON. |
| `npm run audit:blendCalcAPI-performance`       | Measure authenticated product, category, search, and browser-cached repeat response budgets.           |
| `npm run report:source-quality`                | Report stored provider coverage, reliability, and request cost.                                        |
| `npm run generate:api-structures`              | Regenerate documentation-only provider payload references.                                             |
| `npm run moderate -- ...`                      | Run privileged role or account operations.                                                             |
| `npm run blendCalcAPI:publication -- ...`      | Review concerns and manage reversible blendCalcAPI publication holds.                                  |
| `npm run version:check`                        | Verify Node, app, build, API, OpenAPI, test, and documentation versions.                               |
| `npm run version:bump -- patch\|minor\|major`  | Update application version files without committing or tagging.                                        |

Writing commands are deliberately not implied by their preview examples. Read
[Repository Scripts](scripts/README.md) before running imports, seeds, backfills,
privileged operations, or direct `node scripts/...` workflows.

## Repository Map

| Path                   | Responsibility                                                       |
| ---------------------- | -------------------------------------------------------------------- |
| `src/routes/`          | SvelteKit pages, layouts, endpoints, and route orchestration         |
| `src/lib/components/`  | Reusable and feature-owned UI components                             |
| `src/lib/utils/`       | Pure, browser-safe domain logic                                      |
| `src/lib/server/`      | Server-only persistence, policy, and external-source orchestration   |
| `src/styles/`          | App-wide semantic themes and design tokens                           |
| `supabase/migrations/` | Immutable migration history and forward-only schema changes          |
| `tests/`               | Vitest, Playwright, architecture, route, and database tests          |
| `scripts/`             | Audits, imports, seeds, backfills, QA data, and protected operations |
| `docs/user/`           | Product-facing help and feature guidance                             |
| `docs/development/`    | Tracked engineering rules, contracts, architecture, and operations   |

[Project Structure](docs/development/project-structure.md) owns exact file placement and
naming. [Data Architecture](docs/development/data-architecture.md) owns read, write,
cache, and external source boundaries.

## Documentation

Start with the [Documentation Map](docs/README.md). It identifies the one maintained
owner for each subject so rules, contracts, schema details, and QA instructions do not
drift into duplicate copies.

| Before changing...           | Read                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Anything                     | [Development Rules](docs/development/dev-rules/dev-rules.md)                                             |
| A specific feature or system | The task-specific owner in the [Documentation Map](docs/README.md)                                       |
| blendCalcAPI v1              | [blendCalcAPI](docs/development/blendCalcAPI/README.md) and [Versioning](docs/development/versioning.md) |

The internal API overview and OpenAPI entry point are in
[blendCalcAPI](docs/development/blendCalcAPI/README.md). Application and API releases
are versioned independently as documented in
[Versioning](docs/development/versioning.md).
