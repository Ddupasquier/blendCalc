# blendCalc Style Guide

## Purpose And Scope

This is the maintained visual implementation guide for blendCalc. It records the
styling decisions that are already working in the **Ingredients** experience so a new
view can begin from an established system instead of recreating and correcting the same
patterns. The Ingredients experience includes its resting page, transient states,
buttons, dropdowns, popovers, sheets, dialogs/modals, scanner, loading and empty states,
confirmation flows, nutrition details, and privileged controls.

The current Ingredients page, ingredient search, manual entry, nutrition details, and
their shared components are the only visual reference for this guide. Mix, Saved Recipes,
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
7. Never derive a new global rule from unfinished Mix, Saved Recipes, Profile, or
   Moderation UI.
8. Compare every UI change with the closest approved Ingredients pattern before and
   after implementation. Review all applicable states and every consumer of a changed
   shared primitive; visual cohesion is required for handoff rather than deferred
   cleanup.

Keep this guide focused on current decisions. Remove superseded guidance when a pattern
changes; do not preserve competing generations of the same visual system.

## Guide Navigation

| Area | Sections |
| --- | --- |
| Foundations | [Visual direction](#visual-direction), [color](#color-system), and [typography](#typography) |
| Layout | [Spacing and layout](#spacing-and-layout), [borders and focus](#borders-focus-and-depth), and responsive rules |
| Reusable UI | [Component selection](#component-selection), [feedback](#feedback-and-user-facing-messages), [badges](#badges-and-privileged-actions), and [motion](#motion-and-interaction) |
| Ingredients reference | [Ingredients page patterns](#ingredients-page-patterns), including cards, media, search, manual entry, and nutrition details |
| Implementation | [SCSS ownership](#scss-and-file-ownership), [applying the system](#applying-the-system-to-any-ui-change), and the [review checklist](#review-checklist) |

## Sources Of Truth

Use this order when implementing or reviewing styling:

1. [`dev-rules/dev-rules.md`](dev-rules/dev-rules.md) for mandatory rules.
2. This guide for the approved Ingredients visual language and component selection.
3. [`src/styles/_variables.scss`](../src/styles/_variables.scss) for exact app-wide
   values.
4. The reusable component and its paired SCSS file for component behavior and local
   geometry.
5. [`project-structure.md`](project-structure.md) for file ownership.
6. [`ui-functionality.md`](ui-functionality.md) and its matching view contract for
   behavior that a redesign must preserve.

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

### Theme Contract

The app supports `system`, `light`, and `dark` appearance preferences. `system` follows
the device color-scheme setting; explicit light or dark choices remain stable across
devices through the authenticated profile.

- Global semantic color roles are declared as CSS custom properties in
  `src/styles/_themes.scss`.
- Existing SCSS consumers continue to use the `$app-*` roles in
  `src/styles/_variables.scss`; those roles resolve to the runtime theme properties.
- New components must use semantic roles rather than branch their markup or styles by
  theme.
- Theme-sensitive page, surface, text, action, border, focus, status, and overlay
  colors must not be written as component literals. Add or reuse a semantic theme role.
- High-contrast data artifacts such as the Nutrition Facts label may intentionally
  remain black on white when that presentation is part of the artifact itself. Keep
  their fixed palette isolated inside the artifact rather than exposing fixed colors as
  app-wide theme roles.
- Fixed illustration, image-mask, camera-viewport, and theme-preview colors may remain
  component-local only when they describe the visual asset itself and remain legible
  independently of the surrounding theme.
- Product images, food symbols, warnings, errors, success states, focus indicators,
  disabled controls, overlays, and transparent media must remain legible in both themes.
- Theme previews in Profile communicate the choice but do not create a second palette or
  component system.

### Ingredients Shell Palette

These are the primary colors for new and rebuilt views.

| Role                   | Token                         | Value                 | Use                                                     |
| ---------------------- | ----------------------------- | --------------------- | ------------------------------------------------------- |
| Page                   | `$app-shell-surface-page`     | `#f8f8fb`             | App canvas, route and right-sheet background            |
| Panel                  | `$app-shell-surface-panel`    | `#fff`                | Cards, sheet panels, raised-by-contrast content         |
| Control                | `$app-shell-surface-control`  | `#e9e9ed`             | Quiet controls, inactive tabs, neutral inputs           |
| Soft surface           | `$app-shell-surface-soft`     | `#f8f7f5`             | Subtle active or grouped content surface                |
| Primary text           | `$app-shell-text-primary`     | `#1a1a2e`             | Titles, labels, important values                        |
| Muted text             | `$app-shell-text-muted`       | `#70758d`             | Descriptions, metadata, helper text                     |
| Text on primary accent | `$app-shell-text-on-accent`   | `#11141c`             | Copy and icons on primary green actions                 |
| Text on custom accent  | `$app-shell-text-on-custom`   | `#fff`                | Copy and icons on custom/private accents                |
| Text on danger accent  | `$app-shell-text-on-danger`   | `#fff`                | Copy and icons on destructive accents                   |
| Text on media          | `$app-shell-text-on-media`    | `#fff`                | Copy over fixed dark camera or image media              |
| Primary accent         | `$app-shell-accent-primary`   | `#57a773`             | Primary action, active state, success emphasis          |
| Soft accent            | `$app-shell-accent-soft`      | `#e8f5ee`             | Active soft state, fallback-media lane, success surface |
| Informational accent   | `$app-shell-accent-info`      | `#347b99`             | Informational icon or source treatment                  |
| Danger accent          | `$app-shell-accent-danger`    | `#d43f3f`             | Destructive action                                      |
| Subtle border          | `$app-shell-border-subtle`    | `rgba(0, 0, 0, 0.08)` | Neutral control and panel boundaries                    |
| Overlay backdrop       | `$app-shell-overlay-backdrop` | `rgba(0, 0, 0, 0.42)` | Shared sheet, dialog, and tutorial scrim                |

The values above describe the light palette. The matching dark values live beside them
in `_themes.scss`; component code consumes the same semantic roles in either theme.
The Nutrition Facts artifact owns its fixed paper and ink locally and must not reuse a
theme surface as permanent black-label paper.

### Semantic Supporting Colors

| Role                  | Token                  | Value     | Use                                               |
| --------------------- | ---------------------- | --------- | ------------------------------------------------- |
| Warning amber         | `$app-highlight`       | `#f4b942` | Ingredient-card warning edge and privileged crown |
| Warning hover/strong  | `$app-highlight-hover` | `#d99a24` | Strong warning emphasis, not ordinary copy        |
| Error base            | `$app-danger-bg`       | `#e7b0b8` | Source color for error surfaces                   |
| Destructive brown-red | `$app-danger-action`   | `#9c5f46` | Destructive/strong error treatment                |
| Warning base          | `$app-warning-bg`      | `#efc6a9` | Source color for warning surfaces                 |
| Custom base           | `$app-custom-bg`       | `#cbb8e8` | Private unmatched custom-food tint                |
| Custom strong         | `$app-custom-strong`   | `#7b5fa3` | Custom-food text/accent where needed              |

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

| Purpose   | Token                        | Use                                                                    |
| --------- | ---------------------------- | ---------------------------------------------------------------------- |
| Interface | `$app-font-family-interface` | Body copy, controls, labels, metadata                                  |
| Display   | `$app-font-family-display`   | Page titles, major sheet titles, prominent headings                    |
| Data      | `$app-font-family-data`      | Nutrition Facts and dense numeric data where narrow forms aid scanning |

### Weights

| Token                       | Value | Typical use                                     |
| --------------------------- | ----- | ----------------------------------------------- |
| `$app-font-weight-regular`  | `400` | Long-form/body copy                             |
| `$app-font-weight-medium`   | `600` | Helper text and supporting metadata             |
| `$app-font-weight-semibold` | `700` | Section emphasis                                |
| `$app-font-weight-bold`     | `800` | Buttons, labels, collapse headings              |
| `$app-font-weight-heavy`    | `900` | Ingredient-card names and page-display emphasis |

### Sizes

| Token                | Value     | Typical use                                 |
| -------------------- | --------- | ------------------------------------------- |
| `$app-font-size-2xs` | `0.68rem` | Dense secondary data only                   |
| `$app-font-size-xs`  | `0.76rem` | Badges, progress tabs, compact labels       |
| `$app-font-size-sm`  | `0.88rem` | Metadata, helper text, compact controls     |
| `$app-font-size-md`  | `1rem`    | Inputs, buttons, card names, normal UI      |
| `$app-font-size-lg`  | `1.08rem` | Sheet and section headings                  |
| `$app-font-size-xl`  | `1.25rem` | Prominent content and fallback food symbols |
| `$app-font-size-2xl` | `1.5rem`  | Compact page titles and major card emphasis |
| `$app-font-size-3xl` | `2.1rem`  | Large data headings such as Nutrition Facts |
| `$app-font-size-4xl` | `2.75rem` | Maximum landing-page display size           |

Page titles use `$app-font-size-page-title` (`clamp(1.5rem, 7vw, 2.1rem)`). The landing
hero uses `$app-font-size-hero-title` (`clamp(2.1rem, 7vw, 2.75rem)`). These semantic
roles preserve fluid scaling without allowing each route to invent a different clamp.

### Line Heights

| Token                       | Value  | Typical use                                      |
| --------------------------- | ------ | ------------------------------------------------ |
| `$app-line-height-none`     | `0`    | Inner wrappers that must contribute no text box  |
| `$app-line-height-tight`    | `1`    | Icons, badges, and single-line compact data      |
| `$app-line-height-heading`  | `1.1`  | Display headings and compact multiline labels    |
| `$app-line-height-compact`  | `1.2`  | Dense metadata and short supporting information  |
| `$app-line-height-ui`       | `1.35` | Standard interface copy, prompts, and form help  |
| `$app-line-height-body`     | `1.45` | Longer reading content and descriptive paragraphs |

### Tracking

| Token                        | Value     | Typical use                                  |
| ---------------------------- | --------- | -------------------------------------------- |
| `$app-letter-spacing-tight`  | `-0.04em` | Display-heading optical tightening           |
| `$app-letter-spacing-normal` | `0`       | Explicitly neutral tracking                  |
| `$app-letter-spacing-data`   | `0.01em`  | Numeric and Nutrition Facts data             |
| `$app-letter-spacing-label`  | `0.04em`  | Metadata labels                              |
| `$app-letter-spacing-wide`   | `0.08em`  | Uppercase eyebrow and status emphasis        |
| `$app-letter-spacing-wider`  | `0.1em`   | Rare high-emphasis uppercase section markers |

The root size is `$app-font-size-base` (`16px`). Do not invent nearby font sizes to make
one label fit. First use the existing scale, fix layout constraints, and allow safe
wrapping or truncation where the context requires it.

Every application `font-family`, `font-size`, `font-weight`, `line-height`, and
`letter-spacing` declaration uses this semantic scale. Components may explicitly
inherit typography, but they do not introduce raw substitute values. Buttons use the
shared button family, `800` weight, and `1.1` line height.

## Spacing And Layout

### Shared Spacing Scale

| Token                     | Value      | Use                                                               |
| ------------------------- | ---------- | ----------------------------------------------------------------- |
| `$app-gap-lg`             | `1.5rem`   | Major view or section separation                                  |
| `$app-gap-md`             | `0.75rem`  | Standard Ingredients rhythm between sections, cards, and controls |
| `$app-gap-sm`             | `0.5rem`   | Related controls and card actions                                 |
| `$app-gap-xs`             | `0.3rem`   | Tight label/icon and heading relationships                        |
| `$app-gap-2xs`            | `0.15rem`  | Card title-to-subtitle relationship                               |
| `$app-gap-micro`          | `0.06rem`  | Rare optical separation                                           |
| `$app-gap-inline-compact` | `0.2rem`   | Compact inline content                                            |
| `$app-gap-badge-inline`   | `0.176rem` | Badge-to-title relationship                                       |

`$app-gap-md` is the default repeated gap. Choose another value because the relationship
is semantically tighter or broader—not because a screenshot is a few pixels different.

### Shell Geometry

| Decision                       | Token                              | Value                   |
| ------------------------------ | ---------------------------------- | ----------------------- |
| Overall max width              | `$app-max-width`                   | `600px`                 |
| Main content max width         | `$app-shell-content-max-width`     | `520px`                 |
| Header height                  | `$app-shell-header-height`         | `4rem`                  |
| Narrow-phone header height     | `$app-shell-header-height-compact` | `3.5rem`                |
| Bottom navigation height       | `$app-shell-nav-height`            | `4.85rem`               |
| Narrow-phone navigation height | `$app-shell-nav-height-compact`    | `4.25rem`               |
| Horizontal shell padding       | `$app-shell-padding-x`             | `1rem`                  |
| Vertical shell padding         | `$app-shell-padding-y`             | `1.2rem`                |
| Width breakpoints              | `$app-breakpoint-xs/sm/md`         | `420px / 520px / 680px` |
| Compact-height breakpoint      | `$app-breakpoint-height-compact`   | `700px`                 |

Account for `env(safe-area-inset-*)`, keep a `vh` fallback before `dvh`, and do not
introduce horizontal overflow at narrow widths or 200% text zoom.

### App-Wide Responsive Contract

The visual language remains derived from the completed Ingredients experience, but its
responsive contract applies to every route and shared primitive.

| Trigger                                          | Intended response                                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Up to `$app-breakpoint-xs` (`420px`)             | Compact phone geometry; stack crowded actions and narrow form columns; reduce repeated card/surface padding where documented        |
| Up to `$app-breakpoint-sm` (`520px`)             | Collapse layouts that need more than one comfortable phone column; keep overlays and popovers inside viewport edges                 |
| Up to `$app-breakpoint-md` (`680px`)             | Collapse tablet/desktop split panels and multi-column workflow regions                                                              |
| Up to `$app-breakpoint-height-compact` (`700px`) | Reduce fixed chrome, repeated vertical rhythm, and overlay padding without automatically treating a wide landscape screen as narrow |

At the compact width or height tier, the fixed header/navigation, authenticated route
shell, shared sheets/dialogs/popovers, common controls, and feature-specific compact
layouts use coordinated geometry. This is a system change, not independent one-off
overrides. Primary controls remain at least `2.75rem` (`44px`), normal body text remains
readable, and safe-area insets remain part of every fixed or modal boundary. Documented
compact controls may be visually smaller only when they remain distinct, operable, and
at least the WCAG 2.2 minimum target size.

Compact density comes primarily from smaller repeated gaps, panel padding, headings,
metadata, and decorative frames—not from making primary tap targets unusable. Bottom
sheets hug short content by default, use their bounded internal scroller when content is
long, and occupy the larger fixed-height surface only when a workflow explicitly requests
the `fill` mode. Dialogs, popovers, upload controls, disclosures, card groups, and route
panels use the same compact tier rather than retaining desktop-sized internal spacing.

Use width and height queries for different jobs. Width queries may stack columns,
actions, and form fields. Compact-height queries reduce vertical gaps, padding, fixed
chrome, and overlay framing; do not stack a wide landscape layout merely because it is
short. Prefer fluid `min()`, `max()`, `clamp()`, bounded grids, and wrapping before
adding another breakpoint.

Every page and overlay must be checked at `320px × 568px`, `360px × 740px`,
`390px × 844px`, `420px × 844px`, `740px × 360px`, tablet, desktop, and 200% text
zoom. Content must remain reachable without horizontal page scrolling. Fixed controls,
dialogs, sheets, popovers, and notifications preserve safe areas and never cover their
own required actions.

On those compact Ingredients layouts, downward saved-list scrolling retracts the page
title, search toolbar, and manual-entry launcher upward so the list receives more usable
space. A short upward scroll reveals that complete region by animating it downward
without requiring the user to return to the first card. The Fridge/Shopping List tabs
remain available, switching lists restores the region, and reduced-motion preferences
remove the transition without changing the visibility behavior. Wider layouts keep the
complete region visible.

The compact Mix page uses the same `ViewFrame`, `ViewTop`, and `ViewBody` shell contract
as Ingredients. Only its main scroll surface owns header direction changes. Downward
movement there retracts the title, supporting copy, status, and header actions; a short
upward movement there reveals the complete header before the page returns to its top.
Scrolling inside the bounded Add Ingredients and Selected Ingredients lists never
changes header visibility. The main tracker pauses and rebases while header geometry
settles so the animation cannot shudder or immediately reverse itself. Wider Mix layouts
keep the header visible.

Top-level Mix sections place panel padding inside the animated disclosure body rather
than around the whole collapse. A closed section therefore occupies only the shared
summary control height and section border; opening it restores the normal tokenized body
inset without changing the summary target or introducing a second panel shell.

The compact manual-entry action is one `44px` pencil-only button in the same toolbar row
as Search, Barcode, and Filters. It uses the shared rounded icon-control shape and keeps
the full accessible name `Enter a custom ingredient manually`; the larger launcher row
is not shown at that tier. The compact Fridge/Shopping List segmented control uses
shorter visual pills, smaller labels, and tighter count badges. The outer track uses
the same pill radius as its child tabs. Its outer padding and expanded hit area keep
each tab's combined touch target at least `44px`. Switching lists slides one shared
selected surface horizontally between the tabs. That surface first stretches across the
full inner track, retracts into the destination tab, and finishes with one small damped
jiggle. The liquid motion communicates the spatial change without moving or distorting
the labels, counts, focus targets, or tab semantics. Reduced motion keeps the state
change immediate.

Treat `360px × 740px` as the reference compact portrait viewport and continue supporting
`320px × 568px` phones plus short landscape windows. Widths between the shared
breakpoints remain fluid. At and beyond the `680px` content breakpoint, the Ingredients
column stays centered at its intentional maximum width rather than stretching cards
across tablets, desktops, and ultrawide displays. Do not add device-brand breakpoints;
add a content or height breakpoint only when the layout actually changes.

### Controls And Surfaces

| Decision                       | Token                               | Value     |
| ------------------------------ | ----------------------------------- | --------- |
| Standard control height        | `$app-shell-control-height`         | `2.95rem` |
| Narrow-phone control height    | `$app-shell-control-height-narrow`  | `2.75rem` |
| Compact control height         | `$app-shell-control-height-compact` | `2.15rem` |
| Standard horizontal padding    | `$app-shell-control-padding-x`      | `0.85rem` |
| Card radius                    | `$app-shell-radius-card`            | `1rem`    |
| Control radius                 | `$app-shell-radius-control`         | `1rem`    |
| Sheet radius                   | `$app-shell-radius-sheet`           | `1.35rem` |
| Pill radius                    | `$app-shell-radius-pill`            | `999px`   |
| Compact card padding           | `$app-shell-card-padding-compact`   | `0.85rem` |
| Ingredient card minimum height | `$app-shell-card-min-height`        | `5.25rem` |
| Circular action size           | `$app-shell-action-icon-size`       | `2.2rem`  |

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

| Need                                  | Use                          | Notes                                                                                               |
| ------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| Main rectangular CTA                  | `RoundedActionButton`        | Current Ingredients action shape; supports primary, outline, quiet, soft, neutral, and dashed roles |
| Existing compact/general CTA contract | `ActionButton`               | Reuse where already established; do not create a third rectangular button family                    |
| Circular icon action                  | `CircleIconButton`           | Default for every icon-only action; owns size, loading, pressed/disabled state, and centering       |
| Clustered icon control                | `IconControlButton`          | Squarish exception for dense horizontal toolbar/input rows such as Search, Barcode, and Filters     |
| Compact chip/filter action            | `PillButton`                 | Selected state must also be exposed through `aria-pressed`                                          |
| Tabs or step progress                 | `SegmentedControl`           | Pill tabs for Fridge/Shopping; progress variant for manual entry                                    |
| Back or close                         | `BackButton` / `CloseButton` | Do not recreate chevrons, circles, or hit areas                                                     |
| Collapse                              | `CollapsibleSection`         | Chevron stays left; badges/actions stay right; shared open/close motion preserves mounted content   |
| Specialized disclosure indicator      | `DisclosureChevron`          | Right when closed, animated down when open; use instead of local chevron rotation                    |
| Bottom overlay                        | `BottomSheet`                | Owns handle, title, focus, close behavior, safe area, and navigation clearance                      |
| Right-side data view                  | `RightSheet`                 | Search and full-content slide-in views                                                              |
| Sheet action row                      | `BottomSheetAction`          | Owns row geometry and circular leading icon                                                         |
| Status feedback                       | `StatusMessage`              | Info, success, warning, and danger; use approved friendly copy                                      |
| Input-bound loading                   | `InputLoadingFrame`          | Spinner appears inside the related input/select                                                     |
| General loading                       | `LoadingSpinner`             | Never draw a feature-local spinner                                                                  |
| Photo input                           | `PhotoUploadInput`           | Single/multiple photo prompt, count, status, and validation                                         |
| Toggle                                | `ToggleSwitch`               | Boolean settings; do not use a checkbox as an on/off switch                                         |
| Fixed-choice dropdown                 | `SelectField`                | Accessible combobox and top-layer listbox with shared label, helper, keyboard/typeahead, focus, disabled, and responsive states; a hidden native select preserves required validation and form submission |
| Compact metadata badge                | `TextBadge`                  | Owns centering, tone, padding, and truncation                                                       |
| Structured metadata pill              | `MetadataPill`               | Ingredient labels, kcal, goal progress, and other compact label/value or label/icon metadata        |
| Verified evidence                     | `VerifiedStatusBadge`        | Detail/search contexts where verification helps a decision                                          |
| Privileged group marker               | `PrivilegedActionBadge`      | One crown in the owning group header, not every child action                                        |
| Centered icon wrapper                 | `CenteredIcon`               | Required inner alignment layer for icon controls                                                    |
| Noninteractive circular icon          | `CircularIconFrame`          | Compose through a focused component such as `StatusIconBadge`                                       |
| Progressive list footer               | `PaginatedListControls`      | Explicit Load more and Return to top; never numbered page navigation                                |
| List filter/sort sheet                 | `ListSortSheet`              | Route-backed bottom sheet; may combine optional `Show` filters with sorting                          |
| Confirmation modal                    | `ConfirmationDialog`         | Destructive or consequential decisions requiring explicit confirmation                              |
| Text-entry modal                      | `TextInputDialog`            | Focused rename/edit prompt with shared validation and action layout                                 |
| Guided feature tour                   | `TutorialOverlay`            | Route-aware modal guidance with one rounded spotlight and a collision-aware instruction card        |
| Repeated-tap safety                   | `TwoStepConfirmation`        | In-place double activation such as ingredient deletion                                              |
| Privileged action container           | `PrivilegedActionGroup`      | Groups privileged moderator, admin, or developer actions and owns one crown                         |
| Numeric amount                        | `NumberInput`                | Shared number semantics and control styling                                                         |
| Draggable numeric range               | `RangeInput`                 | Native range semantics with shared track, fill, thumb, focus, disabled, and semantic-tone states    |
| Accelerating amount control           | `AcceleratingStepButton`     | Tap-by-one and progressive hold behavior                                                            |
| Full product image                    | `ProductImageFrame`          | Contained, non-stretched detailed image using any saved moderator orientation correction             |
| Image placement                       | `ImagePlacementEditor`       | Shared preview, presets, drag/zoom, and restore flow                                                |

When a need does not fit this table, first decide whether an existing component should
gain a reusable variant. Do not copy it and rename the copy.

## Ingredients Page Patterns

### Transient And Hidden Interaction Surfaces

The visual baseline includes every state that appears after an Ingredients interaction,
not only the default page.

| Surface                    | Current Ingredients implementation              | Styling/behavior expectation                                                                             |
| -------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Manual entry               | `ManualEntrySheet` → `BottomSheet`              | Full-height-capable bottom sheet, shared handle, no redundant top back arrow, state preserved while open |
| Sort/filter                | `IngredientFilterSheet` → `BottomSheet`         | Compact grouped controls, pill selections, one clear Apply action                                        |
| Ingredient actions         | `IngredientActionSheet` → `BottomSheet`         | Reusable action rows; ordinary actions first and privileged group last                                   |
| Image placement            | `IngredientImagePlacementSheet` → `BottomSheet` | Shared editor and exact card preview; privileged treatment comes from the owning group                   |
| Search                     | `RightSheet` + `IngredientSearchView`           | Full-content right-side view with shared shell and close behavior                                        |
| Nutrition detail           | `RightSheet` + `NutritionDetailView`            | Full-content detail view using the same right-sheet bounds; static food information and list actions come first, every disclosure is grouped at the bottom, and privileged disclosures remain last |
| Rename                     | `TextInputDialog`                               | Focused dialog with label, helper text/error, cancel, and save actions                                   |
| Destructive confirmation   | `TwoStepConfirmation` or `ConfirmationDialog`   | Explain the required confirmation and never rely on color alone                                          |
| Barcode scanner            | `BarcodeScannerDialog`                          | High-contrast modal camera surface, trapped/restored focus, Escape close, manual-entry fallback          |
| Category selection         | `FoodCategoryPicker`                            | Searchable bounded panel; never a native select containing the entire catalog                            |
| Search suggestions/results | `SearchDropdown` / search cards                 | Bounded, readable result region with keyboard navigation and explicit loading/empty states               |
| Autofill conflict          | `BarcodeAutofillSuggestion`                     | Clear known-product summary and two direct choices; do not expose provider internals                     |
| Completion result          | `CustomIngredientOutcome`                       | Polite live status plus compact next actions                                                             |

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
- Every overlay is bounded by the usable viewport with a `vh` fallback before `dvh`,
  safe-area-aware padding, and internally scrollable content. Compact-height layouts
  reduce overlay chrome and spacing before content becomes unreachable.
- Dialog action rows may stack at narrow widths. Anchored popovers must cap both width
  and height to the viewport and scroll internally instead of rendering off-screen.
- Backdrops use the shared sheet/dialog treatment; do not add shadows or feature-local
  opacity systems.
- Guided tutorial steps use one rounded cutout in that backdrop plus the shared accent
  outline. The cutout keeps at least `0.5rem` of clear space around the target, mirrors
  the target's computed corner geometry, and stays inside the owning view frame. The
  instruction card is a token-backed panel without shadow, moves above or below the
  target when space permits, remains usable when a target is unavailable, and never
  makes the obscured page interactive while the tour is modal.
- A tutorial target is one direct control, card, input, chart, or disclosure summary.
  Do not spotlight a full page section when a single representative child can teach
  the behavior. Use consecutive steps to move from a card into its specific action.
- Tutorial route changes scroll the target into view without resetting route data.
  Each step marks and visually focuses its current target automatically, while keyboard
  focus remains inside the tutorial card. The app header, navigation, and route content
  stay inert, and document scrolling stays locked, until the modal tour closes.
  Compact-height layouts keep every tutorial action reachable, and reduced-motion
  preferences remove spotlight/card movement without changing the step sequence.

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

- White panel, `1rem` radius, `5.25rem` standard minimum height, and `0.85rem`
  compact padding.
- At `420px` and below—or at the compact-height breakpoint—the shared card shell uses a
  local `4.1rem` minimum height, `$app-gap-sm` padding, tighter shared gaps, `0.88rem`
  ingredient names, `0.76rem` supporting copy, and `2rem` visual card controls without
  changing media placement.
- Compact card controls may be visually smaller than toolbar controls, but must remain
  distinct, operable, non-overlapping, and at least the WCAG minimum target size.
- No default green border or tinted search-card background.
- Ingredient names use heavy `1rem` interface type normally and the shared compact-card
  size on narrow or short screens, with one-line ellipsis in both states.
- Category/supporting copy uses muted `0.88rem` medium type and one-line ellipsis.
- When a card has one dominant action, its native primary target covers the full card
  surface rather than only its title, image, or copy. Visible copy remains
  presentational, and explicit add, move, menu, delete, share, or disclosure controls
  stay in the foreground action layer and retain priority.
- Static cards and form cards with multiple equal controls do not receive a synthetic
  full-card action.
- A custom-food tint indicates a private unmatched item; it is not selection.
- Selection mode uses the reserved card border and an honest selected state. Do not show
  always-present checkboxes outside selection mode.
- A conflict uses the full-height amber `CardWarningEdge`, clipped by the card, with no
  compact warning icon or text. The card's accessible label includes the warning.

The card shell and shared primary-target interaction layers live in
`IngredientCardMediaLane/_IngredientCardLayout.scss`. Change shared card geometry or
target layering there, not separately in saved and search cards.

### Ingredient Card Media

`IngredientCardMedia` resolves the selected DB image, saved placement, alt text,
image-failure state, and category fallback. `IngredientCardMediaLane` owns clipping,
width, fallback surface, and the curved fade. Cards and image-placement previews use the
same lane and placement renderer so a saved preview matches the real card.
The shared placement editor offers full-image and fill-card presets, clockwise
90-degree rotation, direct manipulation, range controls, and restore. Rotation is part
of the saved placement and the preview must use the same rotated geometry as the
rendered card.

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
- `SelectField`, `FoodCategoryPicker`, `PhotoUploadInput`, `NutritionLabelOcrInput`,
  `BarcodeAutofillSuggestion`, validation lists, toggles, and image placement are part
  of the baseline and must use their shared components rather than raw native styling.

### Nutrition Details

- Nutrition Facts may use the high-contrast data treatment and data font; it is an
  intentional domain-specific exception to the soft card palette.
- Product name is not truncated in the detailed view.
- Place source, verification, ingredients, allergens, and preference conflicts where
  users can understand them without crowding the nutrient table.
- Treat the detail view as the complete user-facing food record: show every available
  useful product, serving, disclosure, and neutral source field; hide absent fields
  cleanly rather than adding empty rows or placeholders.
- Keep the default reading path focused on the product image, current personalized
  warning, Nutrition Facts, ingredients, and explicit package disclosures. Group
  supporting data quality, product/source metadata, and user-reporting tools under one
  closed `More about this food` disclosure.
- Group product, serving, and source metadata inside the shared `Product details`
  collapse within that supporting area and keep it closed by default.
- Show the shared `Data quality` collapse only when bounded source-record metadata has
  a useful caveat. Keep it closed by default, describe source-reported completeness or
  review notes in friendly language, and never expose raw provider quality tags or
  scores. This disclosure is separate from blendCalc field verification.
- Keep field sources, attribution, and licence details in `Product details`; do not
  duplicate that legal/source context inside `Data quality`.
- Show one server-computed compatibility status when available. Keep it visually
  separate from `Contains` and `May contain`, use the shared status-message treatment,
  and distinguish conflict, checked, incomplete, and not-checked states without
  presenting any state as a safety guarantee.
- When specific personalized warnings are available, show those concise reasons and do
  not repeat a generic conflict status directly below them. Keep evidence, policy
  context, and per-warning report controls in one closed `Review these warnings`
  disclosure inside the warning surface.
- Ingredients, `Contains`, `May contain`, source-backed dietary labels, and reviewed
  dietary considerations remain plain text against the app background unless
  interaction or status requires a surface. Do not expose internal match expressions,
  policy identifiers, or provider analysis jargon.
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
left-aligned. Keep the immediate reasons concise; exact evidence and correction controls
belong in the closed `Review these warnings` disclosure rather than repeating a full
reporting interface for every warning in the default view.

## Badges And Privileged Actions

- Use badges only when the state helps the current decision.
- Compact ingredient cards do not show provider-origin badges.
- Search may show verification because it affects whether a user adds a result.
- Nutrition detail may show verification and neutral source attribution.
- `Custom` means a private unmatched item the user deliberately kept; it does not mean
  every manual entry or every external-source record.
- Use one crown at the header of the nearest privileged action group. Do not add a
  crown to every control inside it.

## Motion And Interaction

- Import shared durations, easing curves, reduced-motion helpers, and reusable motion
  behaviors from `src/lib/utils/animation`. Equivalent state, press, feedback,
  disclosure, and layout motion must not use independently typed timing literals.
- Keep a genuinely unique sequence with the reusable component that owns it. Scanner
  sweeps, loading rotation, liquid segmented-control movement, chart geometry, and
  other single-purpose keyframes do not become one generic animation merely because
  they move. Name their local timing values so the sequence remains internally
  consistent.
- Motion should explain change: sheet entry, list movement, selection, or loading.
- Every disclosure animates both opening and closing through the shared
  `animatedDetails` behavior. Keep disclosure children mounted so closing a section
  never discards unsaved form or image-placement state.
- Animate the complete disclosure boundary rather than an arbitrary content child.
  Child margins and padding vary between disclosures; the shared boundary animation
  prevents delayed gaps, clipped content, and end-of-motion snapping.
- Rapidly reversing a disclosure must continue from its currently visible height.
  Do not add component-specific collapse transitions or opacity delays on top of the
  shared behavior.
- Disclosure expansion and collapse must not re-anchor the owning scroll surface or
  move users away from the summary they activated. Shared disclosure and route scroll
  containers disable browser scroll anchoring where animated height changes occur.
- Pair functional entrances with coherent exits. Status feedback may use a brief
  opacity/vertical transition, sheets use the shared directional transition, and
  removed list items must be followed by local reflow rather than a flashing reload.
- State changes such as chevrons, toggles, and scanner expansion transition in both
  directions. Keep both visual states mounted when removing one would make the reverse
  transition impossible.
- Shared collapse chevrons point right when closed and rotate downward when open. The
  rotation transitions in both directions and becomes immediate under the global
  reduced-motion preference.
- Keep transitions short and calm. Avoid decorative looping motion in task flows.
- Honor `prefers-reduced-motion`; CSS is covered globally and every Svelte or Web
  Animations API duration must use the shared motion helper or an equivalent explicit
  reduced-motion branch.
- Loading spinners, scanner sweeps, timers, and other process indicators may loop only
  while the process is active. They do not need a delayed outro that would make the UI
  feel slower.
- Use pointer events for touch/mouse parity and keyboard equivalents for every action.
- During pointer or touch reordering, keep the active surface continuously attached to
  the pointer. Move its reserved insertion slot only after crossing a neighboring
  surface's center, and animate displaced siblings rather than snapping the active
  surface into every candidate slot.
- Long press may enter ingredient selection mode, but the held card must also become
  selected and the interaction must not block normal navigation.
- Multi-item movement uses a short top-to-bottom stagger. Each selected card makes a
  subtle opposite-direction wind-up before exiting toward the destination, while the
  underlying bulk move remains one coordinated update.
- Moving ingredient cards render above the list's clipping boundary; do not expose the
  full list overflow or crop the card as it exits.
- Do not refetch or reset a view when the browser regains focus.

## Visual Regression Review

- Use the tracked Playwright snapshots described in
  [Browser Testing](browser-testing.md) for stable, approved view composition.
- Keep baselines narrow and intentional. Mask changing provider imagery when image pixels
  are not the visual contract, and never update a snapshot without reviewing its diff.
- Rendered browser checks complement this guide; they do not authorize changing approved
  tokens, spacing, typography, or component contracts merely to make a snapshot pass.

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
- A component's paired SCSS owns its unique colors, dimensions, masks, radii, motion
  sequence, and layout calculations. Shared motion timing and easing come from the
  animation catalog rather than local literals.
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

## Applying The System To Any UI Change

This is the UI-specific application of the
[Canonical Change Lifecycle](dev-rules/dev-rules.md#canonical-change-lifecycle). Before
editing a view or component:

1. Map the complete affected state matrix, then list its surfaces, actions, statuses,
   forms, lists, overlays, and detailed data.
2. Classify the existing owners as keep, simplify, merge, replace, or delete before
   adding another wrapper or component.
3. Map each repeated need to the component-selection table.
4. Start with the Ingredients shell palette, typography, and `$app-gap-md` rhythm.
5. Reuse existing card, sheet, status, badge, loading, and control primitives.
6. Keep unique layout details in the owning component's paired SCSS and remove replaced
   styles in the same change.
7. Check narrow mobile width, 200% text zoom, keyboard focus, reduced motion, and
   touch targets at the complete app-wide viewport matrix.
8. Compare visual differences with the Ingredients baseline. Keep a difference only
   when the view's purpose requires it.
9. If the difference is likely to repeat, create or extend a reusable component and
   update this guide.
10. If the difference establishes a new mandatory practice, propose or update a
   development rule.

Do not copy unfinished Mix or Saved Recipes markup/styles into a new view simply because
they already exist.

## Review Checklist

- [ ] Ingredients is the visual baseline used for the change.
- [ ] The closest equivalent Ingredients pattern was compared before and after the
      change.
- [ ] Existing primitives were checked before creating UI.
- [ ] Resting, loading, empty, disabled, error, overlay, dialog, and confirmation states
      were reviewed—not only the default screenshot.
- [ ] Every affected consumer of a changed shared primitive was regression checked.
- [ ] Colors and type use semantic global tokens.
- [ ] Light, dark, and device-following themes preserve hierarchy, contrast, focus,
      statuses, overlays, and media legibility.
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
