# Rehearsal

Rehearsal tests pending PostgreSQL/Supabase migrations against a verified, sanitized,
production-shaped baseline in a disposable local environment. It is designed for the
historical edge cases that synthetic seed data rarely represents.

This directory is the internal public-contract draft for Rehearsal 0.x. The engine is
still owned by BlendCalc and must not be published until DEV-082 extracts and verifies
the package. Nothing in this draft enables production access.

## Why use it?

A migration passing against an empty database proves only that the migration can build
a new schema. Rehearsal also proves that:

- the baseline is the exact immutable artifact you reviewed;
- historical migration files still match the baseline's digest-addressed prefix;
- only the exact suffix is treated as candidate work;
- production-shaped relationships survive restore and migration;
- optional bounded Storage objects retain exact checksums through local restore;
- the resulting local application can pass a project-owned proof;
- unsafe or ambiguous state stops execution.

The restored runtime is intentionally writable. Exact baseline row counts and foreign
keys are proved during reset before the runtime is accepted; later verification allows
row-level divergence from sandbox interaction or candidate data migrations while still
checking the immutable artifact, migration lineage, runtime boundary, and project-owned
invariants. Reset restores and reproves the exact starting data.

## Quick start

The package is not published while DEV-081 and DEV-082 are proving its safety contract.
Once a beta is explicitly approved and published, installation will be:

```bash
npm install --save-dev @rehearsal/db
```

Until then, these commands run from the BlendCalc repository against the same
prospective package boundary:

```bash
npm run rehearsal -- init
npm run rehearsal -- init --write
npm run rehearsal -- doctor
npm run rehearsal -- explain
npm run rehearsal -- run --dry-run
npm run rehearsal -- candidates
npm run rehearsal -- inspect baseline
npm run rehearsal -- inspect migrations
```

`init` previews a typed `rehearsal.config.ts`; it writes only with `--write` and never
overwrites an existing file. Review all detected values. Rehearsal intentionally does
not detect, copy, or enable a hosted project.

`doctor` must end with `READY` before execution. `explain` and `run --dry-run` use the
same immutable planner and perform no state-changing operations. If migrations are
pending, execution requires the exact candidate digest printed by the plan:

```bash
npm run rehearsal -- run --confirm-candidates=<sha256>
```

The public package target is `npx rehearsal ...`; DEV-082 will own the package extraction
and executable metadata. Do not treat the current repository wrapper as a published
interface.

## Configuration

Configuration has an explicit schema version. Version 1 rejects unknown versions,
unknown properties, paths outside the project root, non-loopback targets, duplicate or
privileged ports, enabled hosted access, and permissive outbound networking.

```ts
import { defineRehearsalConfig } from "@rehearsal/db";

export default defineRehearsalConfig({
  schemaVersion: 1,
  project: { name: "my-supabase-app" },
  supabase: {
    workdir: ".",
    migrationDirectory: "supabase/migrations",
    rehearsalConfig: "infrastructure/rehearsal/supabase/config.toml",
    runtimeWorkdir: ".rehearsal/runtime",
    serviceEnvironmentFile: ".env.rehearsal-service.local",
    serviceEnvironmentVariables: [
      "LOCAL_IDENTITY_CLIENT_ID",
      "LOCAL_IDENTITY_SECRET",
    ],
  },
  baseline: {
    artifactDirectory: ".rehearsal",
    sanitizationPolicy: "infrastructure/rehearsal/sanitization-policy.json",
  },
  application: {
    startCommand: "npm run dev:rehearsal",
    proofCommand: "npm run test:rehearsal",
    environmentFile: ".rehearsal/runtime.env",
  },
  runtime: {
    applicationUrl: "http://localhost:5175",
    projectId: "my-app-rehearsal",
    apiPort: 58321,
    databasePort: 58322,
    studioPort: 58323,
  },
  safety: {
    allowedHosts: ["127.0.0.1", "::1", "localhost"],
    blockedEnvironmentVariables: [
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_DB_PASSWORD",
      "SUPABASE_PROJECT_ID",
    ],
    authenticationProviders: ["example-identity-provider"],
    hostedAccess: "disabled",
    outboundNetwork: "deny",
  },
  verification: { commands: ["npm run test:rehearsal"] },
});
```

| Property                               | Type       | Required | Default                   | Meaning and safety effect                                     |
| -------------------------------------- | ---------- | -------- | ------------------------- | ------------------------------------------------------------- |
| `schemaVersion`                        | `1`        | Yes      | None                      | Pins configuration meaning; unknown versions fail.            |
| `project.name`                         | `string`   | Yes      | None                      | Stable lowercase local identifier.                            |
| `supabase.workdir`                     | `string`   | Yes      | None                      | Project-owned Supabase workdir; cannot escape the project.    |
| `supabase.migrationDirectory`          | `string`   | Yes      | None                      | Ordered application migration source.                         |
| `supabase.rehearsalConfig`             | `string`   | Yes      | None                      | Dedicated unlinked local Supabase configuration.              |
| `supabase.runtimeWorkdir`              | `string`   | Yes      | None                      | Must be `<artifactDirectory>/runtime`; always disposable.     |
| `supabase.serviceEnvironmentFile`      | `string`   | No       | None                      | Owner-only ignored credentials for the local service stack.   |
| `supabase.serviceEnvironmentVariables` | `string[]` | No       | `[]`                      | Exact variables accepted from the service environment file.   |
| `baseline.artifactDirectory`           | `string`   | No       | `.rehearsal`              | Owner-only immutable artifact generations.                    |
| `baseline.sanitizationPolicy`          | `string`   | Yes      | None                      | Exhaustive project-owned classification policy.               |
| `application.startCommand`             | `string`   | Yes      | None                      | Starts the app against the verified local runtime.            |
| `application.proofCommand`             | `string`   | Yes      | None                      | Project-owned proof after migration.                          |
| `application.environmentFile`          | `string`   | No       | `.rehearsal/runtime.env`  | Owner-only generated local runtime variables.                 |
| `application.runtimeAdapter`           | `string`   | No       | None                      | Advanced project-owned post-restore adapter path.             |
| `runtime.applicationUrl`               | URL        | No       | `http://localhost:5175`   | Must use an explicitly allowed loopback host.                 |
| `runtime.projectId`                    | `string`   | No       | `rehearsal-local`         | Dedicated local Supabase/Docker identity.                     |
| `runtime.apiPort`                      | TCP port   | Yes      | None                      | Dedicated non-privileged API port.                            |
| `runtime.databasePort`                 | TCP port   | Yes      | None                      | Dedicated non-privileged PostgreSQL port.                     |
| `runtime.studioPort`                   | TCP port   | Yes      | None                      | Dedicated non-privileged Studio port.                         |
| `safety.allowedHosts`                  | `string[]` | No       | loopback hosts            | Version 1 rejects any non-loopback entry.                     |
| `safety.blockedEnvironmentVariables`   | `string[]` | No       | Supabase hosted variables | Ambient values excluded from child processes.                 |
| `safety.authenticationProviders`       | `string[]` | No       | `[]`                      | Declared identity-only external exchanges.                    |
| `safety.hostedAccess`                  | `disabled` | No       | `disabled`                | Cannot be enabled in version 1.                               |
| `safety.outboundNetwork`               | `deny`     | No       | `deny`                    | Cannot be weakened in version 1.                              |
| `verification.commands`                | `string[]` | No       | `[]`                      | Additional declared project checks; commands remain explicit. |

Most projects should not use `runtimeAdapter`. It exists for a project that must create
synthetic local identities or add application-specific variables after a successful
restore. The adapter is project-owned, receives only the verified local environment and
baseline plus a local PostgreSQL executor, and is never bundled into the reusable
package. Its `configureRuntime` export returns a status message and explicit environment
variables. It must not read hosted credentials or perform network work.

## What each command proves

### `rehearsal doctor`

Doctor checks Node 24, the Supabase CLI, a running Docker-compatible engine, required
paths, config/runtime port agreement, baseline checksums and permissions, migration
prefix integrity, application proof command ownership, and the fail-closed safety
policy. Ambient hosted credential variables are reported only by name and remain
quarantined from children.

### `rehearsal explain` and `rehearsal run --dry-run`

Both return the same plan data. They may read and hash configuration, migrations,
policy, and baseline metadata. They never start or stop services, restore rows, apply a
migration, launch the application, write a receipt, change an artifact, or contact a
hosted resource.

### `rehearsal inspect baseline`

Inspection prints format and generation identifiers, the migration cutoff, table and
row counts, and hashes for baseline data and sanitization policy. It never prints source
rows or baseline values.

### `rehearsal inspect migrations`

Every local migration receives one interpretation:

- `represented_by_baseline`: exact filename and SHA-256 in the baseline prefix;
- `candidate`: exact suffix after that prefix, not yet proven in the current runtime;
- `applied_to_current_runtime`: the exact suffix digest has a verified local receipt;
- `modified`: a prefix filename or digest changed, so planning fails closed;
- `invalid`: filename, ordering, uniqueness, or source structure is invalid.

`rehearsal candidates` is the concise machine-friendly alias for this same migration
inspection and exact candidate digest. It does not apply a migration.

## Machine output and exit codes

Commands that report state accept `--json`. The version-1 envelope contains
`schemaVersion`, `command`, `status`, `startedAt`, `durationMs`, `warnings`, and `data`.
Failures contain a versioned error with category, stable code, message, expected and
actual state, context, refused action, suggestions, and a safe diagnostic identifier.

| Exit | Category                       |
| ---- | ------------------------------ |
| 0    | Success                        |
| 1    | Doctor completed but not ready |
| 2    | Configuration invalid          |
| 3    | Unsafe environment             |
| 4    | Baseline invalid               |
| 5    | Baseline checksum mismatch     |
| 6    | Migration candidate failure    |
| 7    | Migration verification failure |
| 8    | Application proof failure      |
| 9    | Runtime or dependency failure  |
| 10   | Unexpected internal failure    |

Human and JSON output are projections of the same model. `normal`, `--verbose`, and
`--debug` increase explanation only; none may print secrets or baseline row values.

## Guarantees

Rehearsal version 1 intends to guarantee:

- configuration and runtime targets are local-only;
- hosted application/database credentials are neither required nor inherited by child processes;
- application, provider-data, email, and hosted-database side effects fail closed;
- any declared external identity exchange terminates in the local Auth service and its
  credentials are read from an exact owner-only allowlist;
- an active baseline verifies before restore;
- migration identity uses ordered content digests, not timestamps alone;
- a changed prefix is never silently reinterpreted as a candidate;
- restore and migration failures cannot leave a runtime marked trusted;
- reports omit source rows and redact credentials, connection strings, keys, tokens,
  JWTs, passwords, and sensitive environment values.

Independent barriers include strict loopback config, a dedicated unlinked Supabase
workdir/project ID, an allowlisted child environment, and application egress denial.
A project may explicitly declare an external identity provider, but that does not grant
hosted application/database access. A single ambient connection string is therefore
insufficient to redirect an operation.

## Non-guarantees and user responsibilities

Rehearsal does not prove that a migration is semantically correct for every application
workflow, replace backups or disaster recovery, authorize production access, or make a
sanitization policy correct merely because it is exhaustive. Project owners must review
the policy, protect baseline artifacts, write meaningful application proofs, review the
candidate digest, and keep production credentials outside the Rehearsal configuration.

## Baseline lifecycle

The source boundary exposes only reviewed versioned views through a least-privilege
read-only role. Every included column has an explicit KEEP, PSEUDONYMIZE, REPLACE,
EXCLUDE, or DERIVE action. Sanitized rows stream into an owner-only build directory.
Only after exact hashes, counts, migration receipts, and policy metadata exist does an
atomic pointer activate the generation. Failed builds cannot replace the current
baseline.

Restore replays the immutable historical migration bundle, streams sanitized rows into
the disposable local database, restores optional checksummed Storage assets through the
loopback service, restores normal enforcement, and verifies counts and foreign keys
before candidate work begins. The package accepts project-owned asset bytes; it does not
know how to authorize or extract them from a hosted source.

Project policies may attach field-aware JSON rules and project-owned identity adapters.
BlendCalc uses those boundaries to preserve its exact public catalog and approved owner
snapshot while sanitizing unrelated private values, without teaching the package any
BlendCalc table names, identity relationships, or privacy decisions.

## CI example

The tracked [`github-actions.yml`](github-actions.yml) is intentionally based on the
synthetic independent fixture. A real repository should provide its own protected
sanitized baseline through an approved artifact mechanism; never commit production data
or credentials just to make CI convenient.

## Run the independent proof

From the BlendCalc repository on Node.js 24 with Docker running:

```bash
npm run rehearsal:fixture:prove
```

The proof copies the tracked synthetic fixture to a disposable directory, builds its
one-row and one-asset baseline, runs the public CLI through one valid migration and
application proof, verifies the exact Storage byte, then introduces invalid PostgreSQL.
Success means the valid migration preserved its row and asset, the invalid migration
received the intended stable failure category, and the untrusted runtime was removed.
It neither needs nor inherits BlendCalc or hosted credentials.

## Support matrix for the first beta

| Runtime or tool  | Status       | Initial contract                                      |
| ---------------- | ------------ | ----------------------------------------------------- |
| Node.js 24       | Supported    | Exact maintained major                                |
| npm              | Supported    | Lockfile-backed install and CLI                       |
| macOS            | Supported    | Directly exercised with Docker/Colima                 |
| Linux            | Supported    | Ubuntu arm64 installed-tarball fixture proof passed   |
| WSL              | Experimental | Must be exercised and documented before support claim |
| Native Windows   | Unsupported  | Path, Docker, signal, and shell behavior unproven     |
| pnpm             | Unsupported  | Detection is informational until direct proof exists  |
| Yarn             | Unsupported  | Detection is informational until direct proof exists  |
| MySQL/Mongo/etc. | Unsupported  | Version 1 is PostgreSQL/Supabase only                 |

## Troubleshooting

- `NOT READY` after Docker: start Docker Desktop or Colima, then rerun doctor.
- Baseline checksum mismatch: do not repair the hash manually. Rebuild through the
  reviewed extraction/sanitization workflow.
- Migration prefix divergence: restore the exact reviewed historical file or create a
  new baseline; never rename the edited file into the candidate suffix.
- Candidate confirmation mismatch: rerun explain, review the exact ordered candidates,
  and use the new digest only if those files are intended.
- Hosted target refusal: remove the hosted value. Version 1 has no override.
- Application proof failure: inspect the project-owned proof output; the database must
  not be treated as verified.

Security reporting, compatibility promises, and regression measurements are defined in
[SECURITY.md](SECURITY.md), [COMPATIBILITY.md](COMPATIBILITY.md), and
[BENCHMARKS.md](BENCHMARKS.md).
