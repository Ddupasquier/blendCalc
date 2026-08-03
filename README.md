# blendCalc

A food and nutrition awareness tool for understanding ingredients, building combinations,
and comparing them with personal goals.

## Features

- 🔐 Account-gated nutrition workspace with Google and email/password sign-in
- 🔍 Ingredient search across FoodData Central, saved custom foods, and the shared product catalog
- 🧾 Barcode scanning for packaged foods with reusable product data and moderation fallback
- 🖼️ Source-backed product images stored with license and attribution metadata before UI rendering
- 🧪 Live nutrient goals, ingredient amounts, radar chart feedback, warnings, and suggestions
- 🧊 Account-backed Fridge and Shopping List ingredient management
- 🥤 Saved food combinations with load, overwrite, save-as-new, and per-user name validation
- 👤 Optional profile details, avatar policy confirmation, food preferences, allergens, and dietary restrictions
- 🛡️ Admin moderation for users, profile images, and shared product submissions
- 📱 Mobile-first responsive UI with pagination, filtering, sorting, and large-list handling
- 🚦 Rate-limit friendly API usage with cache layers and Supabase-backed product reuse

## Versioning

Application, API, build, database, catalog, placement, and transient-state versions are
independent. [`docs/versioning.md`](docs/versioning.md) owns their sources of truth,
compatibility rules, and release commands.

---

## Getting started

This project uses Node.js 24. `.nvmrc` and `.node-version` let compatible version
managers select it automatically when a terminal enters the repository.
`package.json` and `package-lock.json` enforce the same major; dependency installation
is engine-strict, and development, test, check, preview, and build commands stop
immediately if a terminal bypasses the repository selector.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example env file:

```bash
cp .env.example .env
cp .env.moderation.example .env.moderation.local
```

Then add the values needed for your environment:

- `VITE_FDC_API_KEY`: free [FoodData Central API key](https://fdc.nal.usda.gov/api-guide.html)
- `PUBLIC_SUPABASE_URL`: Supabase project URL
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable browser key
- `PUBLIC_SITE_URL`: production origin, for example `https://blendcalc.vercel.app`
- `SUPABASE_SERVICE_ROLE_KEY`: server-only admin key for protected server work, moderation, and scripts
- `SUPABASE_PROJECT_ID`: Supabase project ref for local admin scripts
- `SUPABASE_DB_PASSWORD`: remote Postgres database password for `npm run db:push:auto`
- `RESEND_API_KEY`, `MODERATION_EMAIL_FROM`, `MODERATION_SUPPORT_EMAIL`: optional moderation email delivery
- `VERCEL_ANALYTICS_ACCESS_TOKEN`, `VERCEL_TEAM_ID`, and `CRON_SECRET`: server-only
  production values for the daily aggregate Web Analytics sync; Vercel supplies
  `VERCEL_PROJECT_ID` when System Environment Variables are enabled
- `VERCEL_ANALYTICS_SYNC_LOOKBACK_DAYS`: optional 1–31 day aggregate resync window;
  defaults to `3`

Use `.env` for normal app/runtime values. Use `.env.moderation.local` for local admin scripts and database pushes.

> `.env` and `.env.moderation.local` are listed in `.gitignore` and must not be committed. Keep `.env.example` and `.env.moderation.example` as placeholders only.

See [`docs/authentication.md`](docs/authentication.md) for the complete Supabase,
Google, Vercel, security, and verification checklist.

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Scripts

This table is the intentional developer-facing command surface. Other repository
scripts document their direct `node scripts/...` command in the file header instead of
adding one-off npm aliases.

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run dev:test` | Start the app against the isolated local Supabase test database |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Watch-mode tests |
| `npm run check` | TypeScript + Svelte type-check |
| `npm run check:auth` | Validate auth environment and endpoint health |
| `npm run version:check` | Validate Node 24 and all application/API version sources |
| `npm run version:bump -- patch\|minor\|major` | Update the application release without committing or tagging |
| `npm run audit:usda-branded-allergens` | Sample USDA branded allergen-related fields |
| `npm run audit:off-allergens` | Sample Open Food Facts allergen/restriction fields |
| `npm run audit:api-catalog` | Audit every active shared-catalog row for API publication readiness and field lineage |
| `npm run seed:food-preferences` | Store cross-source observed food preference metadata in Supabase |
| `npm run seed:food-categories` | Store cross-source observed custom-food category metadata in Supabase |
| `npm run seed:food-categories:deep` | Run the broader category API sweep and rebuild category mappings |
| `npm run seed:food-categories:rebuild` | Rebuild category mappings from already-stored API observations |
| `npm run seed:manual-entry-nutrients` | Store cross-source manual-entry nutrient grouping observations in Supabase |
| `npm run seed:product-reference-data -- --sample-size=200` | Cross-check product sources and seed source identities, nutrient mappings/conversions, and serving measures |
| `npm run generate:api-structures` | Generate docs-only reference types from observed external API payloads |
| `npm run backfill:food-images` | Backfill DB-backed product image metadata for existing barcode foods |
| `npm run db:push:dry` | Preview pending Supabase migrations |
| `npm run db:push` | Push pending Supabase migrations with the Supabase CLI prompt |
| `npm run db:push:auto` | Push pending Supabase migrations using `SUPABASE_DB_PASSWORD` from `.env.moderation.local` or macOS Keychain |
| `npm run db:lint` | Run Supabase database linting |
| `npm run db:types` | Regenerate Supabase TypeScript database types |
| `npm run db:test:start` | Start local Supabase and repair disposable QA personas across Ingredients, Saved, Mix, onboarding, warnings, and moderation |
| `npm run db:test:reset` | Rebuild the local database from migrations and QA fixtures |
| `npm run db:test:verify` | Rebuild locally and run pgTAP database tests |
| `npm run db:test:status` | Show local Supabase service status |
| `npm run db:test:stop` | Stop the local Supabase stack |
| `npm run catalog:qa-seed` | Seed fake product submissions in the disposable local test database |
| `npm run catalog:qa-clean` | Remove fake product submissions from the disposable local test database |
| `npm run catalog:qa-image-seed` | Seed fake image submissions in the disposable local test database |
| `npm run catalog:qa-image-clean` | Remove unapproved fake image submissions from the disposable local test database |
| `npm run moderate -- ...` | Run moderation CLI role/block helpers |

---

## Running tests

```bash
npm test
```

Tests run entirely offline using mocked fetch — no API key required.

Use [`docs/database-testing.md`](docs/database-testing.md) for the isolated Supabase
workflow and [`docs/README.md`](docs/README.md) to find the single authoritative
document for every other project area. Script-specific behavior lives in
[`scripts/README.md`](scripts/README.md) or the executable file header.

---

## Project structure

[`docs/project-structure.md`](docs/project-structure.md) is the canonical file and folder
ownership map. [`docs/data-architecture.md`](docs/data-architecture.md) owns request,
cache, persistence, and external-source runtime boundaries.
