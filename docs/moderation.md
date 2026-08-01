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

## Food warning reports

Signed-in users can report a food compatibility warning when the match appears
incorrect, relies on outdated source data, or uses the wrong evidence type. They can
also report that a warning is missing for one exact reviewed preference currently
active on their account. Reports preserve the active policy, exact product identity,
current catalog revision when available, package-observation date, bounded explanation,
and optional normalized private label photo. Repeated reports of the same product,
policy, preference, or warning remain idempotent while one is pending.

The `/moderation` warning-report queue is restricted to moderators and administrators.
Reviewers must:

1. Compare the report with its preserved evidence, source observations, policy version,
   and catalog revision.
2. Mark the report `confirmed` when corrective work is needed, or `dismissed` when the
   warning is supported.
3. Record the next action as rule review, source correction, product correction, or
   duplicate.
4. Leave a concise internal note explaining the decision.

Resolving feedback does not silently edit a product or compatibility rule. Confirmed
reports create a traceable correction decision; any resulting product or policy change
uses its own reviewed workflow and, for policy changes, a new compatibility policy
version. Private package evidence is viewed through short-lived signed URLs and never
enters public catalog or API responses.

## Custom food preference mapping requests

Custom allergen and dietary text without one exact reviewed match enters
`food_preference_mapping_requests`. The shared queue contains normalized text, rule
type, language, status, and occurrence metadata; it does not contain a user identifier
or copy raw account wording.

Reviewers must:

1. Confirm that the request describes a real allergen or dietary concept rather than
   assuming similar spelling means equivalent meaning.
2. Create or select a reviewed canonical ingredient term and language-tagged alias with
   retained source evidence.
3. Add its preference-tag mapping to a draft compatibility policy with a source
   reference and review time.
4. Activate the complete policy through the standard policy workflow. Activation
   automatically re-resolves existing saved preferences without rewriting them.

Reject requests that cannot be mapped safely. Never edit an active mapping in place or
create a client-side synonym to bypass review.

## Nutrient mapping and uncertainty review

The moderator-only product provenance read contains every accepted normalized nutrient
and the retained source nutrient review trail. Reviewers can compare the normalized
amount with its source value status, source-reported standard error, source nutrient
key/code, mapping status and method, mapping review reference, derivation method, and
exact observation. Trace, present-but-unquantified, missing, invalid, and unmapped facts
remain review evidence rather than numeric values.

This endpoint is role-gated and non-cacheable. Mapping review references and retained
source-review rows never enter ordinary product pages or the public API. A reviewer must
correct an inaccurate mapping through the reviewed mapping workflow; the moderation
read itself cannot rewrite nutrient math or silently approve a source row.

## Product correction reports

Explicit product-correction reports are identified separately from ordinary catalog
updates. Reviewers compare the submitted package evidence with the active product and
the exact base revision.

Approval merges only the reviewed changed fields, preserves unsubmitted canonical data
and provenance, and appends the normal immutable revision. If the active product changed
while the report waited, approval stops as stale and the report must be compared again.

## Catalog data health

`/moderation/data-health` is a moderator/admin-only catalog health summary. Its server
load calls `get_moderator_data_health` through the signed-in user's Supabase client, and
the database function independently verifies the caller's role. The browser receives
only bounded aggregates and issue summaries; it never receives raw provider payloads,
private evidence, user identifiers, secrets, source-evaluation details, dataset import
metadata, or download URLs.

The dashboard includes:

- active and API-publication-ready product counts;
- pending catalog submissions, food-warning reports, and preference mappings;
- unresolved catalog conflicts, revision-history gaps, and nutrient-mapping review
  gaps;
- source request, cache, reliability, match, response-time, and field-coverage counts
  for a bounded 30-day window;
- dataset import counts, checksum state, licence review state, and policy gaps; and
- active food-compatibility policy coverage.

Issue queues are bounded to 20 rows in the application and the RPC enforces a maximum
of 50. Product issues link to the existing moderator provenance read, while pending
submissions and warning reports link to their established reviewed queues. Mapping,
dataset, and policy corrections remain deliberate reviewed database/policy workflows;
the health dashboard must not become an unreviewed direct-edit surface.

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
