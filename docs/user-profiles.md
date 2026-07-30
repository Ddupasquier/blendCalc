# User profiles

Profile details are optional. Authentication and the rest of the application do not
depend on a `profiles` row existing.

This document owns profile behavior and privacy. Auth configuration belongs in
[`authentication.md`](authentication.md), visual presentation in
[`style-guide.md`](style-guide.md), and profile table/storage shape in
[`supabase-schema.md`](supabase-schema.md).

## Identity and email privacy

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

## Profile images

- Images are stored in the private `profile-avatars` Supabase Storage bucket.
- Row-level storage policies restrict each user to the folder named with their own user
  ID.
- The server accepts JPEG, PNG, and WebP files up to 5 MB and validates the file
  signature instead of trusting the browser-provided MIME type.
- Images are rendered with short-lived signed URLs.
- Replacing an image uploads the new object first, updates the profile, and then removes
  the old object. A failed profile update removes the newly uploaded object.

## Content policy and moderation boundary

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
follow the Profile behavior contract in [`ui-functionality.md`](ui-functionality.md).
