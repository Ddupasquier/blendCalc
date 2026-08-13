# App Shell, Authentication, And Tutorial

This contract covers the application shell, account entry, shared navigation, daily
welcome, and guided tutorial. Auth configuration and security details remain in
[Authentication](../authentication.md).

## Signed-Out Landing Page

- Present one focused marketing and sign-in surface; hide authenticated navigation.
- Explain that users can build recipes, track nutrients, adjust ingredients, and save
  reusable combinations.
- Keep the decorative floating-food animation subtle, noninteractive, and marked as
  decoration. Use fewer and smaller items on mobile.
- Offer one clear sign-in or get-started action.

## Sign-In

- Support Google OAuth and email/password sign-in and registration.
- Ask Google to show its account chooser for every OAuth attempt so the user controls
  which Google profile is connected.
- Return authentication to the origin that started it: localhost, production, or the
  exact preview deployment.
- Use `/auth/callback` for the callback route.
- Show password requirements during registration and route legacy weak-password
  accounts through the required update flow.
- Disable duplicate submissions while a request is pending.
- Translate failures into clear, nontechnical guidance.
- Render the explicit Cloudflare Turnstile challenge only when its public site key is
  configured, and submit its one-time token with supported Supabase email Auth calls.
- Keep authenticated routes unavailable to signed-out visitors.

## Privileged Identity Verification

- Require moderator, administrator, and developer sessions to reach AAL2 before any
  protected page, server action, JSON endpoint, review count, or database permission is
  available.
- Send an elevated user without a verified TOTP factor to authenticator enrollment;
  send an enrolled AAL1 user to the six-digit challenge.
- Accept the current six-digit authenticator code as plain digits or with the display
  spacing used by authenticator apps. Normalize harmless separators before server
  verification instead of relying on browser pattern validation.
- Keep the active setup QR code and setup key visible after an incorrect or expired
  code so the user can enter a fresh code without restarting enrollment.
- Return the user to the originally requested internal route after successful
  verification. Never accept an external return URL.
- Keep setup QR codes, setup secrets, and verification responses private and
  non-cacheable. Do not log them.
- Explain lost-factor recovery honestly: a password reset does not remove MFA, and an
  administrator must verify identity before removing an inaccessible factor.

## Authenticated Shell

- Show the blendCalc identity, profile access, tutorial access, role-appropriate
  moderation access, and primary navigation for Ingredients, Mix, and Saved.
- Do not show the full account email in ordinary app chrome. Prefer a display name or
  generated username.
- Keep the active navigation state obvious and the header readable at compact widths.
- Keep app release and API version metadata out of normal navigation and product views.

## Daily Welcome

- Show the welcome once per account per day.
- Use the display name or generated username.
- Allow dismissal and auto-dismiss after the established short delay.
- Do not recreate it on every route load.

## Guided Tutorial

- Show the current tutorial version automatically for first-time users.
- Move through Ingredients, Mix, Saved, and Profile on the real route for each feature.
- Dim the rest of the page and spotlight one direct control, card, input, chart, or
  disclosure at a time. Match the target's corner shape and keep at least `0.5rem` of
  clear space around it.
- Keep the tutorial card beside the spotlight without covering the target when space
  allows.
- Teach search, barcode scanning, manual entry, Fridge and Shopping List, one Mix
  ingredient and amount, per-100g scaling, nutrient-goal meaning, Saved Recipe drafts,
  and the limits of food-warning evidence.
- Keep copy short and task-focused. Explain that a goal percentage is not a health
  score and that available warning data can be incomplete.
- `Previous` and `Next` navigate and focus the correct route target automatically.
- While open, trap keyboard focus in the tutorial and prevent interaction or scrolling
  in the underlying application.
- Support `Remind me in 7 days`, `Don't show again`, and completion. Persist the choice
  for the current tutorial version.
- Let Profile reopen the tutorial without changing the stored onboarding choice.
- Keep actions visible while long tutorial copy scrolls internally.
- Preserve the tour across its own route changes. If a target is unavailable, show a
  centered readable step instead of blocking the app.
- Honor reduced motion without changing the route, focus, or completion behavior.
