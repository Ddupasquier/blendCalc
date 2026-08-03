# Authentication and deployment checklist

The app uses Supabase Auth with server-side PKCE cookies. Authentication must start and
finish on the same origin. Production uses `PUBLIC_SITE_URL`, Vercel previews use the
exact `VERCEL_URL` or `VERCEL_BRANCH_URL` supplied by Vercel, and localhost remains
local. Unrecognized hosted origins fall back to the canonical production origin.

This document owns Auth and deployment-origin configuration. General server/database
boundaries live in [`data-architecture.md`](data-architecture.md), and table policies
live in [`supabase-schema.md`](supabase-schema.md).

## Environment variables

Local `.env`:

```text
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
PUBLIC_SITE_URL=
```

Vercel Production and Preview environments:

```text
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
PUBLIC_SITE_URL=https://blendcalc.vercel.app
```

In Vercel project settings, keep **Automatically expose System Environment Variables**
enabled so Preview deployments receive `VERCEL_URL` and `VERCEL_BRANCH_URL`. Do not put
a Supabase service-role key in any public environment variable or browser code.

Successful login and logout boundaries emit only anonymous, property-free operational
event names. Their storage and privacy boundary is documented in
[`data-architecture.md`](data-architecture.md#operational-analytics).

## Supabase dashboard

In **Authentication → URL Configuration**:

- Site URL: `https://blendcalc.vercel.app`
- Redirect URL: `https://blendcalc.vercel.app/auth/callback`
- Redirect URL: `http://localhost:5173/auth/callback`
- Preview Redirect URL: `https://*-<vercel-account-slug>.vercel.app/auth/callback`

Keep exact callback URLs for production and localhost. Restrict the Preview wildcard to
this project's Vercel account suffix rather than allowing every `vercel.app` deployment.

In **Authentication → Sign In / Providers → Google**, use the Google client ID and
secret. In Google Cloud, configure:

- JavaScript origin: `http://localhost:5173`
- JavaScript origin: `https://blendcalc.vercel.app`
- Redirect URI: the Supabase callback displayed in the Google provider panel, such as
  `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

## Account security settings

The tracked Supabase configuration currently enforces:

- Email confirmation for password accounts.
- A minimum password length of **15 characters** so hosted Auth matches the
  application policy in `src/lib/utils/auth/passwordPolicy.ts`.
- No uppercase, lowercase, number, or symbol composition requirements. The app
  accepts long passphrases, spaces, Unicode, and password-manager values.
- Secure password changes. Recently authenticated users and password recovery
  sessions can update directly; older sessions must reauthenticate.
- Eight-character email OTPs with a one-minute resend interval.
- Optional TOTP enrollment and verification.

Before public launch, also:

- Enable leaked-password protection when the project plan supports it.
- Before enabling Cloudflare Turnstile or hCaptcha, add its browser widget and pass the
  resulting token to Supabase sign-up and recovery calls.
- Review Auth rate limits; lower them if automated abuse appears.
- Configure custom SMTP before depending on confirmation or recovery emails.
- Keep refresh-token reuse detection enabled.
- Review Auth audit logs after failed or suspicious sign-ins.

CAPTCHA requires dashboard secrets and a public site key, so it must not be enabled in
Supabase until those values and the token widget are configured.

## Database security

Every user-data table has RLS enabled and policies scoped to `(select auth.uid())`.
Anonymous table privileges are revoked by migration. Follow the database change and
verification workflow in [`database-testing.md`](database-testing.md) rather than
maintaining an authentication-specific migration sequence.

### Application role claims

Supabase's `anon`, `authenticated`, and `service_role` claims remain infrastructure
roles. blendCalc moderator, administrator, and developer access is instead assigned in
`app_role_assignments`. The Custom Access Token hook adds `user`, `moderator`, `admin`,
or `developer` to newly issued JWTs as the signed `app_role` claim.

The claim is a signed role hint for application and policy use; it is not the sole
authority for privileged work. Moderator routes, server actions, and privileged
database functions re-check the current assignment because an already-issued JWT can
outlive a role change until its next refresh. The hook always replaces a pre-existing
claim from the database and defaults unknown or malformed subjects to `user`.

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

## Verification

```bash
npm run check:auth
supabase config push
npm run check
npm test
npm run build
```

Manually verify both localhost and production:

1. Google sign-in returns to the same origin where it started.
2. Email sign-in, sign-out, confirmation, and password recovery work.
3. A second user cannot read or change the first user's rows.
4. Opening two tabs and clicking Google sign-in quickly does not create two submissions;
   the button should become disabled immediately.
5. Authenticated pages return `Cache-Control: private, no-store`.
6. New password accounts reject short, common, email-derived, and mismatched passwords
   with an actionable message.
7. An existing account with a legacy password can sign in, is immediately sent to
   `/auth/update-password`, and cannot continue until the update succeeds.
