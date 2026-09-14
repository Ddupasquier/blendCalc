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
| Build native app shells     | [Native Application](#native-application)                   |
| Run privileged scripts      | [Privileged Local Operations](#privileged-local-operations) |
| Operate the API database    | [blendCalcAPI Database](#blendcalcapi-database)             |
| Run tests                   | [Test Environment](#test-environment)                       |
| Run Rehearsal               | [Rehearsal Environment](#rehearsal-environment)             |
| Configure Vercel            | [Vercel](#vercel)                                           |
| Configure Edge Functions    | [Supabase Edge Functions](#supabase-edge-functions)         |
| Add or rotate a variable    | [Synchronization Workflow](#synchronization-workflow)       |

## Environment Files

| Tracked contract                                                                 | Ignored values                                                                       | Consumer                                           |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `.env.example`                                                                   | `.env`                                                                               | Optional loopback-only local application overrides |
| `.env.blendCalcAPI.hosted.example`                                               | `.env.blendCalcAPI.hosted.local`                                                     | Guarded hosted blendCalcAPI migration operations   |
| `.env.moderation.example`                                                        | `.env.moderation.local`                                                              | Privileged scripts and linked Supabase operations  |
| `.env.test`                                                                      | `.env.test.local`                                                                    | Disposable local database and Playwright           |
| `.env.rehearsal`, `.env.rehearsal-auth.example`, `.env.rehearsal-source.example` | `.rehearsal/runtime.env`, `.env.rehearsal-auth.local`, `.env.rehearsal-source.local` | Production-shaped local Rehearsal                  |
| `.env.vercel.example`                                                            | `.env.vercel.production.local` and `.env.vercel.preview.local`                       | Vercel Production and Preview deployments          |
| `supabase/functions/.env.example`                                                | `supabase/functions/.env.local`                                                      | Supabase Edge Functions                            |

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

`npm run dev` aliases `npm run dev:local`. The launcher starts or validates both local
Supabase workdirs, derives their local credentials from `supabase status`, builds a new
allowlisted child environment, disables Vite environment-file layering, and starts the
application at `http://localhost:5173`. It preserves existing local database state.

The launcher never reads `.env`, `.env.moderation.local`, a Vercel pull, or the hosted
blendCalcAPI file. Provider APIs, email delivery, cron credentials, hosted Supabase
tokens, and other non-loopback application requests are absent and denied. The only
external safe-runtime exception is read-only rendering and processing of an exact,
already-stored Open Food Facts image URL. `.env.example` remains a loopback-only
reference for tools that intentionally read `.env`; do not place hosted values in that
file.

```bash
cp .env.example .env
```

Only variables beginning with `PUBLIC_` may be read by browser code. Local and test
runtimes always use `BLENDCALC_API_READ_MODE=isolated`; missing or invalid read modes
fail instead of silently falling back to the production source path.

## Native Application

The Capacitor iOS and Android projects use the bundled local bootstrap in `mobile/web`.
Production native builds must not set Capacitor `server.url`, enable cleartext traffic,
or allow arbitrary navigation. The authenticated native client will connect through an
explicit app API and deep-link boundary rather than embedding the hosted SvelteKit site.

Install Xcode for iOS and Android Studio plus JDK 17 or newer for Android. On macOS with
Homebrew, select the installed JDK only for the current terminal before Android commands:

```bash
export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
npm run mobile:sync
npm run mobile:doctor
```

Use `npm run mobile:open:ios` or `npm run mobile:open:android` to continue in the native
IDE. The iOS project declares its camera usage message; Android declares camera access
and API 26 as its minimum SDK for the barcode scanner. OAuth deep links and live barcode
scanning remain physical-device verification gates.

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
prefix. For Resend SMTP, the hosted-security audit reuses the protected SMTP credential
inside this same privileged process to read only provider domain readiness. It does not
introduce a duplicate provider-key variable or serialize the credential.

## blendCalcAPI Database

Local blendCalcAPI lifecycle commands derive credentials from the isolated workdir and
receive a clean process environment. They do not require an environment file:

```bash
npm run blendCalcAPI:db:start
npm run blendCalcAPI:db:status
```

Guarded hosted migrations use `.env.blendCalcAPI.hosted.local`, copied from
`.env.blendCalcAPI.hosted.example`. The root Supabase link remains attached to the
blendCalc application project. Every blendCalcAPI database command uses
`infrastructure/blendCalcAPI` as its explicit workdir, and a hosted write verifies
`BLENDCALC_API_SUPABASE_PROJECT_ID`. The database password may instead use the dedicated
`blendCalcAPI-supabase-db-password` macOS Keychain item. Do not reuse the application
database password or Keychain name.

## Test Environment

`.env.test` contains safe tracked defaults and the explicit `test` runtime label. The
local database manager writes private application-database keys and seeded account
credentials to `.env.test.local`. Do not hand-maintain or commit that generated file.
The test application launcher adds local blendCalcAPI credentials directly from its
separate workdir.

Playwright uses port `5174`, the disposable local application Supabase stack, and the
isolated local blendCalcAPI stack. Its orchestrator discards the parent shell
environment, passes only approved test controls, rejects a non-loopback base URL, and
supplies generated local credentials. Test credentials must never point at production.

After `npm run db:test:reset`, `npm run dev:test` serves the local test sign-in page with
a Quick QA login dropdown. The dropdown reads the maintained seeded persona catalog and
uses the generated password only on the server. Turn on **Test the real sign-in flow**
when the password, Google, registration, recovery, CAPTCHA, or MFA experience is the
subject of the test. The quick path is unavailable unless the app, database mode,
Supabase endpoint, and generated credential all match the isolated loopback test
environment.

Use `npm run dev:test:auth` when Turnstile itself is under direct review. It keeps the
same isolated database and port but supplies Cloudflare's official always-pass test site
key only to that process. The ordinary `dev:test` and automated Playwright runtime keep
the key cleared so provider UI cannot make unrelated browser tests nondeterministic.
Local Supabase does not prove hosted CAPTCHA enforcement; use this mode to verify the
visible widget and token-carrying form flow, then verify enforcement and real email
delivery on an approved hosted origin.

## Rehearsal Environment

Rehearsal is a third local-only runtime, separate from ordinary development and the
synthetic QA database. `npm run db:rehearsal:reset` restores the active checksummed
sanitized baseline into its own Supabase workdir on ports `58320` through `58329`;
`npm run dev:rehearsal` serves the app at `http://localhost:5175`. The launcher accepts
only those loopback application and database endpoints, clears hosted application and
provider-data credentials, and uses the same fail-closed external-request and local
email-sink boundaries as TEST. A separately declared Google identity exchange is the
only external Rehearsal exception; its callback and resulting Auth state remain local.

The database manager generates `.rehearsal/runtime.env`. Do not hand-edit or commit it.
It contains only derived local endpoints, the fixed local owner-snapshot credential,
and nonreversible owner receipts used to exercise authenticated and MFA-protected flows.
TOTP enrollment is enabled in the isolated Rehearsal Auth service. Email delivery, SMS, Edge Functions, Realtime,
analytics, provider enrichment, hosted Supabase, and hosted blendCalcAPI remain
unavailable. New password or Google identities are written only to the disposable local
Auth database.

Google OAuth requires a dedicated local Web client. Do not reuse a hosted Supabase
secret or put it in `.rehearsal/runtime.env`:

1. In Google Cloud, create an OAuth 2.0 **Web application** client for Rehearsal.
2. Add `http://127.0.0.1:58321/auth/v1/callback` as an exact authorized redirect URI.
3. Copy `.env.rehearsal-auth.example` to `.env.rehearsal-auth.local`.
4. Put the Web client ID and secret in the two named variables, then run
   `chmod 600 .env.rehearsal-auth.local`.
5. Run `npm run rehearsal -- doctor`; **Local service credentials** must pass.
6. Run `npm run db:rehearsal:reset`, then `npm run dev:rehearsal`.

The ignored credential file is read through an exact two-variable allowlist and is
passed only to the local Supabase CLI. It is never inherited by Vite, app server code,
the browser, a baseline, or a diagnostic report.

Each restore also recreates the excluded catalog-monitor singleton in a disabled state.
That keeps operational diagnostics readable without copying invocation history or
allowing Rehearsal to schedule provider work. Browser sessions are revalidated against
the current local Auth database, so a reset invalidates the old session cleanly and the
next protected navigation returns to Rehearsal sign-in.

The Rehearsal sign-in page defaults to the same easy-auth experience used for local QA,
but offers only the restored owner snapshot. The password stays server-side in the generated
owner-only runtime file. Turning on **Test the real sign-in flow** restores the ordinary
Google and email/password controls. Google always opens its account chooser, returns
through local Auth on port `58321`, and then returns to the initiating route on port
`5175`. Easy auth still creates a normal local session and does not bypass TOTP for
privileged routes.

The production refresh fixes one approved source owner account. That owner's non-secret
private application rows are kept exact under a pseudonymous placeholder; every other
identity and private value remains sanitized or excluded. When the same owner uses
Google, the callback compares the signed-in email with the source-bound SHA-256 receipt
and atomically transfers the complete owner graph and private Storage paths to that
local Google UUID. A different Google account remains a fresh local account. Neither
path can read or mutate production after the baseline has been created.

The active baseline under ignored `.rehearsal/` contains sanitized table records,
exact row and file checksums, bounded checksummed Storage bytes, and an immutable
migration-source prefix. Public product/catalog data and the approved owner's private
application state remain production-faithful; unrelated private values do not. The
artifact never contains production credentials. A random owner-only
`.rehearsal/sanitization.key` remains local and makes pseudonyms reproducible across
refreshes without deriving them from a guessable production identifier. It is not part
of any baseline and must never be copied, logged, or committed. Production refresh
retains the active verified generation and one verified fallback; older generations are
removed only after activation succeeds. `db:rehearsal:migrate` requires the exact
candidate digest reported by `db:rehearsal:candidates`; use
`db:rehearsal:run` to reset, apply the confirmed candidate set, and verify the result.
Local-source refresh exists to prove the complete machinery without production access.
`npm run rehearsal:app:prove` starts the application briefly against those verified
local services, proves the Rehearsal-only CSP, owner-snapshot Auth exchange and
database-owned developer claim, and isolated API route, then stops the app while leaving
the database stacks available for manual review.

The production refresh credential is separate from the OAuth client and from generated
runtime credentials. Only after the export migration and least-privilege source
identities have been separately authorized:

1. Run `npm run db:rehearsal:provision-source -- --dry-run` and review the exact linked
   project, fixed-owner rule, ephemeral source role, and ignored output path.
2. Repeat with the reported `--confirm-project=<project-ref>`. The operation creates or
   rotates the ephemeral database reader, mints a short-lived Storage session without
   weakening hosted CAPTCHA, proves both scopes, and writes owner-only ignored
   `.env.rehearsal-source.local` atomically; never hand-edit or copy credentials from
   command output.
3. Run `npm run db:rehearsal:refresh` twice to build and independently reproduce the
   sanitized production-derived baseline.
4. Run `npm run db:rehearsal:deprovision-source -- --dry-run`, then its reported
   `--confirm-project=<project-ref>` form. Confirm that the temporary database role,
   Storage identity, and local source-token file are absent; the active baseline is
   retained.
5. Run `npm run db:rehearsal:reset` and `npm run db:rehearsal:verify` before starting
   `npm run dev:rehearsal`.

The refresh accepts neither a source service-role key, a reusable Storage password, nor
a writable database login.
Its PostgreSQL scope is fixed to one owner in `rehearsal_export.source_scopes`; its
Storage JWT can read only public product images and that owner's private avatar and
submission-evidence prefixes.

## Local Resource Safety

Run `npm run resources:check` before a long local session. Maintained builds, complete
Vitest projects, browser suites, full database verification, and feature/release/nightly
verification run the same preflight automatically. Local heavy work is blocked when:

- the macOS startup disk has less than 50 GiB free;
- swap use is above 8 GiB; or
- an existing development process uses more than 5 GiB resident memory.

The heavy-command runner limits Node old-space to 4 GiB, Vitest uses at most four workers,
and Playwright accepts one or two workers. The local database manager starts Colima with
four CPUs and 4 GiB memory; the 5 GiB process guard leaves room for its virtualization
overhead without loosening the Node heap or swap limits. Complete database and release verification stop Supabase and
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
- Nutrition-label OCR uses Vercel's request-scoped `waitUntil` background boundary so
  the job route returns without waiting for recognition. Local development schedules
  the same durable job processor asynchronously in the local Node process. Neither path
  requires a new application secret. Do not add a top-level Vercel `api/` function for
  this work because that deployment shape shadows parameterized SvelteKit API routes.
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

The API operational-alert scheduler reuses `CRON_SECRET` and stores the public protected
route as the Actions variable `BLENDCALC_API_ALERT_URL`. The Vercel application owns
`RESEND_API_KEY`, `API_ALERT_EMAIL_FROM`, and secret `API_ALERT_EMAIL_TO`; the recipient
may contain a comma-separated owner list. The scheduled workflow receives neither the
email credential nor recipient addresses. Alert delivery and evaluation stay inside the
protected application route, and a delivery failure fails the workflow as a secondary
operator signal.

All application-owned Resend messages use the provider-verified
`noreply.blendcalc.food` transactional subdomain. Use
`moderation@noreply.blendcalc.food` for user moderation notices and
`operations@noreply.blendcalc.food` for internal API alerts. User-facing messages may
set `support@blendcalc.food` as Reply-To; credentials and recipients remain server-only.
Supabase Auth separately sends as `accounts@noreply.blendcalc.food` using the protected
SMTP settings in `.env.moderation.local`. Marketing or subscription mail must use a
separately reviewed future sending boundary rather than these transactional identities.

The daily `/api/internal/nutrition-label-ocr/cleanup` cron uses the existing
`CRON_SECRET` and removes expired temporary OCR objects and job rows. Background
recognition starts only from the authenticated job-creation route and receives only the
server-owned job identifier.

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
