# UI Functionality Preservation Brief

This file is the handoff brief for a large UI rebuild. It lists the app behavior, data
points, and user flows that must survive a visual refactor. Treat this as a functional
contract for Figma/Make or any future redesign work.

The UI can change significantly. The product behavior below should not be removed,
hidden, or made harder to reach without an explicit product decision.

## Product Summary

blendCalc is an authenticated, mobile-first food and nutrition awareness app. Users:

1. Find or create ingredients.
2. Add ingredients to On Hand or Shopping List.
3. Build a food combination from available ingredients.
4. Set nutrient goals and amounts.
5. Read graph feedback, warnings, and suggestions.
6. Save reusable combinations.
7. Maintain optional profile and food preference settings.

The app uses Supabase as the account data source of truth. Browser storage is limited to
account-scoped unsaved drafts, device-only preferences, and short-lived session context.

## Global Non-Negotiables

- **App-wide responsive layout:** Every route, card, form, modal, sheet, popover,
  notification, button group, data panel, and fixed control must work on narrow phones,
  short landscape screens, tablets, desktops, and at 200% text zoom using the shared
  width and compact-height breakpoints.
- **No horizontal overflow:** Long food names, badges, nutrition labels, graph labels,
  and form controls must wrap or truncate safely.
- **Reachable overlays:** Dialogs, sheets, popovers, tutorials, and scanners stay within
  the safe usable viewport, scroll internally, and keep required actions reachable.
- **Compact cards on constrained screens:** Narrow or short phone layouts reduce saved
  and search-card height, copy size, gaps, and visual action size together while
  preserving card media, warning edges, readable state, and operable controls.
- **Important actions stay visible:** Barcode scan, nutrition warnings, save state, and
  food conflicts must not be buried.
- **Account privacy:** Do not display user emails in normal app chrome when a display
  name exists. Generated usernames/display names are preferred.
- **Health-sensitive data:** Allergens, dietary restrictions, food preferences, and
  nutrient priorities are optional and must be described as sensitive/important.
- **Warnings do not block by default:** Food preference conflicts should warn and
  down-rank unless a specific moderation/security rule says otherwise.
- **Consistent interaction language:** Use simple, direct wording. Avoid technical API
  language in primary user flows.
- **Visual implementation:** Follow the maintained, Ingredients-derived system in
  [`style-guide.md`](style-guide.md). This brief defines behavior, not a competing style
  system.

## App Shell and Authentication

### Unauthenticated Landing Page

- Show a focused marketing/sign-in card.
- Hide the normal authenticated header and tab navigation.
- Preserve the floating fruit background animation:
  - Fruit appears behind the landing card.
  - Animation is subtle, slow, and not visually overstimulating.
  - Fruit can rotate slowly and softly interact/bounce.
  - Mobile uses fewer/smaller fruit elements.
  - Decorative fruit should remain non-interactive and accessible as decoration.
- Primary CTA: sign in/start mixing.
- Landing copy should communicate:
  - Build smoothies that fit goals.
  - Track nutrients that matter.
  - Adjust ingredients with live feedback.
  - Save mixes for later.

### Sign-In Flow

Preserve both sign-in methods:

- Google OAuth.
- Email/password sign-in and account creation.

Required behavior:

- Auth redirects must return to the origin that started sign-in:
  - Localhost returns to localhost.
  - Production returns to production.
  - Branch previews return to the branch preview.
- Auth callback is `/auth/callback`.
- Auth errors must show clear, non-technical messages.
- Password validation must show requirements during sign-up.
- Existing accounts with weak passwords should be prompted to update to current
  standards.
- Duplicate submits should be blocked with loading states.
- Signed-out users cannot use authenticated app routes.

### Authenticated Header and Navigation

- Header includes app title/logo, profile access, tutorial/info access, moderation
  access for privileged users, and sign out.
- Do not show full email in the header.
- Prefer display name/generated username in personalized UI.
- Navigation tabs:
  - Ingredients
  - Mix
  - Saved
- Active tab styling must be obvious on mobile.
- Header/nav must keep title readable on small screens.

### Daily Welcome

- Show a dismissible welcome message once per user per day.
- Use display name/generated username if available.
- Should auto-dismiss after a short timer and allow early dismissal.
- Do not show every page load.

### Tutorial

- First-time users see the current tutorial version automatically.
- The guided tour moves through Ingredients, Mix, Saved, and Profile using the actual
  route for each feature.
- Every step darkens the surrounding page and leaves one rounded, clearly outlined
  feature visible. The spotlight follows that feature's corner shape, stays inside its
  view frame, and preserves at least `0.5rem` of clear space around it. The tutorial
  card stays beside that feature without covering it when viewport space permits.
- Each spotlight targets one direct control, card, input, chart, or disclosure summary
  rather than an entire information section. Related behavior is taught through
  consecutive focused steps, such as highlighting one ingredient card before its
  item-actions button.
- The concise step sequence explains:
  - Food search, barcode scanning, manual entry, and item-specific actions.
  - Fridge and Shopping List cards.
  - One Mix ingredient choice and the resulting amount/serving workflow.
  - Per-100g nutrition scaling: `source value × selected grams ÷ 100`.
  - Goal chart meaning and why reaching `100%` is not a health score.
  - One Saved Mix disclosure and draft behavior.
  - Optional dietary settings and the limits of available warning data.
- `Previous` and `Next` direct the user through the highlighted routes. First-time users
  can choose `Remind me in 7 days`, `Don’t show again`, or complete the full sequence.
- Every step navigates to its route when needed, scrolls its target into view, and
  applies the spotlight automatically. Keyboard focus stays inside the tutorial card;
  the app header, bottom navigation, route content, and document scrolling remain
  unavailable until the tour closes or completes.
- The reminder choice stores a seven-day reminder. Choosing not to show the tutorial
  again or finishing stores completion for the current tutorial version.
- A persistent Profile action reopens the tutorial without changing the saved
  onboarding preference, and leaving the replay returns to Profile.
- Tutorial preference is saved to the database.
- Tutorial action buttons remain visible while the tutorial copy scrolls internally
  when needed.
- Modal focus stays inside the tutorial, route changes preserve the tour, reduced-motion
  preferences remove movement, and missing targets fall back to a centered readable
  card rather than blocking the app.
- Tutorial copy stays short, plain, task-oriented, and explicit about calculations and
  data limitations.

## Ingredients Page

Routes: `/ingredients/fridge` and `/ingredients/shopping`

This page owns food discovery, barcode scanning, custom ingredient creation, and On Hand
/ Shopping List management.

### Find Ingredients Card

Core visible elements:

- Title: Find Ingredients.
- Short helper text.
- Prominent barcode scan action.
- Search input.
- Collapsible manual entry section.

Do not make barcode scanning feel secondary. It should be the quickest and most obvious
way to add packaged foods.

On compact phone and short-screen layouts, the Ingredients page title, search controls,
and manual-entry launcher animate upward after deliberate downward saved-list scrolling.
They animate back down after a short upward scroll, even before the list reaches its
first item. Manual entry becomes a pencil-only rounded icon button beside Search,
Barcode, and Filters while retaining its full accessible name. Fridge/Shopping List
tabs use compact visual pills without reducing their combined touch targets below
`44px`. Keep the saved-list tabs available and keep this region fixed on wider layouts.

### Barcode Scan Flow

Preserve:

- Barcode scan button with clear icon and text.
- Scanner modal/dialog using camera.
- Scanner busy/loading state with animated barcode/laser treatment.
- Smooth visual transition between idle scan button and scanning state.
- Clear cancel/close affordance.
- Fast product lookup after scan.
- If scan succeeds:
  - Fill product/custom ingredient data.
  - Scroll/focus to the next required review step.
  - Use agreed flow for adding to On Hand or Shopping List.
- If scan fails or product is incomplete:
  - Keep user in a recovery path.
  - Let user manually add missing label details.
  - Do not strand the user in an error-only state.

Data to preserve from scanned products when available:

- Barcode / GTIN / UPC.
- Product name.
- Brand.
- Serving label.
- Serving weight.
- Optional volume equivalent, only when trustworthy.
- Calories, macro nutrients, vitamins, minerals, and all available nutrient values.
- Ingredient list text.
- Allergen metadata.
- Traces/may-contain metadata.
- Labels, categories, and dietary tags.
- Source/provenance and confidence.
- Source-backed product image metadata when available, including license and
  attribution, rendered only after it is stored in Supabase. A saved moderator rotation
  corrects the full detail image orientation as well as the ingredient-card image;
  card crop, zoom, and position remain card-only.
- Product evidence photos when needed for moderation.

### Manual Custom Ingredient Entry

Manual entry is collapsible and should only be open when actively used.

Required fields/sections:

- Ingredient name.
- Brand/owner when available.
- Serving label.
- Serving weight in grams.
- Optional volume equivalent:
  - Default off.
  - User must opt in unless reliable barcode/API data supplies it.
  - Explain that it helps convert cups/tbsp/tsp/fl oz using that exact product.
- Nutrition facts per serving.
- Additional nutrient values beyond vitals when available.
- Ingredient/allergen/dietary metadata when available.
- Destination:
  - On Hand.
  - Shopping List.
  - Custom ingredients only if supported by current flow.
- Share/submit to shared catalog when product appears reusable.

After successful manual submit:

- Collapse manual entry.
- Show success feedback.
- Add to the selected destination or make destination choice clear before saving.
- If the same custom ingredient already exists, do not show a dead-end error. Use the
  existing food and continue the add-to-list flow.

### Search Ingredients

Search sources:

- User custom foods.
- Shared product catalog.
- FoodData Central / USDA.

Search behavior:

- Users can enter text and tokenized pills.
- Manual entry collapses when search is being used.
- Selecting a result scrolls/focuses the nutrition facts preview.
- Results should be sorted by:
  - User food preference conflicts/down-rank score.
  - Food quality/completeness.
  - Name relevance.
- Search errors should have spacing and not touch adjacent sections.
- If external search fails, saved/custom foods should still be usable.

Search result data to preserve:

- Name.
- Brand/category.
- Data source.
- Completeness/limited data status.
- Food preference conflict indicators.
- Barcode when applicable.
- Custom/shared/USDA source indicators.

### Nutrition Facts Preview

Must remain clear on small screens.

Preserve:

- Nutrition Facts visual panel.
- Visible “per 100g food data” label near the top.
- When a source serving includes both a household label and gram weight, show the
  household label first and the gram weight in trailing parentheses.
- Main nutrients:
  - Calories.
  - Total fat.
  - Total carbohydrate.
  - Dietary fiber.
  - Total sugars.
  - Protein.
- Additional nutrients when available:
  - Vitamins.
  - Minerals.
  - Fatty acids.
  - Other FDC nutrients.
- Complete food details when available:
  - Brand, barcode/GTIN, barcode format, categories, package size, labels, and food
    identity.
  - Ingredients, structured ingredient percentages, additives, `Contains`, and
    `May contain`.
  - Source-backed dietary labels and reviewed dietary considerations, using friendly
    normalized labels rather than internal compatibility-policy terms.
  - Every normalized serving and legitimate weight-to-volume density with its
    confidence qualifier.
  - Field-level data sources, source record identifiers and dates, dataset/version,
    attribution, and license links.
- Keep the complete product, serving, and source metadata inside the shared
  `Product details` collapse, closed by default.
- When traceable source-record metadata contains a useful caveat, show a separate
  `Data quality` collapse that defaults closed. Translate supported completeness,
  obsolete, warning, error, schema-version, and multi-source metadata into friendly
  bounded messages. Never render raw provider quality tags, treat a source note as a
  blendCalc verification result, or show the section when it has nothing useful to say.
- Keep field sources, attribution, and licence details in `Product details`; the data
  quality disclosure points there instead of duplicating them.
- Show the server-provided compatibility evaluation independently from source
  disclosures and individual warning explanations:
  - `conflict`: a reviewed rule found at least one conflict with the signed-in user's
    active food settings.
  - `checked`: the current policy covers every active setting and all evidence required
    for that food type is available; say only that no conflict was found in the
    available information.
  - `incomplete`: settings were applied, but required evidence or policy coverage is
    missing.
  - `not_checked`: no active food settings were applied.
- Never present a compatibility status as a guarantee. For packaged food, keep the
  current package label as the final authority. A card warning edge represents only
  `conflict`; no edge does not mean `checked`.
- Missing detail fields do not create empty sections, guessed values, or placeholder
  wording.
- Add to On Hand button.
- Add to Shopping List button.
- Successful action feedback.
- Food preference warnings near the preview when relevant.

On mobile:

- Additional nutrient column must not clip outside the card.
- Buttons should remain tappable.
- Long nutrient names and product names must wrap safely.

### Nutrition Confidence Details

For limited or partial nutrition data:

- Collapse details by default.
- Show a visible indicator when issues exist.
- Let users expand to see which vital nutrients are:
  - Available.
  - Missing.
  - Derived.
- Do not overwhelm normal search usage with large warning blocks.

### On Hand and Shopping List

These list sections appear on Ingredients and Mix and should remain visually consistent.

Required controls:

- Search/filter saved ingredients.
- Source filter.
- Sort:
  - Newest first by default.
  - Name A–Z.
  - Name Z–A.
- Pagination for large lists.
- Visible item count.

Item behavior:

- Where a card has one dominant select, preview, or disclosure action, the full card
  surface activates it. Secondary card controls remain separate and take priority.
- Remove from list.
- Rename item.
- Move item between lists where supported.
- Custom ingredients have a distinct badge/color.
- Food preference conflicts show a compact indicator.
- Long names truncate/wrap safely with full name available through title/details.

## Mix Page

Route: `/mix`

Meaningful Mix overlays use explicit child paths, including `/mix/save`,
`/mix/reset-goals`, `/mix/clear-ingredients`, `/mix/reset-all`,
`/mix/rename/{list}/{foodId}`, `/mix/warnings/{warningId}`, and
`/mix/ingredients/{foodId}/conversion-details`. They use shallow history so the
underlying Mix state stays mounted.

The Mix page is the core smoothie builder. It combines selected foods, amounts, nutrient
goals, visual graph feedback, warnings, suggestions, and saving.

### Loaded Mix State

When a saved drink is loaded:

- Display the saved drink name at the top.
- If unchanged, Save is disabled.
- If any Mix page value changes, Save becomes enabled.
- Changes should not mutate the saved drink until user explicitly saves.
- Reset/clear should detach loaded saved state and start from scratch.
- Saving supports:
  - Save as new.
  - Overwrite existing.
- New saved drink names must be unique per user, not globally unique.

If a loaded drink contains ingredients no longer in On Hand:

- Add or route missing items to Shopping List rather than silently failing.
- Show clear feedback if restore cannot complete.

### Nutrient Selection

Preserve:

- Default vital nutrients selected initially.
- Add nutrient dropdown/search backed by generated FDC nutrient catalog.
- Selected nutrients are part of each saved mix.
- Users should not have to scroll through a huge raw nutrient list.
- Nutrient picker should support quick discovery/filtering.
- Removing/adding selected nutrients updates:
  - Goal target cards.
  - Radar graph points.
  - Warnings.
  - Suggestions.
  - Saved mix state.

Critical rule: The graph shape point count matches selected nutrient count:

- 1 selected nutrient: circle.
- 2 selected nutrients: thick line.
- 3 selected nutrients: triangle.
- More nutrients: polygon/radar shape.

### Goal Targets

Preserve:

- Goal card per selected nutrient.
- Current/goal value shown near nutrient name.
- Units displayed clearly.
- Goal input per nutrient.
- Preset templates:
  - High Protein.
  - Low Sugar.
  - Calorie Dense.
  - Balanced.
  - Fiber Focused.
- Apply template action.
- Reset goals action.

Mobile requirements:

- Nutrient labels must not collide with inputs.
- Fractions/current-vs-goal should remain readable.
- Cards should stack or resize before text becomes unreadable.

### Ingredient Chooser

Preserve:

- On Hand and Shopping List selection areas.
- Search/filter.
- Sort.
- Pagination.
- Pills/cards matching the Ingredients page list sections.
- Selected state obvious.
- Long names and custom badges must not break the layout.
- Food preference conflict icons remain visible.

### Selected Ingredients and Amounts

Preserve:

- Selected ingredient card per food.
- Amount input.
- Unit selector.
- Converted gram amount.
- Top nutrient contribution summary.
- Collapse/expand details with a chevron.
- Remove ingredient action.
- Scrollable selected ingredients area when there are many foods.

Units and conversions:

- Weight-based values are primary.
- Volume is available only when conversion data is reliable or explicitly opted in.
- Estimated volume conversions must show a warning.
- Nutrition calculations use per-100g food data scaled by selected amount.

### Radar / Point Shape Graph

The graph is one of the highest-value features. Do not bury it.

Preserve three layers:

1. Outer containing shape.
2. Goal shape.
3. Current ingredient/amount shape.

Behavior:

- Goal shape changes based on goal inputs.
- Highest goal value reaches the outer shape boundary; other goal points scale relative
  to it.
- Current shape changes when ingredients or amounts change.
- Current shape animates growth.
- Numeric labels show current/goal value under or near each nutrient label.
- Labels must not clip, overlap graph lines, or disappear at 1, 2, 3, 6, or more
  nutrients.

Color behavior:

- Each point has its own status color.
- Below goal: yellow/caution.
- Near goal: green.
- Slightly over: yellow.
- Mid over: orange.
- Far over: red.
- Lines between points use gradients between connected point colors.
- Fill reflects the status gradient rather than a single flat color.

### Smart Warnings

Warnings should be practical and concise.

Examples:

- “Sugar exceeds goal by 8g.”
- “Protein is under target by 12g.”
- “This graph uses estimated volume conversions.”
- “This food may conflict with your dairy restriction.”

Preserve:

- Over-goal warnings.
- Under-goal warnings.
- Volume-estimation warnings.
- Food preference conflict warnings.
- Reusable popover/details for “why” explanations.

### Nutrient Adjustment Suggestions

Suggestions should be collapsed by default when present.

Required behavior:

- Collapsed section shows an alert indicator when suggestions exist.
- Expanded view combines add and reduce/tweak suggestions into one coherent flow.
- Suggestions should not flood the screen with repeated versions of the same ingredient.
- Suggestions must consider other nutrient goals before recommending an amount.
- If a suggestion will worsen another goal, show a clear caution.
- Apply action updates the selected ingredient amount.

Suggestion types:

- Add more of a food to fill a missing nutrient.
- Reduce a food to bring an over-goal nutrient closer.
- Adjust amount of an already selected food.

### Ingredient Contribution Breakdown

Preserve the “what is driving this shape” concept:

- For each active nutrient, show top contributing ingredients.
- Show percent contribution and actual amount.
- Keep compact; avoid duplicating Smart Warnings.
- Useful examples:
  - Olive oil contributes most fat.
  - Banana contributes most sugar.
  - Milk contributes most protein.

### Save Review Flow

Preserve:

- Save button.
- Review modal before saving.
- Numerical comparison between actual totals and goals.
- Under/near/over status per selected nutrient.
- User confirmation before saving anyway.
- Drink name input.
- Save as new.
- Overwrite loaded mix.
- Cancel.
- Duplicate name validation per user.
- Loading state while saving.

## Saved Drinks Page

Routes: `/saved`, `/saved/sort`

Preserve:

- Search saved drinks by drink name or ingredient name.
- Sort:
  - Newest first.
  - Oldest first.
  - Name A–Z.
- Explicit load-more and return-to-top controls for large saved-drink collections.
- Each saved drink is a shared collapse that starts closed.
- The closed saved-drink header shows:
  - Drink name.
  - Total calories when the saved food data supports that calculation.
  - One neutral overall-goal score calculated from every goal with nutrient evidence.
    The score averages each goal's proximity to 100%, so overages and deficits both
    lower it instead of cancelling each other out.
- The expanded saved-drink body shows:
  - Created date.
  - Ingredient count.
  - Up to eight compact ingredient pills using category symbols rather than product
    images. Pills are size-classified and best-fit packed into bounded rows so short
    labels share space, long labels receive wider tracks, and no pill can extend beyond
    the recipe card.
  - A remaining-ingredient disclosure that expands the rest of the ingredient pills
    without an inner scrolling list.
  - Every progress pill derived from the saved nutrient selection and goal data;
    nutrients with no reported or derived evidence are omitted rather than displayed
    as zero.
  - One dominant Load action plus compact Share and confirmed Delete actions.
- `Load` action that loads the drink into Mix.
- Share recipe action.
- Delete drink action using the shared two-step tap/click confirmation.
- Loading/error states for load/delete.
- Custom ingredient indicators.
- Sorting uses the same URL-backed bottom-sheet and pill controls as Ingredients rather
  than a native select in the page toolbar.
- On compact screens, deliberate downward list scrolling hides the Saved heading and
  search/sort controls with the shared `ViewTop` transition. Upward scrolling reveals
  them without requiring a return to the top, and reduced-motion preferences remove
  the transition.
- Empty and initial loading states use the quiet open-page presentation and shared
  circular icon framing from Ingredients rather than bordered placeholder cards.

When loading a drink:

- Restore selected nutrients, goals, foods, serving amounts, and units.
- Route missing On Hand ingredients to Shopping List where possible.
- Navigate to Mix.

## Profile Page

Route: `/profile`

Profile data is optional except for generated display name defaults.

### Display Profile

Preserve:

- Display name / preferred name.
- Auto-generated default display name for users with no chosen name.
- Bio.
- Save profile action.
- Success and validation feedback.

Do not require users to expose email addresses as public identifiers.

### Appearance

Preserve:

- Device-following, light, and dark color-theme choices.
- Immediate preview when a choice changes.
- Explicit save feedback.
- Account-level persistence across devices.
- Correct first-paint theme without a light-to-dark hydration flash.
- Automatic updates when the device color scheme changes while `Device` is selected.

Theme changes must not reload the route, close overlays, reset forms, or create
theme-specific copies of shared components.

### Avatar Upload

Preserve:

- Image upload.
- Optional image description/alt text.
- Accepted image formats:
  - JPEG.
  - PNG.
  - WebP.
- Max image size: 5 MB.
- File signature validation.
- Profile image rules in a collapsed section.
- Required checkbox confirming the image follows rules.
- Optional human-face confirmation when configured.

Rules shown to users should include:

- No explicit nudity.
- No sexual content.
- No graphic violence.
- No hate imagery.

Do not disclose internal moderation gaps or whether automated image moderation is or is
not active.

### Food Preferences

Food preferences are optional and sensitive.

Preserve:

- Warning that these settings may affect food warnings and suggestions.
- Preferred units:
  - No preference.
  - Metric.
  - US units.
- Default smoothie serving size, shown in user-friendly units.
- Allergens.
- Dietary restrictions.
- Prioritized nutrients.
- Acknowledgement checkbox.
- Save food preferences action.
- Saved summary that shows what is currently stored.

Current product direction:

- Keep **Allergens** and **Dietary restrictions**.
- Do not reintroduce overbuilt “dislikes” or “ingredients to avoid” sections unless
  explicitly requested.
- Dropdown options must be DB/API-observed, not hard-coded fallback constants.
- Users can also type custom allergens/restrictions.
- Selected values need dividers/separation so the section reads clearly.

Food preference data must drive:

- Search result warnings/downranking.
- Nutrition panel warnings.
- On Hand and Shopping List conflict indicators.
- Mix warnings.
- Suggestions that avoid conflicting foods.

Important matching rule:

- Avoid naive string matching that creates bad false positives.
- Example: almond milk should not trigger a milk/dairy allergy warning unless metadata
  specifically indicates dairy/milk.
- Prefer DB compatibility tags and source metadata over raw name matching.

### Account Session

- Provide a clear `Log out` action on the Profile page.
- Submit logout through the server authentication endpoint so the Supabase session and
  password-upgrade state are cleared together.
- Keep saved profile, food, and list data intact for the next authenticated session.

## Moderation Page

Route: `/moderation`

Only privileged users can access this page.

Preserve:

- Viewer role indicator.
- Account search by:
  - Display/preferred name.
  - Email.
  - User ID.
  - Role.
  - Status.
- Account cards with:
  - Avatar preview or placeholder.
  - Display name.
  - Email for moderators only.
  - Status.
  - Role.
  - Image moderation status.
  - Public reason if blocked.
- Admin/moderator guardrails:
  - User cannot moderate their own account.
  - Admin accounts cannot be blocked here.
  - Moderators cannot moderate other privileged users unless allowed.
- Block account action with reason.
- Restore access action.
- Email notification explaining block reason.

### Shared Product Submission Review

Preserve:

- Product submissions queue.
- Product name and brand.
- Barcode.
- Source match.
- Evidence completeness.
- Conflict count.
- External lookup failure notice.
- Review flags.
- Product evidence images.
- Nutrition value details.
- Approve action.
- Reject action with required note.
- QA fixture handling for testing moderation.

Submission abuse protection:

- Users with too many rejected submissions are blocked from submitting for a limited
  period.
- Current rule target: 5 rejected submissions over a reasonable window causes a 30-day
  submission block.
- This is a submission block, not necessarily a full app ban.

## Cross-Cutting Dependencies

This brief owns user-visible behavior only. Supporting contracts are maintained in:

- [`shared-product-catalog.md`](shared-product-catalog.md) for reusable product intake,
  verification, revisions, and moderation;
- [`data-architecture.md`](data-architecture.md) for durable reads, writes, browser
  state, and server-owned policy;
- [`supabase-schema.md`](supabase-schema.md) for the database objects behind each
  feature;
- [`api-structures/source-data-inventory.md`](api-structures/source-data-inventory.md)
  for provider capabilities and preserved source fields;
- [`data-source-licensing.md`](data-source-licensing.md) for source storage,
  attribution, and redistribution requirements; and
- [`style-guide.md`](style-guide.md) for visual tokens, responsive presentation, and
  reusable component patterns.

View sections above define where search, sorting, pagination, warnings, loading,
moderation controls, and other behavior must appear. Do not reproduce their data models
or visual rules here.

## Critical Items Not to Hide or Bury

These must remain easy to notice:

- Barcode scan action.
- Food preference conflict warnings.
- Limited/partial nutrition data indicators.
- Nutrition Facts source/per-100g notice.
- Graph current vs goal labels.
- Save button and dirty/loaded mix state.
- Smart Warnings.
- Nutrient suggestions indicator.
- Profile food preference sensitivity notice.
- Avatar policy consent checkbox.
- Moderation block/reject reasons.

## Verification Boundary

Executable acceptance criteria belong in the active queues linked from
[`QA/qa-tasks.md`](QA/qa-tasks.md). This brief defines intended behavior; it does not
maintain a second QA checklist.
