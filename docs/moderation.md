# Moderation And Account Access

This document owns privileged role, account-control, notification, and review
workflows. Profile upload behavior belongs in
[`user-profiles.md`](user-profiles.md), catalog intake in
[`shared-product-catalog.md`](shared-product-catalog.md), and database objects in
[`supabase-schema.md`](supabase-schema.md).

## Guide Navigation

| Area | Sections |
| --- | --- |
| Access and setup | [Security model](#security-model) and [apply and configure](#apply-and-configure) |
| Account actions | [Notification emails](#block-notification-emails), [blocking and restoring](#blocking-and-restoring-accounts), and [future-signup blocking](#enable-future-signup-blocking) |
| Data review | [Food warnings](#food-warning-reports), [preference mappings](#custom-food-preference-mapping-requests), [nutrient mappings](#nutrient-mapping-and-uncertainty-review), [product corrections](#product-correction-reports), and [catalog review and operations](#catalog-review-and-data-operations) |
| Media and privacy | [Profile image moderation](#profile-image-moderation) and [IP addresses](#ip-addresses) |

## Security Model

- Normal users have no row in `app_role_assignments`.
- `moderator` can block and restore normal user accounts.
- `admin` can block normal users and moderators. Admin accounts cannot be blocked
  through the web moderation page.
- `developer` is a protected operational role with the current admin capability set.
  Its capabilities are explicit permission rows rather than inherited from `admin`.
  Developer accounts cannot be blocked through the web moderation page.
- Supabase Auth copies the database assignment into newly issued access tokens as the
  `app_role` claim, defaulting normal users to `user`. It does not replace the database
  assignment or Supabase's infrastructure `authenticated` role.
- Authenticated browser clients can read only their own role and moderation status. They
  cannot grant roles, block users, edit audit history, or edit the signup blocklist.
- The `/moderation` route and every privileged server/database boundary verify the
  signed-in user's current database role before using server-only capabilities. They do
  not authorize from the JWT claim alone because claims remain valid until token
  refresh.
- Those same boundaries require a current `aal2` session. Elevated users without a
  verified TOTP factor are sent through enrollment; enrolled users complete an
  authenticator challenge before protected pages or actions become available.
- `SUPABASE_SERVICE_ROLE_KEY` must exist only in server environments. Never prefix it
  with `PUBLIC_` or import it into a client component.

## Apply And Configure

Apply moderation migrations and regenerate database types through the shared database
change workflow in [`database-testing.md`](database-testing.md) and
[`supabase-schema.md`](supabase-schema.md#update-checklist). This document adds only the
moderation-specific environment and dashboard configuration below.

`supabase/config.toml` enables `public.custom_access_token_hook` and
`public.reject_blocked_signup` for local Auth. After the database migration is deployed,
run `supabase config push` to apply the same hooks and tracked callback allowlist to the
linked project. Do not use a custom PostgreSQL login role, overwrite the required JWT
`role` claim, or store privileged app-role status in editable user metadata.

`app_role_permissions` owns capability mapping. Moderators receive account, catalog,
and warning-review permissions. Admins and developers receive those capabilities plus
role management and explicit data-operations permissions. The old
`moderation.data_health.read` capability remains only as a temporary rollout boundary;
new application code does not use it.
The `authorize_app_permission` helper is suitable for RLS policy checks and requires
both an allowed signed `app_role` and the JWT `aal2` claim. Sensitive server actions
continue to re-read `app_role_assignments` so revocations apply without waiting for JWT
expiry.

| Capability | User | Moderator | Admin | Developer |
| --- | --- | --- | --- | --- |
| Access moderation | No | Yes | Yes | Yes |
| Manage eligible accounts | No | Yes | Yes | Yes |
| Review catalog submissions | No | Yes | Yes | Yes |
| Review food warnings | No | Yes | Yes | Yes |
| Resolve catalog review work | No | Yes | Yes | Yes |
| Read catalog data operations | No | No | Yes | Yes |
| Run reviewed catalog repairs | No | No | Yes | Yes |
| Grant or revoke application roles | No | No | Yes | Yes |

The table describes authorization policy, not UI availability or target eligibility.
Role changes currently use the trusted operator CLI; any future web control must require
the admin capability at its live server boundary. Separate moderation rules still
prevent self-actions, prevent moderators from acting on elevated users, and prevent the
web workflow from blocking administrators or developers.

## Review Interface

Profile links elevated users to the focused right sheets allowed by their current
database permission rows. **Review work** includes product submissions, catalog
conflicts/provider changes/possible recalls, food-warning reports, reported profile
images, and account access. **Data operations** includes source, dataset, publication,
mapping, revision, and automated-monitoring health for administrators and developers.
Each sheet
uses the same review order: concise queue or result status, record identity and key facts,
closed supporting-evidence disclosures, then the decision controls. One shared
information action explains the purpose, review steps, effect, and guardrail for the
current tool without mixing instructions into every record.

Product submissions, food-warning reports, and reported profile images share the same
review-list and card shells. Account access remains search-led and keeps account evidence
plus destructive controls behind deliberate disclosures. Catalog review work contains
only decisions a reviewer can make. Data operations keeps its bounded operational
sections collapsed until requested and never duplicates review queues. The
visual consistency never replaces each route's independent server, database, AAL2, and
permission checks.

Add `SUPABASE_SERVICE_ROLE_KEY` to the Vercel project as a sensitive **Production-only**
environment variable, then redeploy. Do not expose this key to arbitrary preview
branches; preview code can change before review and the service role bypasses RLS.

## Block Notification Emails

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
npm run moderate -- role developer@example.com developer --user-id=<expected-user-uuid>
npm run moderate -- role moderator@example.com none
```

Role assignment and removal call the service-only `set_app_user_role` function, which
changes the authoritative row and appends the moderation action in one transaction.
Direct service-role writes to `app_role_assignments` are revoked. Newly issued tokens
reflect the change through the Auth hook; privileged requests enforce the database
change immediately.

## Blocking And Restoring Accounts

Use `/moderation` while signed in with a moderator, admin, or developer role, or use the
emergency CLI:

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

## Food Warning Reports

Signed-in users can report a food compatibility warning when the match appears
incorrect, relies on outdated source data, or uses the wrong evidence type. They can
also report that a warning is missing for one exact reviewed preference currently
active on their account. Reports preserve the active policy, exact product identity,
current catalog revision when available, package-observation date, bounded explanation,
and optional normalized private label photo. Repeated reports of the same product,
policy, preference, or warning remain idempotent while one is pending.

The `/moderation` warning-report queue is restricted to moderators, administrators, and
developers.
Reviewers must:

1. Compare the report with its preserved evidence, source observations, policy version,
   and catalog revision.
2. Mark the report `confirmed` when corrective work is needed, or `dismissed` when the
   warning is supported.
3. Record the next action as rule review, source correction, product correction, or
   duplicate.
4. Leave a concise internal note explaining the decision.

Resolving feedback does not silently edit a product or compatibility rule. Confirmed
reports create a traceable follow-up owned by the appropriate workflow:

- `product_correction` preserves the exact product, current revision, affected field
  families, and current food snapshot as a correction origin. A later evidence-backed
  catalog-correction submission links automatically when its actual changed fields
  overlap the origin. The report is completed only when that submission creates an
  approved immutable revision.
- `rule_review` opens a food-policy review case. Any rule change still requires a new
  immutable compatibility policy version.
- `source_correction` opens a data-operations case tied to the reported source context.

The follow-up list remains separate from pending reports so a reviewer can distinguish
the decision already made from the corrective work still owed. A dismissed report can
never create correction work. Rejected or automatically declined product corrections
release their linked origins for another evidence-backed correction instead of losing
the report. Private package evidence is viewed through short-lived signed URLs and never
enters public catalog or API responses.

## Custom Food Preference Mapping Requests

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

## Nutrient Mapping And Uncertainty Review

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

## Product Correction Reports

Explicit product-correction reports are identified separately from ordinary catalog
updates. Reviewers compare the submitted package evidence with the active product and
the exact base revision.

Approval merges only the reviewed changed fields, preserves unsubmitted canonical data
and provenance, and appends the normal immutable revision. If the active product changed
while the report waited, approval stops as stale and the report must be compared again.

## API Publication Concerns And Holds

`POST /api/publication-concerns` is the shared intake for provider, brand, user,
rights-holder, attribution, privacy, source-retirement, and other public-data concerns.
It supplements rather than replaces product corrections: a changed label still enters
the immutable product-update workflow, while a concern records why public output may
need correction or temporary removal.

Moderators, administrators, and developers with AAL2 can read unresolved concerns from
`GET /api/moderation/publication-concerns`. They may link a concern to an ordinary
product/image correction, correct reviewed source policy, place a reversible hold on
the exact subject, dismiss it with evidence, or resolve it when corrective work is
complete.

A hold must include safe public wording and a private internal reason. Product holds
block the existing publication-readiness gate, source/dataset holds block attributed
fields, and image holds remove only the held asset from API output. Releasing a hold
records who released it and why; neither action deletes canonical rows, observations,
revisions, assets, or evidence. Use `npm run api:publication -- ...` when a rapid
operator action is needed before a dedicated moderation surface is available.

## Repeated Catalog Rejections

Every transition to the moderator-owned `rejected` submission status atomically
increments `user_catalog_submission_enforcement.moderator_rejection_count`. Historical
`auto_declined` validation outcomes and other deterministic machine rejections never
increase this count. Material same-GTIN changes with complete current-package evidence
now enter correction review rather than being dismissed because their values differ.

The 51st moderator rejection suspends new public catalog submissions for six calendar
months. The user may continue saving private foods, using Ingredients, building Mixes,
and managing Saved Recipes. If another moderator rejection occurs after the suspension
expires, a new six-month suspension begins.

`user_catalog_submission_enforcement` owns current count and suspension state.
`product_submission_blocks` remains append-only suspension history. The account-review
card on `/moderation` displays the cumulative count and active suspension end date so a
reviewer can understand the account's catalog-sharing history without exposing those
details to other users.

## Catalog Review And Data Operations

`/profile/privileged-tools/catalog-review-work` is the catalog-review workspace for
moderators, administrators, and developers. It contains only evidence-backed decisions:
open material conflicts, provider changes, and possible official recall matches.
`get_catalog_review_work_summary` requires current `moderation.catalog.review`
permission and AAL2, and it returns only those bounded review queues.

`/profile/privileged-tools/data-operations` is the operational workspace for
administrators and developers. It contains blendCalc/API readiness counts, automated
monitor state and runs, source activity, dataset import/licence state, warning-policy
coverage, publication gaps, nutrient-mapping gaps, and revision-history gaps.
`get_catalog_data_operations_health` and
`get_catalog_data_operations_monitor_summary` require current
`data_operations.catalog_health.read` permission and AAL2. Moderators cannot enter this
workspace merely because they can review catalog products.

Both workspaces are bounded to 20 issue rows in the application and database. They do
not expose raw provider payloads, private evidence paths, user identifiers, secrets,
download URLs, or internal source-evaluation details. Shared private builders assemble
the bounded data, while each public RPC independently enforces its exact permission;
one workspace never relies on the other's permission.

Product links in both workspaces open the same bounded readiness passport through
different permission-checked routes. The passport separates shared-catalog availability
from API v1 publication, identifies the current revision, summarizes source-backed
nutrition and serving coverage, and routes every open issue to its responsible work
group and supported next step. Reviewers use
`/profile/privileged-tools/catalog-review-work/products/[productId]`; administrators and
developers use `/profile/privileged-tools/data-operations/products/[productId]`.
`get_catalog_product_readiness_passport` enforces either exact AAL2 permission before
returning normalized counts and statuses. It never returns raw provider payloads,
private evidence paths, or contributor identity.

Catalog-review decisions follow the same rule. Dismissing a provider change records that
the current canonical revision remains authoritative. Accepting a correct provider
change requires completing the existing product-correction workflow and linking the
new approved catalog revision; a monitor result cannot overwrite a canonical product.
`catalog_correction_origins` applies the same origin-to-revision contract to provider
changes, open field conflicts, and confirmed food-warning reports. A real correction
submission links automatically by exact product, base revision, and overlapping changed
fields. Approval then resolves all linked origins atomically; it never fabricates a
change summary or treats an unchanged product snapshot as corrective evidence.
Probable recall matches can be confirmed or dismissed only by an elevated AAL2 session.
Exact GTIN matches are visible immediately, while title-only similarity never enters
the queue.

Profile is the privileged navigation gateway. `/profile/privileged-tools` opens the
role-aware permitted tool list, while the following direct routes own focused right sheets:

- `/profile/privileged-tools/product-submissions`;
- `/profile/privileged-tools/food-warning-reports`;
- `/profile/privileged-tools/profile-images`;
- `/profile/privileged-tools/account-access`; and
- `/profile/privileged-tools/catalog-review-work`; and
- `/profile/privileged-tools/data-operations`.

Every direct route repeats the current role, exact database-owned permission, and AAL2
checks on the server. Legacy
`/moderation` routes remain compatibility entry points while links and Profile flows use
the focused routes. `/profile/privileged-tools/catalog-data-health` redirects to the new
data-operations route during rollout and owns no business logic.

## Enable Future-Signup Blocking

The migration creates `public.reject_blocked_signup(event jsonb)`, but Supabase must be
told to use it:

1. Open Supabase Dashboard → Authentication → Hooks.
2. Enable **Before User Created**.
3. Choose the Postgres function `public.reject_blocked_signup`.
4. Save and test with a disposable blocked account.

Without this hook, existing-account bans still work, but a user could register a new
account using the same email after the original account is removed.

## Profile Image Moderation

Profile uploads retain immutable policy-acceptance evidence and become usable without a
default moderator review. Ordinary uploads therefore do not increase the Profile images
queue count.

`profile_image_reports` stores reports against an exact current private Storage path.
Only trusted server workflows may create, read, or review those reports. The focused
moderator queue groups multiple pending reports about the same image into one action.
The image remains visible while review is pending; a report alone cannot censor an
account. Dismissing a report keeps the image. Removing it clears only the exact reported
current image, preserves the report history, and does not block the account. Replacing
an image supersedes pending reports about the old path.

User-facing report intake belongs to the future social surface that exposes another
user's profile image. The upload, storage, replacement, consent, and future reporting
contract is maintained in [`user-profiles.md`](user-profiles.md).

## IP Addresses

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
