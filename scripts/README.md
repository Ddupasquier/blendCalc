# Repository Scripts

Run maintained workflows through the named `npm` commands in the root
`package.json`. The folders below organize implementation files by purpose; they are
not separate public interfaces.

## Directory Map

- `audits/`: read-only source coverage, quality, and compatibility checks.
- `backfills/`: idempotent repairs or enrichment of existing database records.
- `generators/`: generated documentation and repository artifacts.
- `imports/`: licensed external dataset ingestion into canonical database tables.
- `operations/`: authentication, database deployment, and privileged user operations.
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
