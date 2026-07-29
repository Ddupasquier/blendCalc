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

- The blendCalc MVP is application version `1.0.0`, shown as `V1`.
- `package.json` is the application-version source of truth.
- Each deployment adds a build identifier without changing the public release number.
- The internal catalog API is versioned independently under `/api/v1` with response
  version `1.0`.
- Database migrations, catalog revisions, image placements, and browser-storage schemas
  keep their own purpose-specific versions.

See [`docs/versioning.md`](docs/versioning.md) for release and compatibility rules.
See [`docs/data-architecture.md`](docs/data-architecture.md) for the database-first read,
write, browser-state, and external-enrichment boundaries.
See [`docs/style-guide.md`](docs/style-guide.md) for the Ingredients-derived visual
system, component selection, token usage, and stylesheet maintenance rules.
See [`docs/database-testing.md`](docs/database-testing.md) for the isolated local
Supabase test environment, reset workflow, and database QA commands.

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

Use `.env` for normal app/runtime values. Use `.env.moderation.local` for local admin scripts and database pushes.

> `.env` and `.env.moderation.local` are listed in `.gitignore` and must not be committed. Keep `.env.example` and `.env.moderation.example` as placeholders only.

For production authentication, set `PUBLIC_SITE_URL` in the hosting environment
to the deployed origin, for example `https://blendcalc.vercel.app`. In
Supabase **Authentication → URL Configuration**, set the Site URL to that same
production origin and add both callback URLs to the redirect allow list:

```text
https://blendcalc.vercel.app/auth/callback
http://localhost:5173/auth/callback
```

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
| `npm run db:test:start` | Start local Supabase and seed disposable QA accounts |
| `npm run db:test:reset` | Rebuild the local database from migrations and QA fixtures |
| `npm run db:test:verify` | Rebuild locally and run pgTAP database tests |
| `npm run db:test:status` | Show local Supabase service status |
| `npm run db:test:stop` | Stop the local Supabase stack |
| `npm run catalog:qa-seed` | Seed a fake product submission for moderation testing |
| `npm run catalog:qa-clean` | Remove fake product submission fixtures |
| `npm run catalog:qa-image-seed` | Seed fake product image submissions for moderation testing |
| `npm run catalog:qa-image-clean` | Remove fake image moderation fixtures that were not approved |
| `npm run moderate -- ...` | Run moderation CLI role/block helpers |

---

## Inspecting The Supabase Schema

Use the repository's CLI workflow instead of relying on a separate editor snapshot:

1. Read pending SQL in `supabase/migrations/`; migrations are the schema source of
   truth.
2. Verify the complete chain with `npm run db:test:verify`.
3. Run `npm run db:push:dry` and confirm only the expected migration is pending.
4. Apply the verified migration with `npm run db:push:auto`.
5. Run `npm run db:lint` to catch database problems.
6. Run `npm run db:types` after a schema change, then review
   `src/lib/types/database.types.ts` in VS Code.
7. Confirm the linked and local migration histories agree.
8. Update `docs/supabase-schema.md` in the same change.

Use Supabase Studio only to inspect live rows or confirm a deployed migration. Do not
edit production tables manually when the change belongs in a migration.

---

## Running tests

```bash
npm test
```

Tests run entirely offline using mocked fetch — no API key required.

See [`docs/shared-product-catalog.md`](docs/shared-product-catalog.md) for the
barcode verification and shared-product moderation model.

See [`docs/normalized-food-nutrients.md`](docs/normalized-food-nutrients.md) for
the normalized nutrient query model, provenance fields, synchronization, and
deployment steps.

See [`docs/supabase-schema.md`](docs/supabase-schema.md) for a plain table map
of the current Supabase schema, ownership boundaries, relationships, storage
buckets, and schema update checklist.

See [`docs/ui-functionality.md`](docs/ui-functionality.md) for the complete UI
feature and functionality preservation brief used for large UI refactors.

See [`docs/api-structures/README.md`](docs/api-structures/README.md) for the
generated external API payload reference files. These files document observed
FoodData Central and Open Food Facts response shapes only; do not import them
from runtime app code.

See [`docs/api-structures/source-data-inventory.md`](docs/api-structures/source-data-inventory.md)
for active source responsibilities, useful stored fields, source-specific server paths,
and legal/canonical storage boundaries.

See [`docs/data-source-licensing.md`](docs/data-source-licensing.md) for each external
data, image, standards, and OCR source's licence requirements, current blendCalc
handling, attribution obligations, and unresolved public-API release blockers.

See [`docs/versioning.md`](docs/versioning.md) for the independent app, API, database,
catalog-revision, and client-storage versioning model.

See [`scripts/README.md`](scripts/README.md) for the maintained script directory map
and script-specific maintenance rules. Runtime nutrient definitions and display
profiles remain database-driven; repository-local nutrient catalogs are not used.

`generate:api-structures` samples observed query terms from Supabase API
observation tables, calls the external food APIs the app currently uses, and
writes docs-only reference types under `docs/api-structures/`. Use it when
auditing vendor payloads or checking whether an API exposes additional fields
worth storing canonically in Supabase.

`seed:product-reference-data` samples USDA FoodData Central and Open Food Facts,
checks standard unit conversions through UCUM, and writes the observed source
identities, nutrient mappings, nutrient-specific conversions, serving units, and
serving aliases to Supabase. Apply migrations first, then run the seed whenever
source mappings or supported serving measures need to be refreshed.

---

## Project structure

```
src/
├── app.scss                   # Global mobile-first styles
├── app.html                   # HTML shell
├── lib/
│   ├── components/
│   │   ├── app/               # App shell, nav, tutorial, welcome, landing animation
│   │   ├── auth/              # Password requirement UI
│   │   ├── common/            # Reusable buttons, dialogs, pills, lists, pagination
│   │   ├── ingredients/       # Search, barcode scan, custom entry, nutrition facts
│   │   ├── mix/               # Goals, graph, selected ingredients, warnings, suggestions
│   │   └── profile/           # Food preference pickers
│   ├── server/                # Server-only catalog, email, evidence, and API helpers
│   ├── supabase/              # Browser/server Supabase clients
│   ├── types/                 # Generated Supabase database types
│   └── utils/
│       ├── auth/              # Auth redirects, password policy, password upgrades
│       ├── barcode/           # Barcode parsing, lookup, nutrients, scanner adapters
│       ├── food/              # FDC, custom foods, compatibility, normalized nutrients
│       ├── mix/               # Mix state, calculations, chart metrics, suggestions
│       ├── profile/           # Profile validation, food preferences, warnings
│       └── storage/           # Supabase persistence + scoped transient UI state
└── routes/
    ├── +layout.svelte
    ├── +page.svelte           # Auth-gated landing page
    ├── auth/                  # Sign in, callback, logout, password update
    ├── fridge/                # Ingredients, barcode scan, Fridge, Shopping List
    ├── mix/                   # Smoothie builder
    ├── moderation/            # Admin moderation tools
    ├── profile/               # Profile, avatar, food preferences
    └── saved/                 # Saved drinks
docs/
└── api-structures/            # Generated reference-only vendor API shapes
```

---

## API rate limits

The FDC API allows **1000 requests/hour** with a free API key. This app mitigates usage by:

- Debouncing search input (500 ms)
- Reusing approved shared catalog products before users need to create duplicates
- Caching USDA search responses in Supabase for **12 hours**
- Caching USDA barcode/detail responses in Supabase for **30 days**
- Keeping only account-scoped browser cache for signed-in users
- Only fetching from external APIs when neither the shared catalog nor cache has a fresh result
