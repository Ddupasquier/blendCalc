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
| Run tests                   | [Test Environment](#test-environment)                       |
| Configure Vercel            | [Vercel](#vercel)                                           |
| Configure Edge Functions    | [Supabase Edge Functions](#supabase-edge-functions)         |
| Add or rotate a variable    | [Synchronization Workflow](#synchronization-workflow)       |

## Environment Files

| Tracked contract                  | Ignored values                                                 | Consumer                                          |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| `.env.example`                    | `.env` and `.env.local`                                        | Local SvelteKit application and server routes     |
| `.env.moderation.example`         | `.env.moderation.local`                                        | Privileged scripts and linked Supabase operations |
| `.env.test`                       | `.env.test.local`                                              | Disposable local database and Playwright          |
| `.env.vercel.example`             | `.env.vercel.production.local` and `.env.vercel.preview.local` | Vercel Production and Preview deployments         |
| `supabase/functions/.env.example` | `supabase/functions/.env.local`                                | Supabase Edge Functions                           |

The ignored mirrors are local inventory and development inputs. Vercel and Supabase
remain authoritative for deployed values. Never copy a secret into a public variable,
command argument, issue, log, test fixture, or documentation example.

## Local Application

Copy `.env.example` to `.env`. This file owns browser-safe Supabase configuration plus
server-only credentials consumed by the local SvelteKit process.

```bash
cp .env.example .env
```

Only variables beginning with `PUBLIC_` may be read by browser code. `FDC_API_KEY`,
`COLA_CLOUD_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, email credentials, and relay secrets
must remain server-only.

## Privileged Local Operations

Copy `.env.moderation.example` to `.env.moderation.local`. Use it for linked migrations,
role management, hosted audits, publication controls, provider-backed maintenance, and
other scripts that require elevated access.

```bash
cp .env.moderation.example .env.moderation.local
```

Confirm the target project before every write. Local test-database commands do not use
these hosted credentials.

## Test Environment

`.env.test` contains safe, tracked defaults such as the port and database-environment
label. The local database manager writes private keys and seeded account credentials to
`.env.test.local`. Do not hand-maintain or commit that generated file.

Playwright uses port `5174` and the disposable local Supabase stack. Test credentials
must never point at production.

## Vercel

`.env.vercel.example` lists only values consumed by the deployed SvelteKit app and
Vercel-owned operations. Configure each value in the narrowest required environment:

- Production credentials belong in Production only unless a Preview genuinely needs
  the same server capability.
- Preview uses its own `PUBLIC_SITE_URL` and must not receive privileged production
  credentials by default.
- Vercel automatically supplies system values such as `VERCEL_PROJECT_ID` when System
  Environment Variables are enabled.
- Pulls into `.env.vercel.*.local` are snapshots for local verification, not a mechanism
  for changing Vercel.
- Vercel does not return the values of variables stored as Secret. Its pull command
  writes a `[SENSITIVE]` marker for those entries; replace that marker only from an
  existing trusted local copy or by intentionally rotating the secret.

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
- removed aliases no longer appear in source or deployed configuration;
- no tracked file contains a secret value; and
- local mirrors and deployed settings contain the names required by their consumers.
