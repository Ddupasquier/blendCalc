# User profiles

Profile details are optional. Authentication and the rest of the application do not
depend on a `profiles` row existing.

## Identity and email privacy

- The application does not send the authenticated email address to the shared layout UI.
- When no preferred name exists, the UI derives a temporary display fallback from the
  part of the email before `@`.
- Saving profile details requires a preferred name, but profile completion itself
  remains optional.
- Preferred names are not unique and may contain normal spaces and punctuation.
- Bio and profile image remain optional.

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

## Applying the database changes

Run the migration before deploying the profile code:

```sh
npm run db:push:dry
npm run db:push
npm run db:types
```

After regenerating types, verify that `src/lib/types/database.types.ts` still includes
the `profiles` table.
