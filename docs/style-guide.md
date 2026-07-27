# blendCalc Style Guide

## Purpose And Scope

This is the maintained visual implementation guide for blendCalc. It records the
styling decisions that are already working in the **Ingredients** experience so a new
view can begin from an established system instead of recreating and correcting the same
patterns. The Ingredients experience includes its resting page, transient states,
buttons, dropdowns, popovers, sheets, dialogs/modals, scanner, loading and empty states,
confirmation flows, nutrition details, and privileged controls.

The current Ingredients page, ingredient search, manual entry, nutrition details, and
their shared components are the only visual reference for this guide. Mix, Saved Drinks,
Profile, and Moderation are not finished enough to define the system. Their current
styles must not override or expand this guide unless a deliberate redesign brings them
into the Ingredients system first.

This guide explains how the system looks and which existing implementation to reuse.
[`dev-rules/dev-rules.md`](dev-rules/dev-rules.md) remains the normative source
for engineering, accessibility, security, and reuse rules.

## Maintenance Contract

All UI work must:

1. Read this guide and the development rules before changing a view.
2. Reuse the Ingredients components, tokens, and interaction patterns whenever the new
   requirement has the same purpose.
3. Keep a necessary view-specific difference local to the owning component; do not
   silently redefine a global pattern.
4. Update this guide when an approved Ingredients change alters a reusable visual
   expectation.
5. Suggest a development-rule update when a visual finding exposes a repeatable
   engineering or accessibility requirement.
6. Record intentional exceptions in the relevant component or feature documentation,
   including why the shared pattern does not fit and whether the difference should later
   become reusable.
7. Never derive a new global rule from unfinished Mix, Saved Drinks, Profile, or
   Moderation UI.

Keep this guide focused on current decisions. Remove superseded guidance when a pattern
changes; do not preserve competing generations of the same visual system.

## Sources Of Truth

Use this order when implementing or reviewing styling:

1. [`dev-rules/dev-rules.md`](dev-rules/dev-rules.md) for mandatory rules.
2. This guide for the approved Ingredients visual language and component selection.
3. [`src/styles/_variables.scss`](../src/styles/_variables.scss) for exact app-wide
   values.
4. The reusable component and its paired SCSS file for component behavior and local
   geometry.
5. [`project-structure.md`](project-structure.md) for file ownership.
6. [`ui-functionality.md`](ui-functionality.md) for behavior that a redesign must
   preserve.

Do not copy a screenshot measurement into code when an existing component or semantic
token already owns the decision.

## Visual Direction

- Design mobile-first for a calm, narrow, single-column experience.
- Use light neutral surfaces, dark navy text, muted blue-gray supporting text, and green
  for the primary action/active state.
- Reserve amber for warnings and privileged emphasis, and red for actual errors or
  destructive actions.
- Prefer spacing, surface contrast, and borders over decoration.
- Do not use box shadows.
- Keep accent colors intentional; an entire list does not need an accent-colored border
  or background to appear interactive.
- Use plain, helpful user-facing language. Do not expose provider errors, database
  wording, or internal validation terminology.
- Preserve complete focus outlines and useful touch targets even when the visual control
  is compact.

## Color System

### Ingredients Shell Palette

These are the primary colors for new and rebuilt views.

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Page | `$app-shell-surface-page` | `#f8f8fb` | App canvas, route and right-sheet background |
| Panel | `$app-shell-surface-panel` | `#fff` | Cards, sheet panels, raised-by-contrast content |
| Control | `$app-shell-surface-control` | `#e9e9ed` | Quiet controls, inactive tabs, neutral inputs |
| Soft surface | `$app-shell-surface-soft` | `#f8f7f5` | Subtle active or grouped content surface |
| Primary text | `$app-shell-text-primary` | `#1a1a2e` | Titles, labels, important values |
| Muted text | `$app-shell-text-muted` | `#8b8fa8` | Descriptions, metadata, helper text |
| Primary accent | `$app-shell-accent-primary` | `#57a773` | Primary action, active state, success emphasis |
| Soft accent | `$app-shell-accent-soft` | `#e8f5ee` | Active soft state, fallback-media lane, success surface |
| Informational accent | `$app-shell-accent-info` | `#55a6c8` | Informational icon or source treatment |
| Danger accent | `$app-shell-accent-danger` | `#d84242` | Destructive action |
| Subtle border | `$app-shell-border-subtle` | `rgba(0, 0, 0, 0.08)` | Neutral control and panel boundaries |
| High-contrast ink | `$app-high-contrast-ink` | `#111` | Nutrition-label rules and data-focused contrast |

### Semantic Supporting Colors

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Warning amber | `$app-highlight` | `#f4b942` | Ingredient-card warning edge and privileged crown |
| Warning hover/strong | `$app-highlight-hover` | `#d99a24` | Strong warning emphasis, not ordinary copy |
| Error base | `$app-danger-bg` | `#e7b0b8` | Source color for error surfaces |
| Destructive brown-red | `$app-danger-action` | `#9c5f46` | Destructive/strong error treatment |
| Warning base | `$app-warning-bg` | `#efc6a9` | Source color for warning surfaces |
| Custom base | `$app-custom-bg` | `#cbb8e8` | Private unmatched custom-food tint |
| Custom strong | `$app-custom-strong` | `#7b5fa3` | Custom-food text/accent where needed |

`StatusMessage` derives its final warning and danger surfaces from the semantic colors
above. Use the component rather than reproducing those color mixes.

### Compatibility Colors

Some shared Ingredients components still consume the older `$app-bg`, `$app-section-bg`,
`$app-border-color`, `$app-primary`, `$app-accent`, and `$app-btn-*` roles. They remain
supported so existing components render consistently, but they are **not** a second
palette for new views.

For new work:

- Prefer `$app-shell-*` and `$app-status-*`.
- Reuse the existing component if it owns a compatibility color.
- Do not manually reproduce a compatibility color in a new feature.
- Migrate a shared component deliberately rather than swapping one token in one caller.

## Typography

### Families

| Purpose | Token | Use |
| --- | --- | --- |
| Interface | `$app-font-family-interface` | Body copy, controls, labels, metadata |
| Display | `$app-font-family-display` | Page titles, major sheet titles, prominent headings |
| Data | `$app-font-family-data` | Nutrition Facts and dense numeric data where narrow forms aid scanning |

### Weights

| Token | Value | Typical use |
| --- | --- | --- |
| `$app-font-weight-regular` | `400` | Long-form/body copy |
| `$app-font-weight-medium` | `600` | Helper text and supporting metadata |
| `$app-font-weight-semibold` | `700` | Section emphasis |
| `$app-font-weight-bold` | `800` | Buttons, labels, collapse headings |
| `$app-font-weight-heavy` | `900` | Ingredient-card names and page-display emphasis |

### Sizes

| Token | Value | Typical use |
| --- | --- | --- |
| `$app-font-size-2xs` | `0.68rem` | Dense secondary data only |
| `$app-font-size-xs` | `0.76rem` | Badges, progress tabs, compact labels |
| `$app-font-size-sm` | `0.88rem` | Metadata, helper text, compact controls |
| `$app-font-size-md` | `1rem` | Inputs, buttons, card names, normal UI |
| `$app-font-size-lg` | `1.08rem` | Sheet and section headings |
| `$app-font-size-xl` | `1.25rem` | Prominent content and fallback food symbols |

The root size is `$app-font-size-base` (`16px`). Do not invent nearby font sizes to make
one label fit. First use the existing scale, fix layout constraints, and allow safe
wrapping or truncation where the context requires it.

Buttons use the shared button family, `800` weight, and `1.1` line height. Labels that
behave like metadata may use `$app-letter-spacing-label` (`0.04em`); numeric data may use
`$app-letter-spacing-data` (`0.01em`).

## Spacing And Layout

### Shared Spacing Scale

| Token | Value | Use |
| --- | --- | --- |
| `$app-gap-lg` | `1.5rem` | Major view or section separation |
| `$app-gap-md` | `0.75rem` | Standard Ingredients rhythm between sections, cards, and controls |
| `$app-gap-sm` | `0.5rem` | Related controls and card actions |
| `$app-gap-xs` | `0.3rem` | Tight label/icon and heading relationships |
| `$app-gap-2xs` | `0.15rem` | Card title-to-subtitle relationship |
| `$app-gap-micro` | `0.06rem` | Rare optical separation |
| `$app-gap-inline-compact` | `0.2rem` | Compact inline content |
| `$app-gap-badge-inline` | `0.176rem` | Badge-to-title relationship |

`$app-gap-md` is the default repeated gap. Choose another value because the relationship
is semantically tighter or broader—not because a screenshot is a few pixels different.

### Shell Geometry

| Decision | Token | Value |
| --- | --- | --- |
| Overall max width | `$app-max-width` | `600px` |
| Main content max width | `$app-shell-content-max-width` | `520px` |
| Header height | `$app-shell-header-height` | `4rem` |
| Bottom navigation height | `$app-shell-nav-height` | `4.85rem` |
| Horizontal shell padding | `$app-shell-padding-x` | `1rem` |
| Vertical shell padding | `$app-shell-padding-y` | `1.2rem` |
| Breakpoints | `$app-breakpoint-xs/sm/md` | `420px / 520px / 680px` |

Account for `env(safe-area-inset-*)`, keep a `vh` fallback before `dvh`, and do not
introduce horizontal overflow at narrow widths or 200% text zoom.

### Controls And Surfaces

| Decision | Token | Value |
| --- | --- | --- |
| Standard control height | `$app-shell-control-height` | `2.95rem` |
| Compact control height | `$app-shell-control-height-compact` | `2.15rem` |
| Standard horizontal padding | `$app-shell-control-padding-x` | `0.85rem` |
| Card radius | `$app-shell-radius-card` | `1rem` |
| Control radius | `$app-shell-radius-control` | `1rem` |
| Sheet radius | `$app-shell-radius-sheet` | `1.35rem` |
| Pill radius | `$app-shell-radius-pill` | `999px` |
| Compact card padding | `$app-shell-card-padding-compact` | `0.85rem` |
| Ingredient card minimum height | `$app-shell-card-min-height` | `5.25rem` |
| Circular action size | `$app-shell-action-icon-size` | `2.2rem` |

Use a local SCSS value for unique geometry, such as an image-mask stop or OCR preview
measurement. Do not add it to `_variables.scss` unless independent components should
change together.

## Borders, Focus, And Depth

- Use surfaces and borders to create hierarchy. Do not use box shadows.
- Neutral boundaries use `$app-shell-border-subtle`.
- Ingredient cards keep a transparent `2px` border so selection can become visible
  without changing layout.
- The shared focus treatment is `$app-focus-outline` (`2px solid #4f4842`) with
  `$app-focus-outline-offset` (`2px`) unless a clipped internal control intentionally
  uses zero offset.
- Focus outlines must remain fully visible. Reserve space in sheet chrome and scroll
  containers rather than clipping them.
- Color must not be the only state signal. Preserve native state, accessible labels,
  text, or another non-color cue.
- Controls need practical touch targets even when the visible icon is smaller.

## Component Selection

Check the existing primitive before writing markup or SCSS.

| Need | Use | Notes |
| --- | --- | --- |
| Main rectangular CTA | `RoundedActionButton` | Current Ingredients action shape; supports primary, outline, quiet, soft, neutral, and dashed roles |
| Existing compact/general CTA contract | `ActionButton` | Reuse where already established; do not create a third rectangular button family |
| Circular icon action | `CircleIconButton` | Owns size, loading, pressed/disabled state, and centering |
| Square icon control | `IconControlButton` | Scanner, filters, and similar control-height actions |
| Compact chip/filter action | `PillButton` | Selected state must also be exposed through `aria-pressed` |
| Tabs or step progress | `SegmentedControl` | Pill tabs for Fridge/Shopping; progress variant for manual entry |
| Back or close | `BackButton` / `CloseButton` | Do not recreate chevrons, circles, or hit areas |
| Collapse | `CollapsibleSection` | Chevron stays left; badges/actions stay right |
| Bottom overlay | `BottomSheet` | Owns handle, title, focus, close behavior, safe area, and navigation clearance |
| Right-side data view | `RightSheet` | Search and full-content slide-in views |
| Sheet action row | `BottomSheetAction` | Owns row geometry and circular leading icon |
| Status feedback | `StatusMessage` | Info, success, warning, and danger; use approved friendly copy |
| Input-bound loading | `InputLoadingFrame` | Spinner appears inside the related input/select |
| General loading | `LoadingSpinner` | Never draw a feature-local spinner |
| Photo input | `PhotoUploadInput` | Single/multiple photo prompt, count, status, and validation |
| Toggle | `ToggleSwitch` | Boolean settings; do not use a checkbox as an on/off switch |
| Compact metadata badge | `TextBadge` | Owns centering, tone, padding, and truncation |
| Verified evidence | `VerifiedStatusBadge` | Detail/search contexts where verification helps a decision |
| Privileged group marker | `PrivilegedActionBadge` | One crown in the owning group header, not every child action |
| Centered icon wrapper | `CenteredIcon` | Required inner alignment layer for icon controls |
| Noninteractive circular icon | `CircularIconFrame` | Compose through a focused component such as `StatusIconBadge` |
| Pagination footer | `PaginatedListControls` | Explicit Load more and Return to top |
| Confirmation modal | `ConfirmationDialog` | Destructive or consequential decisions requiring explicit confirmation |
| Text-entry modal | `TextInputDialog` | Focused rename/edit prompt with shared validation and action layout |
| Repeated-tap safety | `TwoStepConfirmation` | In-place double activation such as ingredient deletion |
| Privileged action container | `PrivilegedActionGroup` | Groups moderator/admin actions and owns one crown |
| Numeric amount | `NumberInput` | Shared number semantics and control styling |
| Accelerating amount control | `AcceleratingStepButton` | Tap-by-one and progressive hold behavior |
| Full product image | `ProductImageFrame` | Contained, non-stretched detailed image |
| Image placement | `ImagePlacementEditor` | Shared preview, presets, drag/zoom, and restore flow |

When a need does not fit this table, first decide whether an existing component should
gain a reusable variant. Do not copy it and rename the copy.

## Ingredients Page Patterns

### Transient And Hidden Interaction Surfaces

The visual baseline includes every state that appears after an Ingredients interaction,
not only the default page.

| Surface | Current Ingredients implementation | Styling/behavior expectation |
| --- | --- | --- |
| Manual entry | `ManualEntrySheet` → `BottomSheet` | Full-height-capable bottom sheet, shared handle, no redundant top back arrow, state preserved while open |
| Sort/filter | `IngredientFilterSheet` → `BottomSheet` | Compact grouped controls, pill selections, one clear Apply action |
| Ingredient actions | `IngredientActionSheet` → `BottomSheet` | Reusable action rows; ordinary actions first and privileged group last |
| Image placement | `IngredientImagePlacementSheet` → `BottomSheet` | Shared editor and exact card preview; privileged treatment comes from the owning group |
| Search | `RightSheet` + `IngredientSearchView` | Full-content right-side view with shared shell and close behavior |
| Nutrition detail | `RightSheet` + `NutritionDetailView` | Full-content detail view using the same right-sheet bounds |
| Rename | `TextInputDialog` | Focused dialog with label, helper text/error, cancel, and save actions |
| Destructive confirmation | `TwoStepConfirmation` or `ConfirmationDialog` | Explain the required confirmation and never rely on color alone |
| Barcode scanner | `BarcodeScannerDialog` | High-contrast modal camera surface, trapped/restored focus, Escape close, manual-entry fallback |
| Category selection | `FoodCategoryPicker` | Searchable bounded panel; never a native select containing the entire catalog |
| Search suggestions/results | `SearchDropdown` / search cards | Bounded, readable result region with keyboard navigation and explicit loading/empty states |
| Autofill conflict | `BarcodeAutofillSuggestion` | Clear known-product summary and two direct choices; do not expose provider internals |
| Completion result | `CustomIngredientOutcome` | Polite live status plus compact next actions |

Major overlay states use readable path routes so reload, Back, and direct navigation are
predictable. Do not replace them with query-only state or an unaddressable local modal.

Overlay rules:

- A sheet/dialog is layered over the existing page and must not change the number,
  pagination, scroll height, or loaded state of cards underneath it.
- Opening an overlay does not trigger a background list refetch.
- Leaving and returning to the browser window does not close the overlay or clear form
  state.
- Backdrop dismissal requires an intentional press that begins and ends on the backdrop;
  Escape is supported where a keyboard exists.
- Modal focus moves inside, remains trapped, and returns to the opening control.
- Bottom sheets use `BottomSheet`; right-side full-content views use `RightSheet`;
  focused modal questions use the dialog primitives.
- Do not use a modal when an inline status or ordinary navigation is sufficient.
- Do not put major navigation flows in an anchored popover. If a genuinely lightweight
  anchored popover is needed, use the common `Popover` primitive and keep focus,
  dismissal, viewport collision, and accessible naming consistent.
- Scroll belongs to the overlay content, not to the obscured page.
- Backdrops use the shared sheet/dialog treatment; do not add shadows or feature-local
  opacity systems.

### Loading, Empty, And Disabled States

- A loading action keeps its label/geometry stable and uses the component's `busy`
  state.
- Input-specific loading appears inside `InputLoadingFrame`.
- Page/list loading uses `LoadingSpinner` with an accessible label or a surrounding live
  status.
- An empty list uses `IngredientEmptyState`; an empty search explains what was searched
  and offers a useful next action when available.
- Disabled controls remain readable and expose the actual disabled state.
- Loading must not replace valid existing content with a blank surface unless the
  content is no longer usable.
- A failed optional source lookup shows friendly reusable feedback and preserves any
  valid data already loaded.

### View Composition

- Route files own URL state, loaded data, and high-level composition.
- Use `ViewFrame`, `ViewHeader`, `ViewTop`, and `ViewBody` for the page shell rather than
  reconstructing max widths and scroll boundaries.
- Keep fixed app header and bottom navigation dimensions from the shell tokens.
- Open manual entry and filters through the path-backed sheet flow. An overlay must not
  resize or rerender the list beneath it.

### Ingredient Cards

Saved and search cards share the `IngredientCardLayout` mixins and media components.
They remain separate behavior components because their actions differ.

Current card rules:

- White panel, `1rem` radius, `5.25rem` minimum height, `0.85rem` compact padding.
- No default green border or tinted search-card background.
- Ingredient name uses heavy `1rem` interface type and one-line ellipsis on compact
  cards.
- Category/supporting copy uses muted `0.88rem` medium type and one-line ellipsis.
- Action buttons remain in the foreground action layer.
- A custom-food tint indicates a private unmatched item; it is not selection.
- Selection mode uses the reserved card border and an honest selected state. Do not show
  always-present checkboxes outside selection mode.
- A conflict uses the full-height amber `CardWarningEdge`, clipped by the card, with no
  compact warning icon or text. The card's accessible label includes the warning.

The card shell implementation lives in
`IngredientCardMediaLane/_IngredientCardLayout.scss`. Change shared card geometry there,
not separately in saved and search cards.

### Ingredient Card Media

`IngredientCardMedia` resolves the selected DB image, saved placement, alt text,
image-failure state, and category fallback. `IngredientCardMediaLane` owns clipping,
width, fallback surface, and the curved fade. Cards and image-placement previews use the
same lane and placement renderer so a saved preview matches the real card.

Current local geometry:

- Media lane width: `28cqw`.
- Copy inset: `18cqw` plus `$app-gap-xs`.
- Ingredient title: shifted toward the media by `$app-gap-lg`.
- Category/supporting copy: begins `$app-gap-sm` to the right of the ingredient title.
- Fade: radial ellipse from the left, solid through `35%`, soft at `55%`, transparent
  at `80%`.
- Fade shape: `100%` horizontal mask radius and `140%` vertical mask radius.
- Left corners follow the card; right corners remain square beneath the fade.
- Images and fallback symbols preserve aspect ratio and never stretch.
- Fallback symbols use the same media lane rather than a circular container.
- Fallback symbols are centered between the card's left edge and the ingredient title's
  actual shifted start, using the shared card-geometry calculation rather than a
  one-off offset.
- The warning edge stays above the media through its explicit z-index.
- The complete placement-preview card is the drag/pinch/wheel surface. Do not limit
  interaction to the masked media lane or let copy and fade layers create dead zones.

These are intentionally component-local values in
`IngredientCardMediaLane.scss` and `_IngredientCardLayout.scss`. They are not app-wide
tokens. When tuning the fade, update the shared lane so saved cards, search cards, and
placement previews remain identical.

### Search Results

- Search cards use the saved-card shell and media treatment, but retain search-specific
  add/open behavior.
- Results already in Fridge or Shopping do not show an add button.
- Verification may appear before adding because it informs the user's choice.
- Preference conflicts use the same warning edge as saved cards.
- Ranking, filtering, and pagination happen on the server; the client renders the
  ordered page.

### Manual Entry

- Use `BottomSheet` without the top back arrow; step controls already provide Back.
- Use `SegmentedControl` progress tabs and validate navigation through both tabs and
  Continue.
- Do not show required-field errors until the user attempts to advance.
- Use database/API reference data for fields, groups, units, categories, and rules.
- Required and optional treatment must use shared badges and field components.
- Use the standard `$app-gap-md` section rhythm and shared control heights.
- Group long optional nutrient sets in `CollapsibleSection`.
- Keep form state intact when the browser loses focus or the user returns from another
  window.
- `FoodCategoryPicker`, `PhotoUploadInput`, `NutritionLabelOcrInput`,
  `BarcodeAutofillSuggestion`, validation lists, toggles, and image placement are part
  of the baseline and must use their shared components rather than raw native styling.

### Nutrition Details

- Nutrition Facts may use the high-contrast data treatment and data font; it is an
  intentional domain-specific exception to the soft card palette.
- Product name is not truncated in the detailed view.
- Place source, verification, ingredients, allergens, and preference conflicts where
  users can understand them without crowding the nutrient table.
- Ingredients and “May contain” content remain plain text against the app background
  unless interaction or status requires a surface.
- Privileged image-placement actions live at the bottom in a collapsed privileged
  section with one crown in the heading.
- Full product imagery and attribution may appear in detail; compact thumbnails may omit
  attribution only when the detailed view exposes it.

## Feedback And User-Facing Messages

Use `StatusMessage` for visible status, validation, warning, and error content.

- **Info:** neutral guidance or non-blocking context.
- **Success:** completed action or confirmed state.
- **Warning:** a caution that does not represent invalid required input.
- **Danger:** missing required information, failed action, or blocking validation.

Business rules and evidence may come from the database, and server responses should use
stable safe codes. The client message catalog owns friendly wording. Never render raw
provider, database, stack, or network messages.

Compact ingredient conflicts do not use `StatusMessage`; they use `CardWarningEdge` and
an accessible action label. The full warning appears in the detailed view.
Detailed ingredient preference conflicts use the shared `StatusMessage` top-end icon
layout so the warning icon sits in the top-right while the title and reasons remain
left-aligned.

## Badges And Privileged Actions

- Use badges only when the state helps the current decision.
- Compact ingredient cards do not show provider-origin badges.
- Search may show verification because it affects whether a user adds a result.
- Nutrition detail may show verification and neutral source attribution.
- `Custom` means a private unmatched item the user deliberately kept; it does not mean
  every manual entry or every external-source record.
- Use one crown at the header of the nearest moderator/admin action group. Do not add a
  crown to every control inside it.

## Motion And Interaction

- Motion should explain change: sheet entry, list movement, selection, or loading.
- Keep transitions short and calm. Avoid decorative looping motion in task flows.
- Honor `prefers-reduced-motion`; the global stylesheet reduces animation and transition
  duration.
- Use pointer events for touch/mouse parity and keyboard equivalents for every action.
- Long press may enter ingredient selection mode, but the held card must also become
  selected and the interaction must not block normal navigation.
- Multi-item movement animates selected cards together in the destination direction.
- Do not refetch or reset a view when the browser regains focus.

## SCSS And File Ownership

The canonical structure is:

```text
components/<domain>/<Component>/
├── <Component>.svelte
├── <Component>.scss
└── types.ts
```

Only create the SCSS or type file when the component needs it.

- `_variables.scss` owns values shared by independent components.
- A component's paired SCSS owns its unique colors, dimensions, masks, radii, timing,
  and layout calculations.
- A repeated value inside one component may be a clearly named local SCSS variable.
- Promote a local value only when multiple independent components should change
  together.
- Use direct token values; do not build alias chains.
- Use BEM-style selectors: `.component`, `.component__part`,
  `.component--state`.
- Load the paired stylesheet from the component's scoped `<style lang="scss">` block.
- Do not create feature-global stylesheets or empty folders/files.
- Use `:global(...)` only when the owning wrapper must style rendered child/native
  content that Svelte scoping cannot reach. Keep the selector narrow and document the
  component boundary through naming.
- Runtime-measured placement may use component-owned CSS custom properties. Static
  styling remains in SCSS.

## Applying The System To A New View

Before styling a new view:

1. List the view's surfaces, actions, statuses, forms, lists, overlays, and detailed
   data.
2. Map each repeated need to the component-selection table.
3. Start with the Ingredients shell palette, typography, and `$app-gap-md` rhythm.
4. Reuse existing card, sheet, status, badge, loading, and control primitives.
5. Keep unique layout details in the new component's paired SCSS.
6. Check narrow mobile width, 200% text zoom, keyboard focus, reduced motion, and
   touch targets.
7. Compare visual differences with the Ingredients baseline. Keep a difference only
   when the view's purpose requires it.
8. If the difference is likely to repeat, create or extend a reusable component and
   update this guide.
9. If the difference establishes a new mandatory practice, propose or update a
   development rule.

Do not copy unfinished Mix or Saved Drinks markup/styles into a new view simply because
they already exist.

## Review Checklist

- [ ] Ingredients is the visual baseline used for the change.
- [ ] Existing primitives were checked before creating UI.
- [ ] Resting, loading, empty, disabled, error, overlay, dialog, and confirmation states
      were reviewed—not only the default screenshot.
- [ ] Colors and type use semantic global tokens.
- [ ] Repeated spacing uses `$app-gap-*`; unique geometry remains local.
- [ ] No box shadow or unexplained one-off global token was added.
- [ ] Focus, keyboard, touch, reduced motion, and 200% text zoom remain usable.
- [ ] Warnings, errors, loading, badges, and privileged actions use shared components.
- [ ] Cards, media, and placement previews still share exact geometry where required.
- [ ] New component styles live beside the component.
- [ ] Any intentional visual exception is documented.
- [ ] This guide was updated if the approved Ingredients baseline changed.

## Documentation Ownership

- **This guide:** Ingredients-derived visual language, token usage, component selection,
  and approved reusable presentation.
- **Development rules:** Mandatory engineering, accessibility, reuse, security, and data
  requirements.
- **UI functionality brief:** Product behavior that must survive a visual redesign.
- **Project structure:** File and domain ownership.
- **QA files:** Concrete verification steps, not permanent style policy.

Do not duplicate the full style system in another document. Link here and keep
feature-specific behavior in the feature's own documentation.
