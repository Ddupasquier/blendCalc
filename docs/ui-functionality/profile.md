# Profile

Route: `/profile`

Profile manages optional identity, display theme, avatar, food-preference, tutorial, and
session settings. Detailed privacy and storage rules live in
[User Profiles](../user-profiles.md).

## Settings Surfaces

- Keep the Profile route as a compact summary and settings menu rather than rendering
  every form at once.
- On compact phones and short screens, only the main Profile scroll surface controls
  header retraction. Downward scrolling hides the title and supporting copy; a short
  upward scroll reveals them before the page reaches the top. Scrolling inside a
  bottom sheet or right sheet never changes the Profile header. Wider layouts keep the
  header visible, and reduced motion removes the transition without changing the
  visibility state.
- Open Light/Dark Mode at `/profile/appearance`, Cheeky messages at
  `/profile/cheeky-messages`, Profile details at `/profile/details`, and Profile image
  at `/profile/image` in the shared route-backed `BottomSheet`.
- Let each bottom-sheet title own the visible heading. Keep control-level semantic
  labels available to assistive technology without repeating the same visible wording
  inside the sheet.
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

## Cheeky Messages

- Keep the setting off until the account explicitly enables and saves it.
- Summarize the current state as `On` or `Off` in the Profile settings menu.
- Explain the tone as occasional PG-13 food humor, not adult content.
- State the safety exclusions in the setting itself. Never place cheeky copy near
  allergens, recalls, alcohol safety, medical guidance, authentication, validation,
  errors, body weight, or anything involving minors.
- Use the shared toggle, bottom sheet, status message, and submit-button primitives.

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

Present package-label region, measurements, allergens, dietary restrictions, and
nutrient priorities as separate shared disclosures. Each disclosure keeps its form state
mounted while closed and summarizes its current saved or edited state in the header
without repeating a separate full-page saved-values panel. Keep the privacy
acknowledgement visible as a compact footer above the save action rather than hiding it
in a disclosure. Validation failures open every configurable preference disclosure so
the entered values and required correction remain reachable. Long DB-provided allergen
and dietary lists include an in-section filter. Filtering changes only what is visible
and never removes a selected value.

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
- Log out only the current browser session; other signed-in devices remain active.
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
- Show one crown beside the Moderator actions sheet title. The action region retains its
  accessible group name without repeating `Moderator actions` as a second visible
  heading.
- Before identity verification, keep review counts private but leave the protected
  review rows available as entry points into the authenticator flow. Explain that
  verification is required instead of making the actions look permanently unavailable.
- Keep standing tools such as Account access and Catalog data health enabled because
  they remain useful without a pending queue.
- If queue counts cannot be read, preserve unknown as unknown, disable queue actions,
  explain the temporary limitation with friendly copy, and leave standing tools
  available. Never present an unavailable count as zero.
