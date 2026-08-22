# Moderation

Routes: the Profile gateway at `/profile/moderator-actions`, focused moderator views
under `/profile/moderator-actions/*`, and the legacy compatibility routes
`/moderation` and `/moderation/data-health`.

Only authorized moderators, administrators, and developers may enter these views. Role,
account-control, and notification rules live in [Moderation](../moderation.md).

The elevated-role-only Profile launcher opens one compact bottom sheet containing every
current moderation destination. Each destination opens a route-backed right sheet with
one focused responsibility: product submissions, food-warning reports, profile images,
account access, or catalog data health. The focused route retains its own server and
database authorization, evidence, mutations, browser title, history entry, and direct-
load behavior. Queue rows remain visible and disabled at zero; standing account and
data-health tools remain available. The bottom-sheet title and each right-sheet heading
own one crown without repeating the same visible label inside their content.

## Account Review

- Show the viewer's current role.
- Search accounts by preferred/display name, email, user ID, role, or status.
- Account cards show avatar or placeholder, display name, moderator-only email, status,
  role, image-review status, public block reason, cumulative moderator-rejected public
  submission count, and any active public-sharing suspension date.
- Prevent self-moderation.
- Prevent moderators from acting on privileged accounts.
- Keep administrators and developers protected from the web blocking flow.
- Require a public reason when blocking and support restoring access.
- Send the bounded block notification without exposing internal notes.

## Catalog Submission Review

- Show product name, brand, barcode, source match, evidence completeness, conflict
  count, lookup failures, review flags, private evidence images, and nutrition details.
- Keep one clear Approve action and one Reject action that requires a note.
- Preserve deterministic QA-fixture behavior in the disposable local environment.
- The 51st moderator rejection pauses public catalog sharing for six calendar months.
  Automated declines do not count, and private food tracking remains available.

## Data Health

`/profile/moderator-actions/catalog-data-health` starts with bounded overview counts.
The legacy `/moderation/data-health` route remains a compatibility entry point. Keep source activity,
dataset/licence state, food-warning policy coverage, conflicts, API publication gaps,
nutrient mapping review, and revision gaps in closed shared disclosures. Product issues
link to their existing provenance review.

This view is read-oriented. Existing submission and warning queues remain the mutation
paths. Never render raw provider payloads, private evidence paths, user identity beyond
the authorized account workflow, reviewer identity, or secrets.
