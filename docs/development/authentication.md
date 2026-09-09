# Authentication And Deployment

The app uses Supabase Auth with server-side PKCE cookies. Authentication must start and
finish on the same origin. Production uses `PUBLIC_SITE_URL`, Vercel previews use the
exact `VERCEL_URL` or `VERCEL_BRANCH_URL` supplied by Vercel, and localhost remains
local. Unrecognized hosted origins fall back to the canonical production origin.

Every server request establishes identity from verified JWT claims through
`locals.getVerifiedUser()`. Server authorization must not read `session.user` from the
cookie-backed session object. Operations that require the current Auth record, such as
test-fixture identity checks or Auth-account mutations, call `auth.getUser()` instead.

Server-side MFA status follows the same boundary: trusted factor records come from
`auth.getUser()`, and the current authenticator assurance level comes from verified JWT
claims. It never derives identity or factor state from `getSession()`.

This document owns Auth and deployment-origin configuration. General server/database
boundaries live in [`data-architecture.md`](data-architecture.md), and table policies
live in [`supabase-schema.md`](supabase-schema.md). Production network restrictions,
backups, recovery, hosted audits, and incident response live in
[`hosted-security.md`](hosted-security.md).

## Quick Navigation

| Need                            | Sections                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| Configure local and hosted Auth | [Environment Variables](#environment-variables) and [Supabase Dashboard](#supabase-dashboard)       |
| Enforce account security        | [Account Security Settings](#account-security-settings) and [Database Security](#database-security) |
| Use disposable QA accounts      | [Local QA Sign-In](#local-qa-sign-in)                                                               |
| Prove the complete setup        | [Verification](#verification)                                                                       |

## Environment Variables

Local `.env`:

```text
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
PUBLIC_SITE_URL=
PUBLIC_TURNSTILE_SITE_KEY=
```

Vercel Production and Preview environments:

```text
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
PUBLIC_SITE_URL=https://www.blendcalc.food
PUBLIC_TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
```

In Vercel project settings, keep **Automatically expose System Environment Variables**
enabled so Preview deployments receive `VERCEL_URL` and `VERCEL_BRANCH_URL`. Do not put
a Supabase service-role key in any public environment variable or browser code.

Successful login and logout boundaries emit only anonymous, property-free operational
event names. Their storage and privacy boundary is documented in
[`data-architecture.md`](data-architecture.md#operational-analytics).

## Supabase Dashboard

In **Authentication → URL Configuration**:

- Site URL: `https://www.blendcalc.food`
- Redirect URL: `https://www.blendcalc.food/auth/callback`
- Redirect URL: `http://localhost:5173/auth/callback`
- Test Redirect URL: `http://localhost:5174/auth/callback`
- Preview Redirect URL: `https://*-<vercel-account-slug>.vercel.app/auth/callback`

Keep exact callback URLs for production and localhost. Restrict the Preview wildcard to
this project's Vercel account suffix rather than allowing every `vercel.app` deployment.
The legacy `https://blendcalc.vercel.app` production alias remains reachable for shared
links, while authentication requests from it move to the canonical custom domain before
provider handoff. It is a compatibility entry point, not a second canonical origin.

Password recovery passes the exact origin-specific `/auth/callback` URL to Supabase.
The fixed `/auth/update-password` destination stays in the short-lived, HTTP-only auth
flow cookie instead of being appended as a callback query parameter. This keeps the
provider redirect on the exact allow-listed URL; an unrecognized redirect would fall
back to the Site URL and strand the PKCE verifier on the originating browser.

All password inputs use the shared visibility control: an eye button toggles the
current field between concealed and visible text while preserving the entered value,
autocomplete contract, and independent state of confirmation fields. Its accessible
name changes from `Show …` to `Hide …` with the visible state.

Account creation and password updates validate the confirmation field as the person
types. A mismatch is announced, marks the confirmation field invalid, and keeps the
submission action unavailable until both values match and the password satisfies the
application policy. Server validation remains authoritative for every submission.

In **Authentication → Sign In / Providers → Google**, use the Google client ID and
secret. In Google Cloud, configure:

- JavaScript origin: `http://localhost:5173`
- Test JavaScript origin: `http://localhost:5174`
- JavaScript origin: `https://www.blendcalc.food`
- Redirect URI: the Supabase callback displayed in the Google provider panel, such as
  `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

## Account Security Settings

The tracked Supabase configuration currently enforces:

- Email confirmation for password accounts.
- A minimum password length of **15 characters** so hosted Auth matches the
  application policy in `src/lib/utils/auth/passwordPolicy.ts`.
- No uppercase, lowercase, number, or symbol composition requirements. The app
  accepts long passphrases, spaces, Unicode, and password-manager values.
- Secure password changes. Recently authenticated users and password recovery
  sessions can update directly; older sessions must reauthenticate.
- Hosted breached-password screening against known compromised credentials.
- Eight-character email OTPs with a one-minute resend interval.
- TOTP enrollment and verification through `/auth/mfa/enroll` and
  `/auth/mfa/challenge`.
- Authenticator setup renders Supabase's standard TOTP URI as a local, high-contrast
  QR code with error correction and a full quiet zone. The URI, setup secret, QR code,
  and one-time codes remain private, uncached, and absent from logs.
- Enrollment and challenge accept the current six-digit TOTP code shown by Google
  Authenticator or another standards-compatible app. Spaces, common separators, and
  compatible full-width digits are normalized before server verification; every
  request still must resolve to exactly six digits.
- AAL2 session enforcement for moderator, administrator, and developer pages,
  server actions, JSON endpoints, review counts, and database-owned permissions.
- An explicit Cloudflare Turnstile widget that passes one-time tokens to Supabase
  email sign-in, registration, and password-recovery requests when a public site key
  is configured.

Before public launch, also:

- Add the production Turnstile site key to Vercel, configure its secret in hosted
  Supabase Auth, verify email Auth on production and preview origins, and only then
  enable hosted CAPTCHA enforcement.
- Enroll every moderator, administrator, and developer account in TOTP and complete
  one protected-action challenge before depending on those accounts operationally.
- Review Auth rate limits; lower them if automated abuse appears.
- Configure custom SMTP and verify the exact sender domain with the provider before
  depending on confirmation or recovery emails.
- Keep the recovery request response account-neutral. A provider-accepted request may
  say that an email is on the way if the account exists; a rejected CAPTCHA, SMTP, rate
  limit, or provider request must instead show actionable retry guidance.
- Keep refresh-token reuse detection enabled.
- Review Auth audit logs after failed or suspicious sign-ins.

Engineering may apply Turnstile and custom SMTP settings from the ignored privileged
environment with `npm run auth:configure-hosted -- --turnstile` or `--smtp`. Always run
the matching `--dry-run` first, then repeat the command with the exact
`--confirm-project=<project-ref>` value it reports. The operation accepts only
`SUPABASE_AUTH_*` inputs, updates only the selected hosted Auth fields, and never prints
protected values. Supabase may return stored SMTP passwords only as opaque protected
markers, so confirmation requires that marker to remain present while matching the
sender, host, port, user, and sender name exactly. The read-only hosted-security audit
separately verifies provider sender-domain readiness; a successful configuration write
does not claim that email delivery is ready.

### Transactional Email Catalog

Supabase Auth email content is source-controlled in `supabase/templates/`. The catalog
covers confirmation, recovery, invitation, magic-link/OTP, email-change, and
reauthentication messages plus password, email, MFA-factor, and linked-identity security
notifications. Phone-change notification remains disabled while phone Auth is disabled.
Local Mailpit and hosted Auth use the same subjects and HTML, so a locally reviewed
message is the artifact later promoted to production.

All Auth mail sends as `blendCalc <accounts@noreply.blendcalc.food>`. The dedicated
subdomain isolates transactional sending reputation. Templates are self-contained,
include a plain visible fallback URL or code when applicable, and contain no remote
images, tracking pixels, scripts, marketing copy, secrets, or account-existence claims.
Security notifications direct unexpected changes to `support@blendcalc.food`.

Run `npm run auth:configure-hosted -- --templates --dry-run` before applying template
changes. After review, repeat with the reported `--confirm-project=<project-ref>` value.
The write verifies every subject, HTML body, and notification toggle exactly. The hosted
security audit treats any later difference from the tracked catalog as configuration
drift. Template styling follows the shared blendCalc visual language and must be reviewed
with the final public landing-page direction in DEV-055; the delivery contract and Auth
variables remain independent of that visual pass.

CAPTCHA requires dashboard secrets and a public site key, so it must not be enabled in
Supabase until both values are configured and the deployed token flow has passed a
real email sign-in, registration, and recovery check. Google OAuth continues through
its provider redirect and does not accept the Supabase CAPTCHA token option.

TOTP recovery intentionally cannot be completed with only a password reset. A user
who loses every enrolled authenticator is stopped at `/auth/mfa/recovery`; an
administrator must verify the person's identity and remove the inaccessible factor
through trusted Supabase operations before the user enrolls again.

## Database Security

Every user-data table has RLS enabled and policies scoped to `(select auth.uid())`.
Anonymous table privileges are revoked by migration. Follow the database change and
verification workflow in [`database-testing.md`](database-testing.md) rather than
maintaining an authentication-specific migration sequence.

### Application Role Claims

Supabase's `anon`, `authenticated`, and `service_role` claims remain infrastructure
roles. blendCalc moderator, administrator, and developer access is instead assigned in
`app_role_assignments`. The Custom Access Token hook adds `user`, `moderator`, `admin`,
or `developer` to newly issued JWTs as the signed `app_role` claim.

The claim is a signed role hint for application and policy use; it is not the sole
authority for privileged work. Moderator routes, server actions, and privileged
database functions re-check the current assignment and require an `aal2` session
because an already-issued JWT can outlive a role change until its next refresh. The
hook always replaces a pre-existing claim from the database and defaults unknown or
malformed subjects to `user`.

`supabase/config.toml` owns the canonical production/local callback allowlist, the
blocked-signup hook, and the role-claim hook. After the migrations pass locally, deploy
the database first and then run `supabase config push` so the linked Auth service uses
the tracked hooks. Users receive a changed role on their next sign-in or token refresh;
removing a role takes effect immediately at privileged server/database checks even if
an older token still contains the previous hint.

Application permissions are mapped in `app_role_permissions`. The
`authorize_app_permission` function is available for RLS policies, but destructive
moderation boundaries still check the current assignment rather than trusting a
potentially stale JWT alone.

## Local QA Sign-In

The isolated test app at `http://localhost:5174` defaults to a Quick QA login panel.
Choose any maintained seeded persona and continue; the server resolves that selection
to the generated disposable credential without sending the password to the browser.
The account descriptions identify populated, empty, onboarding, warning,
browser-worker, moderator, administrator, and developer states.

Turn on **Test the real sign-in flow** to use the ordinary Google and email/password
controls. Use that mode whenever authentication itself, credential errors, password
recovery, account creation, OAuth, CAPTCHA, or MFA is under review.

Start the app with `npm run dev:test:auth` when the visible Turnstile interaction is part
of that review. This uses Cloudflare's public always-pass test site key on localhost
without authorizing localhost on the production widget. The resulting local token proves
the rendered challenge and form integration only; hosted enforcement and real email
delivery still require staging or production verification.

Quick QA login fails closed unless all of these conditions hold at the same time:

- `BLENDCALC_DATABASE_ENVIRONMENT` is `test`;
- the requested application origin is loopback HTTP on port `5174`;
- the configured Supabase endpoint is loopback HTTP on port `54321`; and
- `npm run db:test:start` generated the disposable QA password in `.env.test.local`.

The selector is absent on ordinary local development, previews, staging, and
production. It creates a normal local Supabase session and does not bypass role checks,
account blocks, password policies, or privileged MFA requirements.

## Verification

```bash
npm run check:auth
node scripts/audits/security/audit_hosted_security.mjs
supabase config push
npm run check
npm test
npm run build
```

Manually verify both localhost and production:

1. Every Google sign-in opens Google's account chooser and returns to the same origin
   where it started instead of silently reusing whichever Google account is active.
2. Email sign-in, sign-out, confirmation, and password recovery work.
3. A second user cannot read or change the first user's rows.
4. Opening two tabs and clicking Google sign-in quickly does not create two submissions;
   the button should become disabled immediately.
5. Authenticated pages return `Cache-Control: private, no-store`.
6. New password accounts reject short, common, email-derived, and mismatched passwords
   with an actionable message.
7. An existing account with a legacy password can sign in, is immediately sent to
   `/auth/update-password`, and cannot continue until the update succeeds.
8. An elevated account can scan the setup QR code, submit the current six-digit code
   with or without a display space, and retry a rejected or expired code without losing
   the active setup screen.
