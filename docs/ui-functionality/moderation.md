# Moderation

Routes: the Profile gateway at `/profile/privileged-tools`, focused privileged views
under `/profile/privileged-tools/*`, and the legacy compatibility routes
`/moderation` and `/moderation/data-health`.

Only authorized moderators, administrators, and developers may enter these views. Role,
account-control, and notification rules live in [Moderation](../moderation.md).

The elevated-role-only Profile launcher uses the verified role title and opens one
compact bottom sheet containing only destinations granted by that role's current
`app_role_permissions` rows. Each destination opens a route-backed right sheet with
one focused responsibility: product submissions, food-warning reports, profile images,
account access, catalog review work, or data operations. Review work and data operations
appear under separate headings and only when the current database permission grants
them. The focused route retains its own server and
database authorization, evidence, mutations, browser title, history entry, and direct-
load behavior. Queue rows remain visible and disabled at zero; standing account,
catalog-review, and permitted data-operation tools remain available. The bottom-sheet title and each right-sheet heading
own one crown without repeating the same visible label inside their content.

Every focused right sheet follows the same reading order: the plain-language view
heading, current action feedback, one bounded result summary, review records, supporting
evidence in closed shared disclosures, and the decision controls last. An adjacent
information button opens the shared contextual bottom sheet for that exact tool. It
explains the tool's purpose, review order, decision effect, and safety boundary without
adding permanent instructions to every record. The information sheet is contextual help,
not a second moderation workflow, and never exposes private evidence or internal codes.

Product, warning, and reported-image queues use the shared moderator review-list and
review-card structure. Keep identity and the decision-relevant status in the card header,
keep a short fact summary in the primary reading path, and move package photos, raw
matching facts, long change lists, nutrient values, and report details into clearly named
shared disclosures. Decisions remain outside those disclosures so reviewers can find the
required action after reading the evidence.

## Account Review

- Show the viewer's current role.
- Search accounts by preferred/display name, email, user ID, role, or status.
- Keep each account closed by default. Its summary shows only the display name and
  current access status so moderators can scan the result list without reading every
  account field.
- Opening an account reveals its avatar when available, moderator-only email, role,
  image status, public block reason, cumulative moderator-rejected public submission
  count, and any active public-sharing suspension date.
- Keep the block form in a closed `Access controls` disclosure inside the opened account. Show
  `Restore access` directly only when the account is already blocked.
- Prevent self-moderation.
- Prevent moderators from acting on privileged accounts.
- Keep administrators and developers protected from the web blocking flow.
- Require a public reason when blocking and support restoring access.
- Send the bounded block notification without exposing internal notes.

## Catalog Submission Review

- Show product name, brand, barcode, source match, evidence completeness, conflict
  count, lookup failures, review flags, private evidence images, and nutrition details.
- Keep package photos, proposed changes, card-image placement, and full nutrition values
  in separate closed disclosures. Missing evidence and validation flags remain visible
  before the decision area.
- Keep one clear Approve action and one Reject action that requires a note.
- Preserve deterministic QA-fixture behavior in the disposable local environment.
- The 51st moderator rejection pauses public catalog sharing for six calendar months.
  Automated declines do not count, and private food tracking remains available.

## Profile Image Report Review

- Ordinary self-attested profile-image uploads are published without entering this
  queue.
- Show only exact current images with one or more pending user reports. Group multiple
  reports about the same image into one review card without exposing reporter identity.
- Keep the reported image visible while review is pending. A single report never hides
  or rejects an image automatically.
- Explain each report reason in plain language and preserve optional report details and
  dates as private moderation evidence.
- Keep the exact reported image visible while report reasons stay in one closed Report
  details disclosure.
- Require one explicit `Keep image` or `Remove image` decision and a review note.
- `Keep image` dismisses every pending report for that exact image. `Remove image`
  clears only that exact current image and closes its reports. If the user already
  replaced the image, close the stale reports without affecting the replacement.
- User-facing report intake is deferred until a social surface intentionally displays
  another user's profile image.

## Catalog Review And Data Operations

`/profile/privileged-tools/catalog-review-work` contains possible recall matches,
provider changes, and material product conflicts. These are review decisions, not data
health metrics. Keep each queue in a closed shared disclosure and route product-specific
evidence to a path-backed product view.

`/profile/privileged-tools/data-operations` starts with a compact operational summary.
Keep automated monitoring, source activity, dataset/licence state, food-warning policy
coverage, API publication gaps, nutrient mapping gaps, and revision gaps in closed
shared disclosures. Do not render product submissions, warning reports, provider-change
decisions, recall decisions, or catalog-conflict decisions in this workspace.

The legacy `/moderation/data-health` route redirects to the Profile privileged-tools
gateway. `/profile/privileged-tools/catalog-data-health` redirects to data operations
during rollout and owns no data or mutation logic.

Source activity uses the database-recorded lookup count for the selected bounded metric
window and lists the most-used source first. Equal lookup counts fall back to source name
so refreshes remain stable. API requests, cache hits, matches, errors, and response time
remain supporting metrics and do not silently alter the usage ranking.

Data operations remains read-oriented until a separately reviewed repair flow is
available. Review work owns only its explicit decisions. Never render raw provider
payloads, private evidence paths, user identity beyond the authorized account workflow,
reviewer identity, or secrets.
