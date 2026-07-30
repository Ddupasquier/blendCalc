# Moderation and account access

This document owns privileged role, account-control, notification, and review
workflows. Profile upload behavior belongs in
[`user-profiles.md`](user-profiles.md), catalog intake in
[`shared-product-catalog.md`](shared-product-catalog.md), and database objects in
[`supabase-schema.md`](supabase-schema.md).

## Security model

- Normal users have no row in `app_role_assignments`.
- `moderator` can block and restore normal user accounts.
- `admin` can block normal users and moderators. Admin accounts cannot be blocked
  through the web moderation page.
- Authenticated browser clients can read only their own role and moderation status. They
  cannot grant roles, block users, edit audit history, or edit the signup blocklist.
- The `/moderation` route verifies the signed-in user's database role before creating a
  server-only Supabase admin client.
- `SUPABASE_SERVICE_ROLE_KEY` must exist only in server environments. Never prefix it
  with `PUBLIC_` or import it into a client component.

## Apply and configure

Apply moderation migrations and regenerate database types through the shared database
change workflow in [`database-testing.md`](database-testing.md) and
[`supabase-schema.md`](supabase-schema.md#update-checklist). This document adds only the
moderation-specific environment and dashboard configuration below.

Add `SUPABASE_SERVICE_ROLE_KEY` to the Vercel project as a sensitive **Production-only**
environment variable, then redeploy. Do not expose this key to arbitrary preview
branches; preview code can change before review and the service role bypasses RLS.

## Block notification emails

Blocking through `/moderation` sends the affected user a transactional email that
includes the selected public reason. The message never includes internal moderator
notes.

The implementation uses Resend from server code. Before enabling it:

1. Create a Resend account and API key.
2. Add and verify a sending domain. Prefer a dedicated subdomain such as
   `updates.example.com` so transactional mail has an isolated sending reputation.
3. Add these sensitive Production environment variables in Vercel and redeploy:

```dotenv
RESEND_API_KEY=re_...
MODERATION_EMAIL_FROM="blendCalc <moderation@updates.example.com>"
MODERATION_SUPPORT_EMAIL=support@example.com
```

`MODERATION_SUPPORT_EMAIL` is optional. When present, it is used as the reply-to address
and is named in the appeal instructions. `RESEND_API_KEY` and `MODERATION_EMAIL_FROM`
are required for delivery and must never use a `PUBLIC_` prefix.

Each attempt is appended to `moderation_email_deliveries` using only a SHA-256 hash of
the recipient address. Provider message IDs and failures are retained for operational
review. The email request uses the moderation action ID as an idempotency key.

An email outage does not reverse an account block. The moderation page instead reports a
warning, and the failed attempt remains in the delivery ledger for review. Apply
`20260614040000_moderation_email_deliveries.sql` before deploying the email-enabled
application code.

For local moderation commands and database pushes, create an ignored
`.env.moderation.local`:

```dotenv
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PROJECT_ID=YOUR_PROJECT_REF
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
SUPABASE_DB_PASSWORD=YOUR_REMOTE_POSTGRES_DATABASE_PASSWORD
```

Start from the tracked template:

```sh
cp .env.moderation.example .env.moderation.local
```

`SUPABASE_DB_PASSWORD` is the remote Postgres database password used by
`npm run db:push:auto`. It is not your Supabase dashboard login password and not an API
key. If you do not know it, reset it in Supabase’s Database settings, then paste the new
value into `.env.moderation.local`.

Bootstrap the first admin from the terminal:

```sh
npm run moderate -- role your-email@example.com admin
```

Other role commands:

```sh
npm run moderate -- role moderator@example.com moderator
npm run moderate -- role moderator@example.com none
```

## Blocking and restoring accounts

Use `/moderation` while signed in as a moderator/admin, or use the emergency CLI:

```sh
npm run moderate -- ban user@example.com profile_image_policy_violation
npm run moderate -- unban user@example.com moderator_reversal
```

A block performs four separate operations:

1. Supabase Auth receives a long-duration account ban.
2. `account_moderation` blocks existing sessions on their next app request.
3. The normalized email hash is added to `blocked_signup_emails` for future signup
   rejection.
4. A reason-specific account-blocked email is sent and recorded in
   `moderation_email_deliveries`.

Every action is appended to `moderation_actions`. Do not delete moderation evidence as
part of normal operations.

## Compatibility warning reports

Signed-in users can report a food compatibility warning when the match appears
incorrect, relies on outdated source data, or uses the wrong evidence type. The report
stores the product identity, warning code and parameters, exact matching compatibility
facts, and active policy version. Repeated reports of the same warning remain
idempotent while one is pending.

The `/moderation` warning-report queue is restricted to moderators and administrators.
Reviewers must:

1. Compare the reported warning with its preserved evidence and policy version.
2. Mark the report `confirmed` when corrective work is needed, or `dismissed` when the
   warning is supported.
3. Record the next action as rule review, source correction, product correction, or
   duplicate.
4. Leave a concise internal note explaining the decision.

Resolving feedback does not silently edit a product or compatibility rule. Confirmed
reports create a traceable correction decision; any resulting product or policy change
uses its own reviewed workflow and, for policy changes, a new compatibility policy
version.

## Enable future-signup blocking

The migration creates `public.reject_blocked_signup(event jsonb)`, but Supabase must be
told to use it:

1. Open Supabase Dashboard → Authentication → Hooks.
2. Enable **Before User Created**.
3. Choose the Postgres function `public.reject_blocked_signup`.
4. Save and test with a disposable blocked account.

Without this hook, existing-account bans still work, but a user could register a new
account using the same email after the original account is removed.

## Profile image moderation

Profile uploads retain immutable policy-acceptance evidence, but that self-attestation
does not replace moderation. The upload, storage, replacement, and consent contract is
maintained in [`user-profiles.md`](user-profiles.md).

## IP addresses

Do not use a permanent application-level IP ban as the primary identity block. Home and
mobile IPs rotate, VPNs bypass them, and shared networks can cause unrelated people to
be blocked.

For active abuse:

1. Identify the source IP using Supabase Auth audit logs and Vercel request logs.
2. Add a temporary Vercel Firewall rule for the exact IP or narrow network.
3. Set an expiration/review date and document the related moderation action.
4. Keep the account ID and email block as the durable controls.

Profile images remain private and the application does not currently run an automated
image-classification service. Before avatars become publicly visible, keep uploads
pending, scan them through a server-side moderation provider, and expose only approved
images.
