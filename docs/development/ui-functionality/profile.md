# Profile

Route: `/profile`

Profile manages optional identity, display theme, avatar, food-preference, tutorial, and
session settings. Detailed privacy and storage rules live in
[User Profiles](../user-profiles.md).

## Quick Navigation

| Area                         | Sections                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile navigation           | [Settings Surfaces](#settings-surfaces)                                                                                                                          |
| Personal settings            | [Identity](#identity), [Light/Dark Mode](#lightdark-mode), [Playful Messages](#playful-messages), [Email Preferences](#email-preferences), and [Avatar](#avatar) |
| Food and onboarding settings | [Food Preferences](#food-preferences) and [Tutorial And Session](#tutorial-and-session)                                                                          |
| Elevated access              | [Privileged Tools](#privileged-tools)                                                                                                                            |

## Settings Surfaces

- Keep the Profile route as a compact summary and settings menu rather than rendering
  every form at once.
- On compact phones and short screens, only the main Profile scroll surface controls
  header retraction. Downward scrolling hides the title and supporting copy; a short
  upward scroll reveals them before the page reaches the top. Scrolling inside a
  bottom sheet or right sheet never changes the Profile header. Wider layouts keep the
  header visible, and reduced motion removes the transition without changing the
  visibility state.
- Open Light/Dark Mode at `/profile/appearance`, Playful messages at
  `/profile/playful-messages`, Email preferences at `/profile/email-preferences`,
  Profile details at `/profile/details`, and Profile image at `/profile/image` in the
  shared route-backed `BottomSheet`.
- Let each bottom-sheet title own the visible heading. Keep control-level semantic
  labels available to assistive technology without repeating the same visible wording
  inside the sheet.
- Open Food preferences at `/profile/food-preferences` in the shared route-backed
  `RightSheet` because it is a long, independently scrollable settings workflow.
- Show the privileged-tools launcher only when the current server-verified role is
  moderator, administrator, or developer. Name it `Moderator tools`, `Admin tools`, or
  `Developer tools` from that verified role. Render it as a normal link to the full-page
  `/profile/privileged-tools` dashboard rather than opening a Profile bottom sheet.
- Each launcher summarizes the saved state without duplicating its complete form.
- The shared handle, intentional backdrop press, Escape, and browser history close a
  bottom sheet and return to `/profile` without reloading the underlying Profile page.
  Direct loading and refresh preserve the documented sheet route.
- Successful saves close the active settings surface once and update its summary.
  Validation failures stay visible in the open surface with the entered values intact.

## Identity

- Show and edit a preferred display name limited to 25 characters and an optional bio
  limited to 150 characters.
- Show the live character count beside both fields and announce the remaining count
  through each field's accessible description.
- Use a generated display name when the account has no chosen name.
- Do not require or expose the account email as a public identity.
- Show clear validation, pending, success, and failure states.

## Light/Dark Mode

- Offer Device, Light, and Dark choices through accessible selection controls.
- Preview changes immediately and save them explicitly to the account.
- `Device` follows operating-system changes while selected.
- Apply the saved theme before first paint to avoid a light/dark flash.
- Theme changes must not reload the route, close overlays, or reset forms.

## Playful Messages

- Keep the setting on by default while allowing the account to turn it off explicitly.
- Summarize the current state as `On` or `Off` in the Profile settings menu.
- Explain the tone as occasional playful food humor, not adult content.
- State the safety exclusions in the setting itself. Never place playful copy near
  allergens, recalls, alcohol safety, medical guidance, authentication, validation,
  errors, body weight, or anything involving minors.
- Use the shared toggle, bottom sheet, status message, and submit-button primitives.

## Email Preferences

- Treat every marketing category as optional and off until the account explicitly
  turns it on. Missing preference rows mean not subscribed.
- Present Product and launch updates, MVP testing invitations, and Tips, recipes, and
  education as independent switches. Newly introduced categories also start off.
- Provide one `Turn off all promotional email` action that changes every visible
  category to off before the user saves.
- Summarize the number of enabled optional categories in the Profile menu. When none
  are enabled, state that all promotional email is off.
- State inside the setting that account confirmation, password, security, safety, and
  required service messages are transactional and unaffected.
- Save all current categories atomically through the owner-scoped database function;
  partial, unknown, or malformed preference submissions fail without changing state.
- Each effective preference change appends consent evidence with the consent-copy
  version and source. The application does not duplicate the Auth email address in
  preference storage.

## Avatar

- Accept JPEG, PNG, and WebP up to 5 MB through the shared photo input.
- Show the current image and a friendly availability state before replacement controls.
- Allow optional image description/alt text to be edited without re-uploading the image.
- Require the shared two-step confirmation before removing the current image.
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
without repeating a separate full-page saved-values panel. Allergen and restriction
summaries distinguish active choices from choices waiting for review. Keep the privacy
acknowledgement visible as a compact footer above the save action rather than hiding it
in a disclosure. Validation failures open every configurable preference disclosure so
the entered values and required correction remain reachable.

Use searchable add controls for DB-provided allergens and dietary restrictions rather
than checkbox walls. Show every selected value in one removable row with an `Active` or
`Waiting for review` status. Filtering changes only the available add results and never
removes a selected value. Each group owns a scoped clear action.

A device locale may suggest a supported region only when it contains an explicit region
represented by the active policy. The suggestion is not stored until Save. Region adds
labeling context and never removes a personal warning. The selected region displays the
DB-provided regulatory authority and active food-safety policy version.

Keep display units separate from the default Mix starting amount. The starting amount
applies only when a food has no exact source serving. Show the exact weight conversion
between grams and ounces; never estimate a food density or imply an unavailable serving
conversion. Measurements own a scoped restore-defaults action.

Nutrient priorities are ordered. Show the DB-provided default target and unit when one
exists; otherwise label the choice as display emphasis only. Priority order affects the
default Mix nutrient order but never creates or changes a user's nutrition goals. The
section owns a restore-defaults action.

Canonical choices resolve through DB-reviewed compatibility tags. Custom wording stays
saved exactly, but an unmatched or ambiguous value is clearly marked as waiting for
review and does not drive warnings or food ranking until a reviewed exact mapping exists.
Do not reintroduce general dislikes or ingredients-to-avoid without a separate product
decision.

Saved allergens and restrictions drive search downranking, nutrition warnings, Fridge
and Shopping List warning frames, Mix warnings, and suggestion safety. Region affects
regional warning and Nutrition-detail context. Measurement defaults affect new Mix
amount controls, and nutrient priorities affect default Mix nutrient order. Explain
those impacts briefly inside the matching disclosure without repeating saved values.
Matching comes from reviewed server policy and source evidence, not naive client text
matching.

## Tutorial And Session

- Provide an action to replay the guided tutorial without changing the stored
  onboarding choice.
- Provide a clear Log out action.
- Submit logout through the server authentication endpoint so the Supabase session and
  password-upgrade state clear together.
- Log out only the current browser session; other signed-in devices remain active.
- Logging out never deletes profile, food, list, recipe, or Mix data.

## Privileged Tools

- Treat Profile as a privileged navigation gateway, not as a second moderation
  implementation. Every destination retains its own server and database authorization.
- Read the current role's permission rows from `app_role_permissions`; never infer tool
  access from the role name or expose a destination without its required permission.
- Open `/profile/privileged-tools` as the role-aware landing dashboard, then open each
  selected responsibility in its own route-backed `RightSheet`. Closing a focused view
  returns to the landing dashboard. Never use hash jumps into one crowded page as the
  primary Profile moderation flow.
- Show one aggregate red count on the Profile launcher only when one or more genuine
  actions are waiting across the current role's permitted queues. The aggregate is the
  sum of product submissions, catalog-review decisions, food-warning reports, exact
  reported profile images, and deduplicated catalog data-operation subjects.
- Keep every permitted workspace visible on the landing page. Put nonzero queues in the
  primary **Needs attention** group and keep zero-count or search-led workspaces as
  ordinary secondary links. Catalog review and Catalog data operations retain their
  standing entry points at zero while displaying a count when action exists.
- Lead the landing page with one plain-language work-status card. When actions exist, name
  the exact aggregate and the first queue to open; when none exist, say that no human
  decision is waiting; when identity or count reads block the summary, explain the
  next safe step without presenting unknown as zero.
- Place every nonzero queue once under **Needs attention**, ordered with food-safety
  review first, followed by catalog decisions, product submissions, reported profile
  images, and data operations. Keep zero-count queues and standing search or diagnostic
  tools under clearly secondary headings so a red badge always means real work rather
  than availability or volume.
- Count only exact profile images with pending user reports. Ordinary profile-image
  uploads remain active and never create moderator work by themselves.
- Group catalog decisions under **Review work** and source/dataset/readiness operations
  under **Data operations**. Catalog reviewers can resolve conflicts, provider changes,
  and possible recalls without receiving permission to run or inspect admin/developer
  operations.
- Count Catalog review work as the exact sum of open catalog conflicts, pending provider
  changes, and possible recall matches requiring review. Count Catalog data operations
  once per distinct affected subject with one or more open enabled issue codes owned by
  `data_operations`; multiple issues on the same subject must not inflate the badge.
- Do not badge Account access while it remains a search-driven tool without a genuine
  pending-action queue. It stays available to permitted roles and is excluded from the
  launcher aggregate.
- Show one crown beside the role-aware landing-page title without repeating the title in
  the dashboard body.
- Keep global catalog and system diagnostics exclusively on the landing page. For users
  with data-operations permission, show the active shared-catalog total, public
  blendCalcAPI v1 total, shared-catalog-only total, API publication coverage, monitoring,
  sources, datasets, policy, and diagnostic matches. Label these as signals rather than
  operator work, and do not duplicate them inside focused workspaces.
- Give every focused privileged-tool right sheet one plain-language heading, one short outcome-
  focused explanation, and one crown at the view header. Do not repeat the heading in
  the action body or expose source keys and status codes as unexplained user-facing copy.
- Place one shared circular information action beside the crown. It opens a contextual
  bottom sheet explaining that tool's purpose, review flow, decision effect, and safety
  boundary. Keep the main right sheet focused on current work instead of repeating those
  instructions in every review card.
- Immediately below feedback, give every focused workspace one shared start card that
  states the current action or clear/on-demand state, the first step, and an explicit
  **Done when** condition. Nested product-readiness and nutrient-mapping views retain
  the same pattern so entering a detail never removes the operator's sense of progress.
- Before identity verification, keep review counts private but leave the protected
  review rows available as entry points into the authenticator flow. Explain that
  verification is required instead of making the actions look permanently unavailable.
- Keep standing tools such as Account access, Catalog review work, and permitted Catalog
  data operations enabled because they remain useful without pending work.
- If queue counts cannot be read, preserve unknown as unknown, disable queue actions,
  explain the temporary limitation with friendly copy, and leave standing tools
  available. Never present an unavailable count as zero.
