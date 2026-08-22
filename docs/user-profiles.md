# User Profiles

Profile details are optional. Authentication and the rest of the application do not
depend on a `profiles` row existing.

This document owns profile behavior and privacy. Auth configuration belongs in
[`authentication.md`](authentication.md), visual presentation in
[`style-guide.md`](style-guide.md), and profile table/storage shape in
[`supabase-schema.md`](supabase-schema.md).

## Identity And Email Privacy

- The application does not send the authenticated email address to the shared layout UI.
- When no preferred name exists, the UI derives a temporary display fallback from the
  part of the email before `@`.
- Saving profile details requires a preferred name, but profile completion itself
  remains optional.
- Preferred names are not unique and may contain normal spaces and punctuation.
- Bio and profile image remain optional.

## Appearance

- The profile stores one `appearance_theme` preference: `system`, `light`, or `dark`.
- `system` follows the device color-scheme setting and updates when that setting
  changes.
- The authenticated profile is authoritative across devices. A validated, non-sensitive
  cookie mirrors only the theme key so the server can render the correct theme before
  client hydration.
- Theme changes update the current page immediately and do not reload or reset active
  application state.
- The app-wide semantic theme properties live in `src/styles/_themes.scss`; individual
  views must not maintain separate dark-mode overrides.

## Optional Message Tone

- `cheeky_messages_enabled` is an account-level opt-in and defaults off.
- Enabling it permits occasional PG-13 secondary food copy after eligible successful
  actions. It does not replace factual outcomes or primary actions.
- The message text and tone are reviewed database reference data. The server filters
  the reference catalog for the authenticated account, and the resolver separately
  enforces eligible trigger contexts.
- Cheeky copy never appears in allergen, recall, alcohol-safety, medical,
  authentication, validation, warning, error, body-weight, or minor-related contexts.
- Disabling the preference takes effect across devices after the account setting is
  saved.

## Food Safety Preferences

- Food safety and dietary preferences remain optional account data. They include
  allergens, dietary restrictions, nutrient priorities, units, a default serving size,
  and an optional package-label region.
- Package-label region options come from the active versioned regulatory policy in the
  database. The browser may suggest a matching region only when its locale contains an
  explicit region represented by those options; it never invents a country from a
  language alone.
- A device suggestion is not stored until the user saves the form. Once saved, the
  concrete region code persists with the account across refreshes and devices, together
  with whether it began as a device suggestion or an explicit account choice.
- Regional policy adds authority, terminology, declaration, and coverage context. It
  never removes or lowers a warning for an allergen or dietary restriction the user
  selected.
- If a stored region is not supported by the active policy version, evaluation reports
  that no regional profile was checked and continues applying personal settings.
- The account keeps the user's exact allergen and dietary wording. Automated checks use
  a separate server-owned resolution row tied to the active policy version.
- Canonical dropdown values resolve through reviewed compatibility tags. Custom text
  resolves only through one exact reviewed canonical ingredient term or language-tagged
  alias with an active preference mapping. The app does not guess from spelling
  similarity or hard-coded synonyms.
- Unmatched or ambiguous custom text remains saved and visibly marked as waiting for
  review. It is not included in automated warnings until an exact mapping is reviewed
  and activated.
- Activating a reviewed mapping re-resolves existing account settings without changing
  the wording the user entered.
- The Food preferences route presents each configurable setting family in an independent
  animated disclosure. Header counts and short values summarize the live form state;
  the app does not duplicate the same settings in a second saved-summary block. The
  sensitive-data acknowledgement remains visible as a compact footer above Save because
  it is consent for the form rather than another configurable preference family.
- Larger reviewed allergen and dietary catalogs can be filtered locally after their
  database-backed options load. A filter never changes durable selections, and exact
  custom wording remains separate from reviewed choices.

## Profile Images

- Images are stored in the private `profile-avatars` Supabase Storage bucket.
- Row-level storage policies restrict each user to the folder named with their own user
  ID.
- The server accepts JPEG, PNG, and WebP files up to 5 MB and validates the file
  signature instead of trusting the browser-provided MIME type.
- Images are rendered with short-lived signed URLs.
- Replacing an image uploads the new object first, updates the profile, and then removes
  the old object. A failed profile update removes the newly uploaded object.

## Content Policy And Moderation Boundary

The upload form requires the user to confirm that the image contains no explicit nudity,
sexual content, graphic violence, or hate imagery. Each confirmation is appended to
`profile_image_policy_acceptances` with the policy version, exact rules, file hash,
storage path, and acceptance time. This is self-attestation and evidence of agreement,
not automated visual moderation.

`PROFILE_AVATAR_REQUIRE_HUMAN_FACE` in `src/lib/utils/profile/avatarPolicy.ts` controls
whether the form also requires a face confirmation. It does not perform face detection.

Before profile images are made visible to other users, add a server-side image
moderation provider and keep unreviewed uploads private. Client-side checks or browser
face-detection APIs are not a sufficient enforcement boundary because they can be
bypassed.

Account roles, blocks, audit history, and signup blocklists are documented in
`docs/moderation.md`.

## Change Verification

Profile schema and Storage changes follow
[`database-testing.md`](database-testing.md) and the
[`schema update checklist`](supabase-schema.md#update-checklist). Profile UI changes
follow the Profile behavior contract in
[`ui-functionality/profile.md`](ui-functionality/profile.md).
