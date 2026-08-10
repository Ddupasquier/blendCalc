# Profile

Route: `/profile`

Profile manages optional identity, display theme, avatar, food-preference, tutorial, and
session settings. Detailed privacy and storage rules live in
[User Profiles](../user-profiles.md).

## Settings Surfaces

- Keep the Profile route as a compact summary and settings menu rather than rendering
  every form at once.
- Open Light/Dark Mode at `/profile/appearance`, Profile details at `/profile/details`, and
  Profile image at `/profile/image` in the shared route-backed `BottomSheet`.
- Open Food preferences at `/profile/food-preferences` in the shared route-backed
  `RightSheet` because it is a long, independently scrollable settings workflow.
- Show the Moderator actions launcher only when the current server-verified role is
  moderator, administrator, or developer. Open it at
  `/profile/moderator-actions` in the shared route-backed `BottomSheet`.
- Each launcher summarizes the saved state without duplicating its complete form.
- The shared handle, intentional backdrop press, Escape, and browser history close a
  bottom sheet and return to `/profile` without reloading the underlying Profile page.
  Direct loading and refresh preserve the documented sheet route.
- Successful saves close the active settings surface once and update its summary.
  Validation failures stay visible in the open surface with the entered values intact.

## Identity

- Show and edit preferred display name and optional bio.
- Use a generated display name when the account has no chosen name.
- Do not require or expose the account email as a public identity.
- Show clear validation, pending, success, and failure states.

## Light/Dark Mode

- Offer Device, Light, and Dark choices through accessible selection controls.
- Preview changes immediately and save them explicitly to the account.
- `Device` follows operating-system changes while selected.
- Apply the saved theme before first paint to avoid a light/dark flash.
- Theme changes must not reload the route, close overlays, or reset forms.

## Avatar

- Accept JPEG, PNG, and WebP up to 5 MB through the shared photo input.
- Allow optional image description/alt text.
- Validate the file signature rather than trusting the browser MIME type.
- Keep image rules in a closed disclosure.
- Require confirmation that the image contains no explicit nudity, sexual content,
  graphic violence, or hate imagery.
- Require the optional face confirmation only when the current configuration enables
  it.
- Keep internal moderation-provider details out of user-facing copy.

## Food Preferences

Food preferences are optional and sensitive. Preserve:

- preferred units;
- default Mix serving size in a readable unit;
- allergens;
- dietary restrictions;
- prioritized nutrients;
- optional package-label region loaded from the active policy;
- acknowledgement and explicit save action;
- a clear summary of saved values.

A device locale may suggest a supported region only when it contains an explicit region
represented by the active policy. The suggestion is not stored until Save. Region adds
labeling context and never removes a personal warning.

Canonical choices resolve through DB-reviewed compatibility tags. Custom wording stays
saved exactly, but an unmatched or ambiguous value is clearly marked as waiting for
review and does not drive warnings or food ranking until a reviewed exact mapping exists.
Do not reintroduce general dislikes or ingredients-to-avoid without a separate product
decision.

Saved preferences drive search downranking, nutrition warnings, Fridge and Shopping
List warning edges, Mix warnings, and suggestion safety. Matching comes from reviewed
server policy and source evidence, not naive client text matching.

## Tutorial And Session

- Provide an action to replay the guided tutorial without changing the stored
  onboarding choice.
- Provide a clear Log out action.
- Submit logout through the server authentication endpoint so the Supabase session and
  password-upgrade state clear together.
- Logging out never deletes profile, food, list, recipe, or Mix data.

## Moderator Actions

- Treat Profile as a privileged navigation gateway, not as a second moderation
  implementation. Every destination retains its own server and database authorization.
- Show one aggregate red count on the Profile launcher only when one or more review
  items are waiting.
- Keep every supported moderator option visible in the sheet. Product submissions,
  food-warning reports, and profile-image review rows are disabled when their verified
  queue count is zero; a nonzero queue displays its own red count in the row's top-right
  corner.
- Keep standing tools such as Account access and Catalog data health enabled because
  they remain useful without a pending queue.
- If queue counts cannot be read, preserve unknown as unknown, disable queue actions,
  explain the temporary limitation with friendly copy, and leave standing tools
  available. Never present an unavailable count as zero.
