# Environment Configuration

## Purpose

This document owns environment-variable placement for local development, tests,
Vercel, privileged operations, and Supabase Edge Functions. Each example contains only
the variables consumed by that environment. Secrets never belong in tracked files.

## Quick Navigation

| Need                        | Section                                                     |
| --------------------------- | ----------------------------------------------------------- |
| Choose an example file      | [Environment Files](#environment-files)                     |
| Configure local development | [Local Application](#local-application)                     |
| Run privileged scripts      | [Privileged Local Operations](#privileged-local-operations) |
| Operate the API database    | [blendCalcAPI Database](#blendcalcapi-database)             |
| Run tests                   | [Test Environment](#test-environment)                       |
| Configure Vercel            | [Vercel](#vercel)                                           |
| Configure Edge Functions    | [Supabase Edge Functions](#supabase-edge-functions)         |
| Add or rotate a variable    | [Synchronization Workflow](#synchronization-workflow)       |

## Environment Files

| Tracked contract                  | Ignored values                                                 | Consumer                                          |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| `.env.example`                    | `.env`                                                         | Local SvelteKit application and server routes     |
| `.env.blendCalcAPI.example`       | `.env.blendCalcAPI.local`                                      | Isolated blendCalcAPI database operations         |
| `.env.moderation.example`         | `.env.moderation.local`                                        | Privileged scripts and linked Supabase operations |
| `.env.test`                       | `.env.test.local`                                              | Disposable local database and Playwright          |
| `.env.vercel.example`             | `.env.vercel.production.local` and `.env.vercel.preview.local` | Vercel Production and Preview deployments         |
| `supabase/functions/.env.example` | `supabase/functions/.env.local`                                | Supabase Edge Functions                           |

The ignored mirrors are local inventory and development inputs. Vercel and Supabase
remain authoritative for deployed values. Never copy a secret into a public variable,
command argument, issue, log, test fixture, or documentation example.

The tracked `.env.test` intentionally clears `PUBLIC_TURNSTILE_SITE_KEY`. Automated
browser authentication runs only against disposable local Supabase and must not inherit
a developer's real Turnstile configuration from `.env`.

### Branches And Auxiliary Worktrees

Run ordinary branches from the primary repository checkout so its ignored environment
files remain available while switching branches. Do not copy environment files into a
new directory for routine work.

When an auxiliary Git worktree is genuinely necessary to preserve unrelated dirty work,
support explicitly requested simultaneous checkouts, or assemble a temporary integration
candidate, link only the ignored environment files required by that checkout back to the
primary repository. Verify each source with `git check-ignore`, refuse to overwrite an
existing target, and never print, copy, move, commit, or broaden access to secret values.
Remove those links with the auxiliary checkout after its work is safely integrated.

## Local Application

Copy `.env.example` to `.env`. This is the single local SvelteKit environment file; do
not split its values across a second root `.env.local`. It owns browser-safe Supabase
configuration plus server-only credentials consumed by the local SvelteKit process.

```bash
cp .env.example .env
```

Only variables beginning with `PUBLIC_` may be read by browser code. `FDC_API_KEY`,
`COLA_CLOUD_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, isolated blendCalcAPI
credentials, email credentials, and relay secrets must remain server-only. Set
`BLENDCALC_API_READ_MODE` to `source`, `shadow`, or `isolated`; local development uses
`source` unless the isolated read path is under direct test.

## Privileged Local Operations

Copy `.env.moderation.example` to `.env.moderation.local`. Use it for linked migrations,
role management, hosted audits, publication controls, provider-backed maintenance, and
other scripts that require elevated access.

```bash
cp .env.moderation.example .env.moderation.local
```

Confirm the target project before every write. Local test-database commands do not use
these hosted credentials.

The maintained hosted Auth command reads temporary Turnstile and custom SMTP inputs
only from this privileged file:

```bash
npm run auth:configure-hosted -- --turnstile --dry-run
npm run auth:configure-hosted -- --turnstile --confirm-project=<project-ref>
npm run auth:configure-hosted -- --smtp --dry-run
npm run auth:configure-hosted -- --smtp --confirm-project=<project-ref>
```

Add only the requested `SUPABASE_AUTH_*` values, run the dry run, then apply that exact
operation with the reported project confirmation. The command updates only the selected
hosted Auth fields and reports status without printing values. Leave unavailable inputs
as commented empty names in the ignored file; never rename a secret with a `PUBLIC_`
prefix.

## blendCalcAPI Database

Copy `.env.blendCalcAPI.example` to `.env.blendCalcAPI.local`. This file belongs only to
the isolated publication database and must never replace the app project's public or
service-role variables.

```bash
cp .env.blendCalcAPI.example .env.blendCalcAPI.local
```

The root Supabase link remains attached to the blendCalc application project. Every
blendCalcAPI database command must use `infrastructure/blendCalcAPI` as its explicit
workdir and verify `BLENDCALC_API_SUPABASE_PROJECT_ID` before a hosted write. The
database password may instead use the dedicated `blendCalcAPI-supabase-db-password`
macOS Keychain item. Do not reuse the application database password or Keychain name.

## Test Environment

`.env.test` contains safe, tracked defaults such as the port and database-environment
label. The local database manager writes private keys and seeded account credentials to
`.env.test.local`. Do not hand-maintain or commit that generated file.

Playwright uses port `5174` and the disposable local Supabase stack. Test credentials
must never point at production.

## Local Resource Safety

Run `npm run resources:check` before a long local session. Maintained builds, complete
Vitest projects, browser suites, full database verification, and feature/release/nightly
verification run the same preflight automatically. Local heavy work is blocked when:

- the macOS startup disk has less than 50 GiB free;
- swap use is above 8 GiB; or
- an existing development process uses more than 4 GiB resident memory.

The heavy-command runner limits Node old-space to 4 GiB, Vitest uses at most two workers,
and Playwright accepts one or two workers. The local database manager starts Colima with
four CPUs and 4 GiB memory. Complete database and release verification stop Supabase and
also stop Colima when that command started it.

Free storage or stop stale development processes rather than weakening the thresholds.
Restart macOS after severe swap pressure, keep macOS and development tools current, and
leave Colima stopped when database work is not active. The repository cannot install
operating-system updates, choose personal files to remove, or reboot safely on the
developer's behalf. `BLENDCALC_ALLOW_RESOURCE_PRESSURE=1` permits one deliberate command
only when postponing the work is less safe than proceeding.

## Vercel

`.env.vercel.example` lists only values consumed by the deployed SvelteKit app and
Vercel-owned operations. Configure each value in the narrowest required environment:

- Production credentials belong in Production only unless a Preview genuinely needs
  the same server capability.
- `BLENDCALC_API_SUPABASE_URL`, `BLENDCALC_API_SUPABASE_SERVICE_ROLE_KEY`, and
  `BLENDCALC_API_READ_MODE` belong only in deployments that run the isolated catalog
  reader or publication synchronization job.
- Preview uses its own `PUBLIC_SITE_URL` and must not receive privileged production
  credentials by default.
- Vercel automatically supplies system values such as `VERCEL_PROJECT_ID` when System
  Environment Variables are enabled.
- Pulls into `.env.vercel.*.local` are snapshots for local verification, not a mechanism
  for changing Vercel.
- Vercel does not return the values of variables stored as Secret. Its pull command
  writes a `[SENSITIVE]` marker for those entries; replace that marker only from an
  existing trusted local copy or by intentionally rotating the secret.

The blendCalcAPI publication scheduler also uses GitHub Actions. Store the same
production `CRON_SECRET` as the repository Actions secret `CRON_SECRET`, and store the
public production synchronization endpoint as the Actions variable
`BLENDCALC_API_SYNC_URL`. The URL is configuration rather than a secret. Keep Vercel's
daily cron as an independent fallback; GitHub owns the 15-minute cadence because Vercel
Hobby supports only daily cron schedules.

## Supabase Edge Functions

`supabase/functions/.env.example` lists custom secrets consumed by deployed Edge
Functions. Supabase automatically provides its platform URL and service credentials;
do not duplicate those platform-managed values in the example.

Set custom secrets through the Supabase secret manager. Keep the local mirror in
`supabase/functions/.env.local` when invoking functions locally. The catalog monitor
uses a dedicated cron secret, provider keys, and protected recall-relay credentials.

## Synchronization Workflow

When adding, removing, or rotating an environment variable:

1. Identify the exact consumer before naming the variable.
2. Add the empty name and plain-language purpose only to that consumer's tracked
   example file.
3. Update the ignored local value file used by that consumer.
4. Update Vercel or Supabase only when that deployed runtime consumes the variable.
5. Remove superseded aliases from source, examples, local files, and deployed settings
   after the replacement is confirmed.
6. Run the focused environment/configuration tests and the affected runtime check.
7. Review command output for accidental secret values before sharing logs or committing.

Never add a variable to every environment “just in case.” One concept may intentionally
use different names at a boundary—for example, the local app uses `FDC_API_KEY` while
the catalog-monitor Edge Function uses `USDA_API_KEY`—but that mapping must remain
explicit here and at the adapter boundary.

## Ownership Check

Before handoff, verify:

- every runtime variable appears in exactly the appropriate example;
- every example variable has a real consumer or documented platform purpose;
- the root local application uses `.env` rather than a duplicate `.env.local`;
- removed aliases no longer appear in source or deployed configuration;
- no tracked file contains a secret value; and
- local mirrors and deployed settings contain the names required by their consumers.
