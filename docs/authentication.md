# Authentication and deployment checklist

The app uses Supabase Auth with server-side PKCE cookies. Authentication must
start and finish on the same origin. Hosted requests are canonicalized through
`PUBLIC_SITE_URL`; localhost remains local.

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
PUBLIC_SITE_URL=https://smoothie-mixer.vercel.app
```

Using the production origin for Preview intentionally sends authentication to
the canonical production deployment. Do not put a Supabase service-role key in
any public environment variable or browser code.

## Supabase dashboard

In **Authentication → URL Configuration**:

- Site URL: `https://smoothie-mixer.vercel.app`
- Redirect URL: `https://smoothie-mixer.vercel.app/auth/callback`
- Redirect URL: `http://localhost:5173/auth/callback`

Use exact callback URLs. Do not use a broad production wildcard.

In **Authentication → Sign In / Providers → Google**, use the Google client ID
and secret. In Google Cloud, configure:

- JavaScript origin: `http://localhost:5173`
- JavaScript origin: `https://smoothie-mixer.vercel.app`
- Redirect URI: the Supabase callback displayed in the Google provider panel,
  such as `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

## Account security settings

Configure these in Supabase before public launch:

- Require email confirmation for password accounts.
- Set the minimum password length to at least 8 characters.
- Enable leaked-password protection when the project plan supports it.
- Before enabling Cloudflare Turnstile or hCaptcha, add its browser widget and
  pass the resulting token to Supabase sign-up and recovery calls.
- Review Auth rate limits; lower them if automated abuse appears.
- Configure custom SMTP before depending on confirmation or recovery emails.
- Keep refresh-token reuse detection enabled.
- Review Auth audit logs after failed or suspicious sign-ins.

CAPTCHA requires dashboard secrets and a public site key, so it must not be
enabled in Supabase until those values and the token widget are configured.

## Database security

Every user-data table has RLS enabled and policies scoped to
`(select auth.uid())`. Anonymous table privileges are revoked by migration.

```bash
npm run db:push:dry
npm run db:push
npm run db:lint
npm run db:types
```

## Verification

```bash
npm run check:auth
npm run check
npm test
npm run build
```

Manually verify both localhost and production:

1. Google sign-in returns to the same origin where it started.
2. Email sign-in, sign-out, confirmation, and password recovery work.
3. A second user cannot read or change the first user's rows.
4. Opening two tabs and clicking Google sign-in quickly does not create two
   submissions; the button should become disabled immediately.
5. Authenticated pages return `Cache-Control: private, no-store`.
