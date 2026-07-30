# Repository Scripts

The root `package.json` exposes only stable commands that a developer is reasonably
expected to run directly. Internal maintenance and one-off workflows remain executable
through the exact `node scripts/...` command documented at the top of their file; they
do not need an npm alias merely for automated repository work.

The folders below organize implementation files by purpose. Their contents are not
automatically part of the public developer command surface.

## Directory Map

- `audits/`: read-only source coverage, quality, and compatibility checks.
- `backfills/`: idempotent repairs or enrichment of existing database records.
- `generators/`: generated documentation and repository artifacts.
- `imports/`: licensed external dataset ingestion into canonical database tables.
- `operations/`: authentication, database deployment, release-version checks/bumps, and
  privileged user operations.
- `qa/`: deterministic data checks and moderation fixtures with matching cleanup commands.
- `seeds/`: repeatable reference-data discovery and database seeding.
- `lib/`: shared script-only utilities; these files are not executable workflows.

## Maintenance Rules

- Start every executable `.mjs` workflow with a concise `Purpose` header, exact terminal
  command, and any important write, cleanup, or dry-run behavior. Shared `lib/` modules
  must instead say that they are not directly executable and name the parent workflow.
- Prefer an existing shared helper before adding another HTTP, retry, environment, or
  normalization implementation.
- Database-backed reference data is authoritative. Do not add repository-local cache
  files or generated data fallbacks.
- Every external request must be bounded, rate-limit aware, attributable, and safe to
  rerun.
- Every database-writing script must fail loudly on invalid configuration and document
  whether it is idempotent, destructive, or paired with cleanup.
- Local test-database operations must reject non-local Supabase URLs and pass `--local`
  explicitly for resets and pgTAP execution. Never add a linked-project reset to an
  automated test workflow.
- Remove one-time investigation scripts after their result is represented by runtime
  code, a maintained audit, a migration, or a database-backed seed.
- Add an npm alias only for a stable, repeatable developer workflow. Do not add aliases
  for internal backfills, narrow investigations, or commands that can be run directly
  from their documented file header.

## Catalog API Audit

`npm run audit:api-catalog` performs a read-only audit of every active
`shared_products` row. It reports API inclusion, exact publication-readiness reasons,
selected field lineage, normalized nutrient and serving sources, image sources, and
asset-rights completeness.

Use `npm run audit:api-catalog -- --strict` only when every active shared-catalog row is
required to pass the API publication gate.

## Catalog Transparency Audit

Run `node scripts/audits/audit_catalog_transparency.mjs` for the internal read-only
population report covering verification dates, revision history, selected observations,
source quality, structured ingredients, normalized provenance, nutrient uncertainty,
policy snapshots, compatibility evidence, API exposure, and app reads. Add `--json`
for machine-readable output. This narrow maintenance audit intentionally has no root npm
alias.

## Source Quality Audits

Use `npm run report:source-quality` to inspect privacy-safe runtime source metrics. Use
the controlled benchmark when providers need a like-for-like comparison:

```bash
npm run benchmark:source-quality -- --limit=10
npm run report:source-quality -- --origin=benchmark
```

`--reset-today` clears only the current day's synthetic `benchmark` rows before a
validation run; it does not alter runtime metrics. Reports include calls per logical
lookup, and the benchmark warns above 2.5 outbound calls per lookup so barcode fan-out,
unnecessary detail requests, and retry leaks are visible.

Interpret these reports as coverage and efficiency evidence. They do not establish
provider-wide trust or alter field-level catalog selection policy.

## Barcode Nutrition Accuracy Audit

Run
`node scripts/audits/audit_barcode_nutrition_accuracy.mjs --limit=300`
for a read-only, deterministic audit of at least 300 unique exact GTINs plus every active
shared-catalog product. The audit checks source nutrient relationships, per-100g and
serving round trips, USDA label consistency, Open Food Facts serving consistency,
canonical units, normalized-versus-JSON storage, exact observation lineage, selected
field provenance, shared-product source agreement, and tracked cross-source conflicts.

The detailed machine-readable report is written to the gitignored `scripts/output/`
directory. Source anomalies and cross-source disagreements remain separate from app-math
or canonical-storage defects. Legally blocked source fields are reported separately and
are never promoted into the canonical catalog merely to make the audit appear complete.
