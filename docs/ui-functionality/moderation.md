# Moderation

Routes: `/moderation` and `/moderation/data-health`

Only authorized moderators, administrators, and developers may enter these views. Role,
account-control, and notification rules live in [Moderation](../moderation.md).

## Account Review

- Show the viewer's current role.
- Search accounts by preferred/display name, email, user ID, role, or status.
- Account cards show avatar or placeholder, display name, moderator-only email, status,
  role, image-review status, and public block reason.
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
- Repeated rejected submissions may pause catalog sharing under the current catalog
  policy without blocking private food tracking.

## Data Health

`/moderation/data-health` starts with bounded overview counts. Keep source activity,
dataset/licence state, food-warning policy coverage, conflicts, API publication gaps,
nutrient mapping review, and revision gaps in closed shared disclosures. Product issues
link to their existing provenance review.

This view is read-oriented. Existing submission and warning queues remain the mutation
paths. Never render raw provider payloads, private evidence paths, user identity beyond
the authorized account workflow, reviewer identity, or secrets.
