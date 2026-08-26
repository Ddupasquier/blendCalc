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

| Configuration                                                                                  | When it is needed                                                                                                                                              |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                       | Normal app authentication and data access                                                                                                                      |
| `FDC_API_KEY`                                                                                  | Server-only USDA FoodData Central lookups in the app and maintenance scripts                                                                                   |
| `PUBLIC_SITE_URL`                                                                              | Production authentication callbacks and canonical links                                                                                                        |
| `PUBLIC_TURNSTILE_SITE_KEY`                                                                    | Auth bot protection after the matching hosted secret is configured                                                                                             |
| `COLA_CLOUD_API_KEY`                                                                           | Optional server-only U.S. alcohol-label enrichment                                                                                                             |
| `USDA_API_KEY`, `OPENFDA_API_KEY`, `CATALOG_MONITOR_CRON_SECRET`                               | Deployed catalog-monitor Edge Function; openFDA key is optional but recommended                                                                                |
| `FDA_RECALL_PROXY_URL`, `FDA_RECALL_PROXY_SECRET`, `FDA_RECALL_PROXY_PROTECTION_BYPASS_SECRET` | Protected app-server relay for current FDA notices when Edge egress is blocked; the optional bypass secret is required only for a deployment-protected preview |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                    | Protected server reads and writes, request quotas, catalog and food-safety policy, Profile operations, privileged review, and trusted scripts                  |
| `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`                                                  | Linked Supabase administration and guarded migration delivery                                                                                                  |
| `RESEND_API_KEY`, `MODERATION_EMAIL_FROM`, `MODERATION_SUPPORT_EMAIL`                          | Optional moderation email delivery                                                                                                                             |
| `VERCEL_ANALYTICS_ACCESS_TOKEN`, `VERCEL_TEAM_ID`, `CRON_SECRET`                               | Production aggregate analytics synchronization                                                                                                                 |

Never prefix a server secret with `PUBLIC_` or `VITE_`. Both local env files are
ignored and must not be committed. See [Authentication](docs/authentication.md) for the
complete hosted configuration and verification checklist.

Older local environments may still contain `VITE_FDC_API_KEY`. Runtime and maintenance
scripts accept it only as a temporary compatibility fallback; new local and hosted
configuration must use `FDC_API_KEY` so the credential can never enter the browser
bundle.

The scheduled catalog monitor also requires Vault values named
`blendcalc_project_url` and `blendcalc_catalog_monitor_cron_secret`. Keep the monitor's
database setting disabled until the deployed Edge Function and matching secret pass a
manual smoke run. The full table, retry, and enablement contract is documented in
[Supabase Schema](docs/supabase-schema.md#catalog-monitoring-and-food-safety).

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

| Command                        | Purpose                                                                   |
| ------------------------------ | ------------------------------------------------------------------------- |
| `npm run dev`                  | Start the normal development server on port `5173`.                       |
| `npm run dev:test`             | Start the app on port `5174` against disposable local Supabase.           |
| `npm run build`                | Create the production build.                                              |
| `npm run preview`              | Preview the production build.                                             |
| `npm run check`                | Run TypeScript and Svelte diagnostics.                                    |
| `npm run check:watch`          | Keep TypeScript and Svelte diagnostics running while editing.             |
| `npm run check:auth`           | Validate authentication environment and endpoint configuration.           |
| `npm run lint`                 | Run the maintained TypeScript, Svelte, and SCSS lint contract.            |
| `npm run lint:code`            | Run ESLint for application, test, and script code.                        |
| `npm run lint:code:all`        | Include tracked migration warnings while auditing code.                   |
| `npm run lint:styles`          | Run Stylelint for component and app-wide SCSS.                            |
| `npm run format -- <paths...>` | Apply the maintained Prettier layout to selected source or documentation. |
| `npm run format:check`         | Verify newly added supported files match the maintained layout.           |
| `npm run format:check:all`     | Audit remaining legacy formatting debt without rewriting it.              |
| `npm test`                     | Run the non-browser Vitest suite with compact output.                     |
| `npm run test:watch -- <path>` | Run focused Vitest checks in watch mode.                                  |
| `npm run test:e2e`             | Run the complete authenticated Playwright browser matrix.                 |
| `npm run test:e2e:chromium`    | Run desktop and compact Chromium projects.                                |
| `npm run test:e2e:headed`      | Run desktop Chromium in a visible browser.                                |
| `npm run test:e2e:ui`          | Open Playwright's interactive test explorer.                              |
| `npm run test:e2e:update`      | Review and update tracked Chromium visual snapshots.                      |
| `npm run test:e2e:install`     | Install Chromium, Firefox, and WebKit for Playwright.                     |
| `npm run verify:quick`         | Show source checks and Vitest in the live verification dashboard.         |
| `npm run verify:feature`       | Add a production build and desktop/compact Chromium to the dashboard.     |
| `npm run verify:release`       | Run the complete local release confidence profile in the dashboard.       |

Use the [Testing Strategy](docs/testing.md) to choose a test layer. Browser setup lives
in [Browser Testing](docs/browser-testing.md); database fixtures and personas live in
[Database Testing](docs/database-testing.md).

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
| `docs/`                | Rules, contracts, architecture, operations, and QA documentation     |

[Project Structure](docs/project-structure.md) owns exact file placement and naming.
[Data Architecture](docs/data-architecture.md) owns read, write, cache, and external
source boundaries.

## Documentation

Start with the [Documentation Map](docs/README.md). It identifies the one maintained
owner for each subject so rules, contracts, schema details, and QA instructions do not
drift into duplicate copies.

| Before changing...           | Read                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Anything                     | [Development Rules](docs/dev-rules/dev-rules.md)                                 |
| A specific feature or system | The task-specific owner in the [Documentation Map](docs/README.md)               |
| blendCalcAPI v1              | [blendCalcAPI](docs/blendCalcAPI/README.md) and [Versioning](docs/versioning.md) |

The internal API overview and OpenAPI entry point are in
[blendCalcAPI](docs/blendCalcAPI/README.md). Application and API releases are
versioned independently as documented in [Versioning](docs/versioning.md).
