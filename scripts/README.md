# Repository Scripts

The root `package.json` exposes only stable commands that a developer is reasonably
expected to run directly. Internal maintenance and one-off workflows remain executable
through the exact `node scripts/...` command documented at the top of their file; they
do not need an npm alias merely for automated repository work.

The privileged `npm run moderate -- role` operation accepts `moderator`, `admin`,
`developer`, or `none`. Add `--user-id=<expected-user-uuid>` when assigning a sensitive
role so the email and Auth identifier must agree before the write.

Scripts use two ownership levels: the first directory identifies what the workflow
does, and the second identifies the domain it affects. Their contents are not
automatically part of the public developer command surface.

## Directory Map

- `audits/catalog/`: catalog publication, transparency, and barcode-nutrition audits.
- `audits/food-sources/`: provider field-coverage, quality, and benchmark audits.
- `audits/security/`: hosted infrastructure and authentication audits.
- `backfills/catalog/`: idempotent canonical catalog and saved-source enrichment.
- `backfills/images/`: image discovery and asset metadata repair.
- `generators/api/`: documentation-only external API structure generation.
- `imports/nutrition/`: licensed national nutrition dataset ingestion.
- `operations/auth/`: authentication environment checks.
- `operations/database/`: local test database management and linked migration delivery.
- `operations/recovery/`: protected hosted backups and offline backup verification.
- `operations/releases/`: application/API version consistency and release bumps.
- `operations/users/`: privileged role and account operations.
- `qa/catalog/`: disposable catalog and image moderation fixtures.
- `qa/database/`: deterministic hosted database and API integrity checks.
- `seeds/catalog/`: category, source identity, serving, and product reference discovery.
- `seeds/food-safety/`: ingredient, allergen, trace, and dietary preference evidence.
- `seeds/nutrition/`: manual-entry nutrient policy observations.
- `lib/<domain>/`: shared script-only utilities; these files are not executable.
- `lib/reference-data/`: maintained source queries, unit standards, and cautious matching
  catalogs shared by seed workflows.

## Maintenance Rules

- Start every executable `.mjs` workflow with a concise `Purpose` header, exact terminal
  command, and any important write, cleanup, or dry-run behavior. Shared `lib/` modules
  must instead say that they are not directly executable and name the parent workflow.
- Prefer an existing shared helper before adding another HTTP, retry, environment, or
  normalization implementation.
- Database-backed reference data is authoritative. Do not add repository-local cache
  files or generated data fallbacks.
- Nutrient taxonomy/name matching may create disabled review candidates only. It must
  not enable a mapping, fabricate review evidence, reuse another source unit, or create
  unit conversions from same-family assumptions. Exact provider identifiers and
  explicitly reviewed source-key/unit decisions remain authoritative.
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

## Local Test Database

`scripts/operations/database/manage_test_database.mjs` owns the stable `db:test:*`
commands. It
starts or resets only localhost Supabase, applies `supabase/seed.sql`, writes the
gitignored test environment, and creates the maintained personas defined in
`scripts/lib/qa/local_qa_personas.mjs`. Those personas cover populated, warning-heavy,
empty, onboarding, moderator, and admin workflows across Ingredients, Saved, Mix,
profiles, Storage evidence, and catalog review.

Use `npm run db:test:start` to repair missing baseline fixtures while preserving current
local tester changes. Use `npm run db:test:reset` for the exact deterministic baseline,
or `npm run db:test:verify` to recreate it and run every database test. The complete
persona inventory and recovery behavior live in `docs/database-testing.md`.

## Hosted Security And Recovery

Run `node scripts/audits/security/audit_hosted_security.mjs` for a secret-safe,
read-only report
of the linked project's health, trusted-network restriction, managed backups, callback
URLs, password and refresh-token protections, Auth rate limits, CAPTCHA status, TOTP
capability, and custom SMTP readiness. Add `--strict` to fail while launch controls are
missing or blocked, or `--json` for a machine-readable report. The script never prints
trusted CIDRs or hosted secrets.

Create a private logical database and Storage backup outside the repository with:

```bash
node scripts/operations/recovery/create_protected_hosted_backup.mjs
```

Verify its required files, owner-only permissions, Storage manifest, and every SHA-256
checksum without contacting Supabase:

```bash
node scripts/operations/recovery/verify_protected_hosted_backup.mjs \
  "/absolute/path/to/the/backup"
```

The complete policy, recovery drill, retention guidance, and incident procedures live
in `docs/hosted-security.md`. These direct commands intentionally do not add one-off npm
aliases.

## Catalog API Audit

`npm run audit:api-catalog` performs a read-only audit of every active
`shared_products` row. It reports API inclusion, exact publication-readiness reasons,
publication profile/status, required-nutrition coverage, explicit reported-zero counts,
mapping and material-conflict gaps, selected field lineage, normalized nutrient and
serving sources, image sources, and asset-rights completeness.

Use `npm run audit:api-catalog -- --strict` only when every active shared-catalog row is
required to pass the API publication gate.

## Catalog Transparency Audit

Run `node scripts/audits/catalog/audit_catalog_transparency.mjs` for the internal
read-only
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
`node scripts/audits/catalog/audit_barcode_nutrition_accuracy.mjs --limit=300`
for a read-only, deterministic audit of at least 300 unique exact GTINs plus every active
shared-catalog product. The audit checks source nutrient relationships, per-100g and
serving round trips, USDA label consistency, Open Food Facts serving consistency,
canonical units, normalized-versus-JSON storage, exact observation lineage, selected
field provenance, shared-product source agreement, and tracked cross-source conflicts.

The detailed machine-readable report is written to the gitignored `scripts/output/`
directory. Source anomalies and cross-source disagreements remain separate from app-math
or canonical-storage defects. Legally blocked source fields are reported separately and
are never promoted into the canonical catalog merely to make the audit appear complete.

## Catalog Metadata Backfill

Run `node scripts/backfills/catalog/backfill_catalog_metadata.mjs --dry-run --cached-only`
to
preview exact-barcode enrichment from the existing licensed provider cache without
making external requests or database writes. Remove `--dry-run` to apply only missing
USDA fields whose database source policy permits canonical storage:

```bash
node scripts/backfills/catalog/backfill_catalog_metadata.mjs --cached-only
```

The workflow can recover a missing brand, ingredient statements, explicit allergen and
precautionary declarations embedded in the source statement, labels, package weight,
source-record dates and market country, and legitimate source servings. It records
observations, selected field provenance, normalized projections, and revisions through
the canonical enrichment RPCs. Open Food Facts metadata is audited and cached but is not
promoted while its canonical-storage policy is disabled. A second run must make no
additional writes.
