# Moderation

Routes: `/moderation`, `/moderation/data-health`, and the Profile gateway at
`/profile/moderator-actions`

Only authorized moderators, administrators, and developers may enter these views. Role,
account-control, and notification rules live in [Moderation](../moderation.md).

The elevated-role-only Profile launcher opens one shared bottom sheet containing every
current moderation destination. It may summarize pending queues, but it never replaces
the authorization, evidence, or mutation rules of the destination route. Queue rows
remain visible and disabled at zero; standing account and data-health tools remain
available. The sheet title is the single visible `Moderator actions` heading and owns
the single crown; the enclosed action region keeps the same accessible name without a
second visible label.

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

`/moderation/data-health` starts with bounded overview counts. Keep source activity,
dataset/licence state, food-warning policy coverage, conflicts, API publication gaps,
nutrient mapping review, and revision gaps in closed shared disclosures. Product issues
link to their existing provenance review.

This view is read-oriented. Existing submission and warning queues remain the mutation
paths. Never render raw provider payloads, private evidence paths, user identity beyond
the authorized account workflow, reviewer identity, or secrets.
