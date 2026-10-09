# Environment Configuration

## Purpose

This document owns environment-variable placement for local development, tests,
Vercel, privileged operations, and Supabase Edge Functions. Tracked key-name templates
live together under `config/environments/`, except for the Supabase-owned Edge Function
template. Each template contains only the variables consumed by that environment.
Secrets never belong in tracked files.

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

| Tracked contract                                         | Ignored values                                                                  | Consumer                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| `config/environments/production-development.example.env` | `.env`                                                                          | Production-connected app on port `5173`           |
| `config/environments/blendcalc-api-hosted.example.env`   | `.env.blendCalcAPI.hosted.local`                                                | Guarded hosted blendCalcAPI migration operations  |
| `config/environments/privileged-operations.example.env`  | `.env.moderation.local`                                                         | Privileged scripts and linked Supabase operations |
| None; the database manager generates the contract        | `.env.test.local`                                                               | Disposable local database and Playwright          |
| `config/environments/rehearsal-auth.example.env`         | `.rehearsal-native/primary/.rehearsal/runtime.env`, `.env.rehearsal-auth.local` | Local Rehearsal runtime and Google identity       |
| `config/environments/rehearsal-source.example.env`       | `.env.rehearsal-source.local`                                                   | Separately approved source readers                |
| `config/environments/vercel.example.env`                 | `.env.vercel.production.local` and `.env.vercel.preview.local`                  | Vercel Production and Preview deployments         |
| `supabase/functions/.env.example`                        | `supabase/functions/.env.local`                                                 | Supabase Edge Functions                           |

The ignored mirrors are local inventory and development inputs. Vercel and Supabase
remain authoritative for deployed values. Never copy a secret into a public variable,
command argument, issue, log, test fixture, or documentation example.

Vite never loads repository dotenv files automatically. Maintained launchers and
deployment providers pass an explicit allowlisted process environment. The 5173
launcher reads only the reviewed production-development keys from `.env`; automated
browser authentication runs only against disposable local Supabase and receives an
explicit empty Turnstile site key unless `npm run dev:test:auth` selects the official
local test key.

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

`npm run dev` aliases `npm run dev:local` and starts the application at
`http://localhost:5173` against the established hosted production application and API
projects. It does not start or use the local application Supabase stack. Google sign-in
therefore authenticates the real hosted account, and its profile, roles, saved foods,
images, preferences, and other owner data are the real production records.

This boundary is intentionally destructive: saves, edits, deletions, privileged
actions, provider requests, and configured email side effects from 5173 are real. Use
Rehearsal on port `5175` for production-shaped work that must remain isolated from
production.

The launcher reads the ignored repository-root `.env` through the exact key list in
`config/environments/production-development.example.env`, requires mode `600`, verifies
the two established hosted Supabase project hosts, forces the browser callback origin to
`http://localhost:5173`, and then passes only the reviewed values to Vite. It does not
restore ambient dotenv loading and will not accept another hosted project accidentally.
Google continues through hosted Supabase Auth and returns to `/auth/callback` on 5173;
the production Auth redirect allowlist must retain that exact local callback.

`npm run db:local -- start` still manages the independent local application database for
database tooling, but that database is not the default 5173 application target.
`npm run dev:test` and `npm run rehearsal -- open` remain isolated on ports `5174` and `5175`.
Only variables beginning with `PUBLIC_` may be read by browser code.

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

Use `npm run mobile:open -- ios` or `npm run mobile:open -- android` to continue in the native
IDE. The iOS project declares its camera usage message; Android declares camera access
and API 26 as its minimum SDK for the barcode scanner. OAuth deep links and live barcode
scanning remain physical-device verification gates.

## Privileged Local Operations

Copy `config/environments/privileged-operations.example.env` to `.env.moderation.local`. Use it for linked migrations,
role management, hosted audits, publication controls, provider-backed maintenance, and
other scripts that require elevated access.

```bash
cp config/environments/privileged-operations.example.env .env.moderation.local
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
npm run blendCalcAPI:db -- start
npm run blendCalcAPI:db -- status
```

Guarded hosted migrations use `.env.blendCalcAPI.hosted.local`, copied from
`config/environments/blendcalc-api-hosted.example.env`. The root Supabase link remains attached to the
blendCalc application project. Hosted blendCalcAPI commands use
`infrastructure/blendCalcAPI` as their explicit workdir; local commands stage its public
inputs in an independent local-state root. A hosted write verifies
`BLENDCALC_API_SUPABASE_PROJECT_ID`. The database password may instead use the dedicated
`blendCalcAPI-supabase-db-password` macOS Keychain item. Do not reuse the application
database password or Keychain name.

## Test Environment

The local database manager writes the complete private application-database contract
and seeded account credentials to `.env.test.local`. The launcher supplies the safe
runtime label, site URL, isolated API mode, and empty Turnstile setting directly. Do not
hand-maintain or commit the generated file.
The test application launcher adds local blendCalcAPI credentials directly from its
separate local workdir. Local CLI state lives under the primary checkout's ignored
`.cache/local-supabase/<project-id>/`, including when commands run from an auxiliary
checkout. Public inputs are staged from that command's source checkout; production-linked
`.temp` files and environment secrets never move into the local root. Config/template
changes require the owned stack to be stopped first. Generated inputs are checked
against their receipt and must not be edited directly.

Playwright uses port `5174`, the disposable local application Supabase stack, and the
isolated local blendCalcAPI stack. Its orchestrator discards the parent shell
environment, passes only approved test controls, rejects a non-loopback base URL, and
supplies generated local credentials. Test credentials must never point at production.

After `npm run db:test -- reset`, `npm run dev:test` serves the local test sign-in page with
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

Rehearsal owns the sandbox lifecycle through the installed package. It does not change
production-connected development on `5173` or synthetic QA on `5174`.

```bash
npm run rehearsal -- doctor
npm run rehearsal -- run
npm run rehearsal -- open
```

The application opens at **http://localhost:5175**. Ctrl+C or Ctrl+Z closes only the
application; database and Storage state persist. Use the package's `stop` and `start`
commands for a database restart, or `reset` to deliberately replace sandbox edits with
the approved baseline. Review the candidate digest before applying migrations.

### Configuration and saved data

The active `rehearsal.config.mjs` lives at the repository root, beside `package.json`.
The package discovers it automatically and preserves it during reinstallation. Its dependent
publication database is declared in
`infrastructure/rehearsal/publication/rehearsal.config.mjs`. Application services use
ports `58320`–`58329`; publication services use `59320`–`59329`. They do not use QA
or the ordinary local publication database.

The retained publication copy includes a schema-collision acceptance fixture. Its
configuration therefore restores the copy's exact immutable migration prefix, not
new publication migrations. A fresh reviewed publication baseline is required before
switching that target to the maintained publication migration directory. This does
not modify or replace `infrastructure/blendCalcAPI/supabase/migrations/`.

- Native application baseline and generated service variables: ignored
  `.rehearsal-native/primary/.rehearsal/`.
- Native publication baseline and generated service variables: ignored
  `.rehearsal-native/publication/.rehearsal/`.
- Earlier `.rehearsal/` and `.rehearsal-publication/` baselines remain protected.
- Native privacy and source policy files: `application/privacy-policy.v2.json`,
  `application/source-access-policy.json` and their publication counterparts.
- Restore prerequisites and disabled scheduler: `application/runtime-policy.json`.
- Reviewed copied-account references and signup defaults: `application/identity-policy.json`.
- OAuth client secrets: ignored, owner-only `.env.rehearsal-auth.local`.

Paths to the JSON declarations above are relative to `infrastructure/rehearsal/`.
Rehearsal generates local service variables; do not hand-edit or commit them. They do
not contain a generated copied-owner password or callback-claim receipt. Vite receives
only explicitly mapped local service values, not the OAuth secret or hosted credentials.
Its generated SvelteKit state stays in `.svelte-kit-rehearsal/`. Local Auth cookies
remain namespaced by service port.

### Google sign-in and copied-account association

Use a dedicated Google Web client with the exact redirect
`http://127.0.0.1:58321/auth/v1/callback`. The value-free template is
`config/environments/rehearsal-auth.example.env`; the ignored credential file has mode
`600`. Do not reuse a hosted Supabase secret. Run `doctor` before starting.

1. Run `npm run rehearsal -- open`, open `http://localhost:5175/auth`, and use the
   ordinary Google sign-in button. BlendCalc requests account selection; a new Google
   session may show a login form rather than a saved-account list.
2. Dismiss the ordinary tutorial without editing the newly created account.
3. Close the application with Ctrl+C or Ctrl+Z after the callback completes.
4. Supply the approved email **server-only** as `REHEARSAL_APPROVED_OWNER_EMAIL` for
   the identity commands. Never put it in a public variable, command argument, tracked
   file, baseline, or report.
5. Run `npm run rehearsal -- identity plan --identity=approved-owner`. Review the
   proposed references, signup defaults, images and full digest.
6. Run `npm run rehearsal -- identity claim --identity=approved-owner --confirm-identity=<full-digest>`
   with the same server-only input. Unexpected account edits must refuse the claim,
   not be deleted or ignored.
7. Reopen the app, sign out, and complete a fresh Google sign-in to obtain current
   role claims. Check the copied profile, images and data.

The normal callback performs no Rehearsal claim or special refresh. Account association
belongs exclusively to the package. Its declaration transfers the reviewed ownership
graph and physical private images while preserving immutable reviewer history.
Nonmatching Google accounts remain independent local accounts. RLS, account blocks and
MFA remain enforced; Quick QA login and automatic QA MFA exist only on `5174`.

### Application proofs

During `run`, Rehearsal starts the application, waits for HTTP readiness, invokes
`scripts/operations/quality/prove_local_publication.mjs` and
`scripts/operations/quality/prove_local_application.mjs`, and owns shutdown.

These are ordinary BlendCalc tests, not launchers or runtime adapters. They read the
publication model and exercise purpose-created local Auth, role/refresh/RLS/MFA
boundaries, profile save/reload, three publication products and searches, negative API
controls, signed avatar/evidence rendering and rejected-session recovery in Chromium,
Firefox and WebKit. The negative session fixture has an altered expired JWT and an
invalid refresh token; it does not prove natural token expiration. Synthetic fixtures
are removed afterward. Genuine Google login
and copied-owner association remain separate observed checks.

### Package-owned source preparation

The package executes the reviewed v2 privacy declarations, including all 27 structured
fields. BlendCalc has no source-copy, sanitizer, Storage inventory or preparation runner.
The retained version-1 policy files belong to earlier checksummed baselines and must not
be rewritten for new copies. Generic package verification belongs to Rehearsal Test Lab.

The active source policies are bound to approved loopback copies, exact external reader
groups/views and their reviewed columns. They do not grant hosted access. The source
provider supplies expiring read-only credentials and the bounded Storage-reader token;
no application service-role credential is accepted as the source reader.

`config/environments/rehearsal-source.example.env` lists only server-side inputs. Supply
them through an owner-only environment manager; merely creating the ignored source
dotenv file does not load it into the CLI. Never put a raw owner ID, email, key or token
in a tracked declaration or command argument. Owner bindings and targets are hashed.

Run `source plan`, `source apply --confirm-source-access=<full-digest>`, `baseline refresh`,
then preview and confirm `source retire`. Repeat with
`--config=infrastructure/rehearsal/publication/rehearsal.config.mjs` for publication.
State-changing commands run sequentially. The default command selects only the primary
source; dependent source preparation is not implicit.

Each target stores its credential/receipt and Base64 privacy key privately inside its
configured artifact root. `privacy key --write` is first-time creation only; it refuses
to replace an existing key. The approved legacy binary key remains untouched and its
native encoded copies preserve the same cryptographic bytes. Key changes require review
of account, relationship and asset mappings, not a compatibility loader.

`baseline refresh` activates a verified generation without resetting runtime edits or
pruning earlier generations. Reset and cleanup are separate deliberate operations.
External `source retire` removes local access state, not provider-owned roles or views;
the provider owns credential revocation and expiry. See the
[package documentation](https://ddupasquier.github.io/rehearsal-db/) for its public commands.

## Local Resource Safety

Run `npm run resources:check` before a long local session. Maintained builds, complete
Vitest projects, browser suites, full database verification, and feature/release/nightly
verification run the same preflight automatically. Local heavy work is blocked when:

- the macOS startup disk has less than 50 GiB free;
- current macOS memory pressure is warning or critical;
- swap use exceeds one physical-RAM-sized budget, capped at 16 GiB;
- macOS physical RAM or current pressure cannot be measured reliably; or
- an existing development process uses more than 5 GiB resident memory.

The heavy-command runner limits Node old-space to 4 GiB, Vitest uses at most four workers,
and Playwright accepts one or two workers. The local database manager starts Colima with
four CPUs and 4 GiB memory; the 5 GiB process guard leaves room for its virtualization
overhead without loosening the Node heap or process limit. Complete database and release verification stop Supabase and
also stop Colima when that command started it.

On a 16 GiB Mac, the permanent swap budget is 16 GiB; an 8 GiB Mac gets 8 GiB and
larger Macs remain capped at 16 GiB. Retained swap alone does not identify current
memory pressure. The read-only report shows RAM, current pressure and the effective
swap limit. The pressure sysctl exposes notification flags (normal, warning, critical),
not the different internal kernel enum; see Apple's
[export implementation](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/kern_memorystatus_notify.c).

Free storage or stop stale development processes when the measured bounds are exceeded.
Restart macOS after severe swap pressure, keep macOS and development tools current, and
leave Colima stopped when database work is not active. The repository cannot install
operating-system updates, choose personal files to remove, or reboot safely on the
developer's behalf. `BLENDCALC_ALLOW_RESOURCE_PRESSURE=1` permits one deliberate command
only when postponing the work is less safe than proceeding.

## Vercel

`config/environments/vercel.example.env` lists only values consumed by the deployed SvelteKit app and
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

## Legacy Local File Cleanup

The maintained tools no longer read `.env`, `.env.local`, or
`.env.blendCalcAPI.local`. Older checkouts may still have one or more of these ignored
files. Do not delete them until their key names—not their values—have been compared with
the current owners:

1. Put privileged Supabase and provider values in `.env.moderation.local`, using
   `config/environments/privileged-operations.example.env` as the key-name checklist.
2. Put isolated hosted blendCalcAPI migration values in
   `.env.blendCalcAPI.hosted.local`, using
   `config/environments/blendcalc-api-hosted.example.env` as the checklist.
3. Confirm Vercel owns deployed application values; ignored `.env.vercel.*.local` files
   are inventory snapshots only.
4. Confirm `npm run dev`, `npm run check`, and the intended privileged dry run work
   without the legacy files.
5. Remove only the obsolete ignored files after that comparison. Never copy values into
   a tracked template or command line.

## Ownership Check

Before handoff, verify:

- every manually configured runtime variable appears in exactly the appropriate
  template;
- every example variable has a real consumer or documented platform purpose;
- production-connected 5173, TEST, and Rehearsal launchers construct explicit
  environments without ambient root dotenv layering;
- removed aliases no longer appear in source or deployed configuration;
- no tracked file contains a secret value; and
- local mirrors and deployed settings contain the names required by their consumers.
