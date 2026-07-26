# Development Rules Audit

Last verified: 2026-07-22

Branch: `ui-rebuild/ingredients`

Scope: current working tree after the database-driven nutrient/reference catalog cleanup

## Navigation

Markdown cannot provide a true sticky sidebar in every editor, so this document uses a
clickable navigation block instead.

- [Development Rules](#development-rules)
- [Core Engineering Rules](#rule-best-practices)
- [Mandatory Rules Preflight](#rule-rules-preflight)
- [Repository Hygiene](#rule-repository-hygiene)
- [Browser And Mobile Compatibility](#rule-browser-compatibility)
- [Accessibility](#rule-accessibility)
- [Strict Content Security Policy](#rule-content-security-policy)
- [Search Relevance](#rule-search-relevance)
- [Explicit Pagination Controls](#rule-pagination-controls)
- [Shared Loading Indicators](#rule-loading-indicators)
- [Design Tokens And Spacing](#rule-design-tokens)
- [Component Styles And Folder Structure](#rule-style-file-boundaries)
- [Canonical Project Map](project-structure.md)
- [Shared Style Utilities](#rule-shared-style-utilities)
- [Reusable Components And Buttons](#rule-reusable-components)
- [Circular Icon Alignment](#rule-circular-icon-alignment)
- [Ingredient Card Media](#rule-ingredient-card-media)
- [Verified Status Badge](#rule-verified-status-badge)
- [Destructive Action Confirmation](#rule-destructive-action-confirmation)
- [Component And Route Boundaries](#rule-component-boundaries)
- [Manual Entry Modularization](#rule-manual-entry-modularization)
- [Database And API-Driven Data](#rule-no-hardcoded-reference-data)
- [Manual Entry Nutrient Classification](#rule-manual-entry-nutrient-classification)
- [Canonical Category Picker](#rule-canonical-category-picker)
- [USDA Food Source Priority](#rule-usda-source-priority)
- [Source Quality Measurement](#rule-source-quality-measurement)
- [Field-Level Product Enrichment](#rule-field-level-product-enrichment)
- [National Nutrition Datasets](#rule-national-nutrition-datasets)
- [Missing Nutrient Semantics](#rule-missing-nutrient-semantics)
- [Product Ingredients And Allergen Disclosure](#rule-product-allergen-disclosure)
- [Confirmed Label OCR](#rule-confirmed-label-ocr)
- [GS1 Product QR Safety](#rule-gs1-digital-link)
- [Source Lifecycle Reviews](#rule-source-lifecycle-reviews)
- [Data Source Licensing Ledger](#rule-source-licensing-ledger)
- [Future Public Data API And Retention](#rule-store-useful-api-data)
- [Versioned Catalog Read API](#rule-catalog-read-api)
- [Independent App And API Versioning](#rule-app-versioning)
- [Ingredient Source And Trust Identity](#rule-ingredient-provenance)
- [Private Custom Food Classification](#rule-private-custom-food-classification)
- [External API Request Efficiency](#rule-external-api-request-efficiency)
- [External API Rate Limits](#rule-api-rate-limit-handling)
- [Source-Backed Food Images](#rule-source-backed-food-images)
- [Source-Backed Food Servings](#rule-source-backed-food-servings)
- [Source Product Name Formatting](#rule-source-product-name-formatting)
- [Weight And Volume Conversions](#rule-serving-weight-volume-conversions)
- [Backend And Validation](#rule-backend-best-practices)
- [Test Database Isolation](#rule-test-database-isolation)
- [Exclusive Ingredient List Membership](#rule-exclusive-list-membership)
- [Atomic Bulk Ingredient Moves](#rule-bulk-list-moves)
- [Long-Press Ingredient Selection](#rule-long-press-selection)
- [Sheets, Views, And URL State](#rule-bottom-sheet-flows)
- [Readable URLs And Browser Titles](#rule-page-metadata)
- [Privileged Actions](#rule-privileged-action-badges)
- [QA Process](#rule-qa-process)
- [QA Task Consistency](#rule-qa-task-consistency)
- [MVP QA Priorities](#rule-qa-priorities)
- [Audit Summary](#audit-summary)
- [Findings](#findings)

## Development Rules

These are the working rules gathered from prior product and implementation decisions.

**0.** <a id="rule-best-practices"></a>Best practices are mandatory across every layer
of the app. Do not treat speed, visual iteration, or partial refactors as permission to
bypass maintainability, accessibility, data integrity, security, reusable primitives,
design tokens, tested behavior, clean architecture, or clear database ownership. If a
requested implementation conflicts with these rules or a defensible best practice, stop
and call out the conflict before writing code.

**0a.** <a id="rule-rules-preflight"></a>Before starting any feature, fix,
adjustment, refactor, migration, script, style change, documentation behavior change,
or other implementation work, read the current development rules that apply to the
affected area. Treat this as a required preflight, not an optional final audit. Inspect
the relevant code, schema, data flow, shared primitives, and QA coverage before editing.
If existing code or the requested approach conflicts with a rule, call it out
immediately in plain language; do not silently copy, preserve, or work around the
violation. Fix small, clearly in-scope violations while doing the work. For broader,
risky, ambiguous, or product-level conflicts, explain the issue and ask before
expanding scope. Re-check every touched file against the applicable rules before
handoff, and add newly discovered repeatable lessons to this document rather than
relying on memory.

**0b.** <a id="rule-repository-hygiene"></a>Keep the remote repository limited to
deliberate product source, migrations, tests, required configuration and lockfiles,
maintained documentation, and intentional public assets. Gitignore local environment
files, editor/workspace metadata, local QA trackers and screenshots, recovery and action
notes, database scratch queries, temporary exports, generated audit output, test
reports, logs, caches, and build artifacts. Before adding a new tool or workflow, audit
the files it creates and add narrowly scoped ignore rules for non-product output.
Remember that `.gitignore` does not remove files already tracked: delete or explicitly
untrack obsolete repository fluff after confirming it is not a required product
artifact. Do not hide canonical migrations, source code, maintained API contracts,
generated database types required by the app, dependency lockfiles, or durable licensing
records merely because they are generated. Gitignore is repository hygiene, not a
substitute for deleting dead code, documenting reproducible artifacts, or keeping
secrets out of files entirely.

**1.** Build mobile-first. Every screen and component should work on narrow phones
before wider layouts.

**1a.** <a id="rule-browser-compatibility"></a>Build and test browser features against
an explicit compatibility floor. The current app floor is Safari/iOS 16.4,
Chrome/Android 111, Edge 111, and Firefox 113. Keep Vite and CSS build targets explicit,
provide `vh` before `dvh` fallbacks, account for device safe areas, and feature-detect
optional browser APIs instead of assuming they exist. Camera, clipboard, sharing,
storage, and other device-backed features must fail with useful guidance and preserve a
non-device fallback when practical. Do not use browser-name checks when capability
checks can answer the real question. Before handoff, test the current and previous two
stable desktop releases plus real or emulated iOS Safari and Android Chrome at portrait
and landscape sizes. Do not reload or refetch page data merely because the browser
window regains focus; focus changes are not evidence that application data changed and
must not interrupt forms, selections, overlays, or other in-progress work. Synchronize
known mutations through explicit domain events and update local state in place.

**1b.** <a id="rule-accessibility"></a>Target WCAG 2.2 AA and treat accessibility as
part of normal implementation, not a later polish pass. Use native semantic elements
first; add ARIA only when the resulting pattern is valid. Every control needs an
accessible name, keyboard operation, visible focus, honest state, and a practical touch
target. Dialogs and modal sheets must move focus inside, keep focus inside while modal,
close with Escape where a keyboard is present, and return focus to the opening control.
Announce loading, validation, and result-count changes without duplicating visible
warnings. Honor reduced-motion settings, preserve content at 200% text zoom, avoid
color-only meaning, and verify important flows with VoiceOver on Safari and TalkBack on
Android Chrome. Compact ingredient cards with a preference conflict must retain the
shared full-height amber `CardWarningEdge`; do not replace it with an inline warning
icon, text block, or image treatment. The card's accessible action label must include
the warning text so the visual edge is not the only communicated signal.

**1c.** <a id="rule-content-security-policy"></a>Keep the Content Security Policy
strict in development and production. Do not add `unsafe-inline` to `script-src` or
`script-src-attr`, use `javascript:` URLs, string-valued event attributes, or raw inline
scripts to work around a violation. Svelte server rendering can emit inline
`this.__e=event` capture attributes when `load` or `error` handlers, actions, or spread
attributes are attached directly to elements with native load/error events. For those
elements, bind the DOM node and attach standard event listeners client-side through a
shared utility instead. Preserve cached-resource handling, remove listeners during
effect cleanup, and add a server-compile regression test that rejects inline event
attributes. Fix the emitting component rather than weakening the policy.

**2.** Keep the user flow simple. Barcode scanning, search, manual entry, fridge,
shopping, mix, and saved drinks should feel like a guided flow instead of disconnected
tasks.

**2a.** <a id="rule-search-relevance"></a>Search candidate gathering, cross-source
deduplication, preference-aware ordering, relevance ranking, and pagination belong on
the server so the UI only renders the ordered result pages. Rank direct description
matches before metadata-only matches, prioritize matches within the first three
description words, and keep later matches available below stronger results. Use exact
required-word queries first and a wider partial-word fallback for unfinished input; do
not replace real search with hardcoded correction lists. Source quality, user
preferences, and alphabetical order are tie-breakers after textual relevance, not
substitutes for relevance. Authenticated private search must read the database through
the server; do not maintain a browser-local ingredient catalog as a failure fallback.

**2b.** <a id="rule-pagination-controls"></a>Paginated result lists must use bounded
server pages, loading guards, stable ordering, and the shared footer containing explicit
`Load more` and `Return to top` controls. Never fetch another page from a scroll
threshold or intersection observer; loading must require a deliberate user action and
preserve the current scroll position. Show `Load more` only while another page exists.
Show `Return to top` only when the list actually overflows its scroll area. Use
`PaginatedListControls.svelte` instead of rebuilding these controls inside a feature.

**3.** <a id="rule-design-tokens"></a>Keep global design tokens genuinely app-wide.
`src/styles/_variables.scss` owns values reused by independent components or shared UI
primitives: the typography scale, spacing scale, app-shell surfaces, status roles,
breakpoints, common control dimensions, and other deliberate system-wide decisions.
Do not add a global variable for a value used by only one component, one button variant,
one illustration, or one temporary design pass. Put that value directly in the
component's paired SCSS file, or use a clearly named component-local SCSS variable when
it improves repeated calculations within that file. Global tokens must use stable,
semantic names and direct readable values; do not preserve implementation-era names
such as `figma` or `rebuild`, source-color aliases, duplicate semantic layers, or chains
where one variable points to another variable that points to the real value.

**3a.** <a id="rule-spacing-tokens"></a>Use the shared `$app-gap-*` scale for spacing
that establishes the app's repeated rhythm between controls, cards, sections, and
layouts. The standard rebuilt-view gap is `$app-gap-md` (`0.75rem`). A genuinely unique
component measurement may remain in that component's paired stylesheet; do not pollute
the global token file merely to avoid writing a local value. Repeated local values
should become a component-local variable first and graduate to a global token only when
multiple independent components share the same design decision.

**3b.** <a id="rule-shared-style-utilities"></a>Centralize repeated styling behavior. If
the same accessibility helper, visually hidden text pattern, focus treatment, viewport
fallback, motion preference, card shell, control state, or layout pattern appears in two
places, move it into a shared utility, primitive, mixin, or token-backed class instead
of maintaining feature-local copies. Keep genuinely unique component presentation local;
do not create abstractions with no second use. Shared utilities must use semantic SCSS
tokens and must not become a dumping ground for unrelated feature styles.

**4.** Do not use box shadows. Use borders, spacing, and background contrast instead.

**5.** Keep the visual style calm, polished, and not overstimulating. Accent colors
should be rare and intentional.

**6.** Make important actions obvious. Barcode scan, save, add, and confirm actions
should be easy to find without overwhelming the screen.

**7.** <a id="rule-reusable-components"></a>Prefer reusable components for repeated UI.
One-off components are a strong code smell. If two components, blocks, controls, cards,
rows, dialogs, sheets, pills, headers, action areas, or list sections are basically the
same, extract or extend a reusable component instead of copying the pattern. Do not
reimplement close buttons, pagination, sorting, controls, icons, spacing wrappers, or
card shells ad hoc. A one-off is acceptable only when the UI and behavior are genuinely
unique and unlikely to repeat; if that changes later, refactor immediately. Repeated
expand/collapse sections must use the shared collapse component so summary spacing,
left-side chevrons, right-side badges/actions, focus treatment, and open-state behavior
remain consistent.

**8.** <a id="rule-button-primitives"></a>All app buttons must use shared button
primitives. Circular icon actions, square icon controls, and rounded rectangle CTAs must
render through reusable components so icon swaps, spacing, tap targets, disabled states,
loading states, and typography stay consistent. Do not hardcode button dimensions, icon
centering, icon wrappers, hover states, active states, disabled states, or one-off
button layouts inside feature components. If a needed button shape or state does not
already exist, extend or create the shared primitive first, then use it in the feature.

**8a.** <a id="rule-circular-icon-alignment"></a>Every icon inside a circular container
must be centered both horizontally and vertically by the shared `CenteredIcon` layer.
Interactive circles must use `CircleIconButton`, `CloseButton`, or another approved
shared button; non-interactive icon circles must use `CircularIconFrame` through a
focused component such as `StatusIconBadge`; circular avatars, circular food symbols,
and circular image previews must use `CircularMediaFrame`. These primitives own equal
width and height,
`inline-flex` or `flex` with `align-items: center` and `justify-content: center`,
clipping, token-backed container/icon sizing, and a zero-line-height inner icon wrapper.
Shared circular primitives must not apply a
family-wide optical translation that moves every child away from the mathematical
center. A genuinely asymmetric icon may receive an exceptional token-backed correction
only through its focused reusable component after visual QA; feature components must not
recreate circular wrappers, duplicate centering CSS, or compensate with glyph
whitespace, manual margins, one-off transforms, or browser-default alignment.

**8b.** <a id="rule-ingredient-card-media"></a>Ingredient-card media must render
through the shared `IngredientCardFeatureMedia` treatment. Source-backed product images
and database-driven fallback food symbols use the same full-height left media lane,
left-corner clipping, fade, content offset, and warning-edge layering. Fallback symbols
must not use a circular container inside saved or search-result cards. Center fallback
symbols vertically and center them horizontally within the media lane after reserving
token-backed space on the text-facing side for the fade. Keep that reserve in the
shared media component and use logical padding; do not use transforms, glyph whitespace,
manual margins, percentages that collapse the fallback wrapper, or card-specific
offsets.
Source-backed images must preserve their intrinsic aspect ratio and may be clipped or
contained according to placement, but never stretched. Missing and failed images must
switch to the fallback within the existing media lane without changing card geometry,
hiding the media on small screens, or moving the card copy.
Saved and search cards must not independently recreate image failure state, placement
resolution, fallback wrappers, media widths, masks, or clipping behavior.

**9.** <a id="rule-functional-controls"></a>Never render non-functional controls. If
something looks clickable, tappable, adjustable, expandable, or actionable, it must
perform that behavior, have an honest disabled state, or render as plain non-interactive
information instead. Repeating press-and-hold behavior must use a shared control,
support touch, mouse, and keyboard input, stop immediately on release or cancellation,
and suppress the duplicate click browsers may fire after a pointer or keyboard hold.

**9a.** <a id="rule-destructive-action-confirmation"></a>Destructive actions that
immediately remove user data must use a shared two-step confirmation flow for both touch
taps and mouse clicks. The first activation must never change data; it must arm the
action, visibly explain that the user must tap or click delete again, and update the
control's accessible label. Only a second, distinct activation may run the delete. Apply
the same guard to every route into the action, including compact card controls and
ingredient action sheets. Use `TwoStepConfirmation.svelte` rather than feature-local
timers, `dblclick` handlers, or one-off confirmation messages. The shared guard must
reject duplicate handling of the same browser event, expire automatically, preserve
keyboard access, prevent mobile double-tap zoom on the control, show a busy/disabled
state during the real delete, and use shared design tokens.

**10.** <a id="rule-supabase-source-of-truth"></a>Treat Supabase as the source of truth for authenticated users. Fridge, Shopping
List, custom foods, saved drinks, profiles, and other durable account records must never
be mirrored into `localStorage` or used from browser storage as a fallback authority.
Browser storage is limited to account-scoped unsaved drafts, device-only preferences,
and short-lived session context that can be safely discarded. Reads and duplicate
checks for durable records must use focused database queries or RPCs, and failed database
reads must show an honest retry state instead of silently displaying stale local data.
Legal, bounded server/API caches and in-memory request coalescing remain allowed under
the server-request rules because they reduce external calls without replacing canonical
Supabase data.

**11.** Avoid exposing user email in normal app UI. Prefer display name, profile name,
or a safe fallback.

**12.** Validate app actions. Prevent duplicate saves, invalid submissions, confusing
disabled states, and dead-end flows.

**13.** <a id="rule-loading-indicators"></a>Show honest loading or busy states for
actions with network, database, file-processing, or camera latency, and render every
visible loading indicator through the shared `LoadingSpinner` component. Input-triggered
work must place the spinner inside that input or select through `InputLoadingFrame`;
search and barcode lookups must not add detached loading text beside or below the field.
Buttons must pass `busy` through the shared button primitives, keep their normal action
label stable, and let the primitive add a decorative spinner instead of replacing the
label with `Loading…`, ellipses, or a one-off glyph. Standalone page, panel, and
reference-data loading states must use `LoadingSpinner` with a visible label. Do not
draw local spinner borders, duplicate spin keyframes, or create feature-specific loader
components. Loading states must expose `aria-busy` or one correctly named live `status`,
avoid duplicate announcements, use token-backed size/color/timing, and honor
reduced-motion preferences.

**14.** Keep authentication secure and predictable across localhost, previews, and
production.

**15.** <a id="rule-code-organization"></a>Keep files and folders maintainable, clean,
and beautiful. Structure should make the UI location and domain purpose obvious.

**16.** <a id="rule-component-boundaries"></a>Extract reusable components and utilities
whenever practical. Repeated UI, repeated functions, long route files, oversized
component styles, and duplicated business logic are maintenance problems. Views should
orchestrate; components should render focused UI; utilities should hold reusable
calculations, formatting, filtering, sorting, validation, and storage helpers.

**16a.** <a id="rule-manual-entry-modularization"></a>Use the current manual entry split
as the modularization standard for future feature work. Large flows should keep the
parent component responsible for wiring state and child components/utilities responsible
for focused UI, lookup flow, submit flow, reset/default state, validation, payload
building, and styling. Do not let one file become the home for every new behavior.

- <a id="rule-manual-entry-parent-role"></a>`CustomIngredientForm.svelte` is the model
  for parent flow composition. Parent flow components may instantiate focused
  controllers, connect typed step contracts, own DOM references, and render the flow
  shell and dialogs. They should not own dense step markup, large style blocks, repeated
  display pieces, submission payload building, barcode lookup details, reset defaults,
  validation message construction, request concurrency, or list outcome behavior.

- <a id="rule-manual-entry-controllers"></a>Stateful multi-step workflows use focused
  Svelte controller modules beside the owning component. Keep entered form data in one
  reactive form model, but divide behavior by responsibility: reference-data loading,
  barcode lookup and sharing, validation and navigation, destination outcomes, and
  submission. Controllers must expose typed state and actions, cancel or invalidate
  stale asynchronous work, and remain independently understandable. Do not replace a
  large component with one equally large catch-all controller.

- <a id="rule-manual-entry-shells"></a>Shared flow chrome belongs in shell components.
  `ManualEntryFormShell.svelte` owns common layout concerns such as the sheet/form
  frame, title area, step tabs, warning placement, body slot, action row, and repeated
  flow structure. Future multi-step flows should use the same pattern instead of
  rebuilding headers, tabs, warning rows, and buttons inside every feature.

- <a id="rule-manual-entry-step-components"></a>Each step gets its own focused component
  under a clear `steps/` folder. `IdentityStep.svelte`, `ServingsStep.svelte`,
  `NutrientStep.svelte`, and `ShareStep.svelte` should render one step each, receive
  values and callbacks from the parent, and avoid direct database/API calls, storage
  writes, route navigation, or final submit behavior.

- <a id="rule-manual-entry-step-content"></a>Step switching belongs in a small
  coordinator component such as `ManualEntryStepContent.svelte`. The parent should not
  contain a long `{#if}` block full of step markup. The step-content component should
  only choose which step component to render and pass through typed, step-specific prop
  contracts. Do not flatten every step's values and callbacks into one catch-all prop
  interface.

- <a id="rule-manual-entry-display-components"></a>Repeated or self-contained visual
  pieces should be child components, not inline parent markup. Examples from manual
  entry include barcode autofill suggestions, scan options, validation lists, outcome
  messages, nutrient fields, step tabs, and toggles. If a block has its own title, card
  shape, repeated controls, or conditional rendering, consider a component.

- <a id="rule-manual-entry-utils"></a>Reusable logic belongs in `utils/` files with
  plain names that describe the job. Examples from manual entry: `barcodeFlow.ts`,
  `barcodeScanFlow.ts`, `customFoodPayload.ts`, `formState.ts`, `listOutcome.ts`,
  `nutrientValues.ts`, `stepNavigation.ts`, `submitFlow.ts`, `submitValidation.ts`, and
  `validationItems.ts`. Put calculations, defaults, comparisons, payload shaping,
  navigation decisions, and validation builders there instead of inside Svelte markup.

- <a id="rule-manual-entry-validation-visibility"></a>Missing-required-field warning
  cards in multi-step forms must be attempt-gated. Do not show them when a step first
  loads or merely regains focus. Pressing `Continue`, selecting a later progress step,
  or submitting the form counts as an attempt and must reveal the first invalid step's
  warnings. A step that validates successfully must clear its attempted-error state so
  returning and editing it does not show new required-field warnings until the user
  attempts to advance again. Loading and infrastructure failures may still appear
  immediately when the user cannot proceed safely.

- <a id="rule-manual-entry-reference-data"></a>Reference data loading belongs in a
  focused data utility, not in step components. Manual entry uses
  `manualEntryReferenceData.ts` to load nutrient groups and nutrient relationship rules
  from the database-backed path, while the canonical category picker uses its focused
  server endpoint. Components render that data; they do not invent fallback lists or
  hardcode API-derived options.

- <a id="rule-manual-entry-types"></a>Flow-specific types and constants belong in
  `formTypes.ts` or `types.ts`, not scattered through components. Step ids, summary item
  shapes, nutrient value state, validation item shape, and create-handler types should
  stay centralized so future steps use one shared language.

- <a id="rule-manual-entry-styles"></a>Large manual-entry styles belong beside their
  owning component in a paired SCSS file. Repeated manual-entry fields, action rows,
  toggle rows, and step layouts must be reusable components instead of selectors in a
  flow-global stylesheet. Consume app-wide tokens for shared design decisions and keep
  component-only values local.

- <a id="rule-manual-entry-growth-check"></a>Before adding manual-entry behavior, decide
  where it belongs: visual UI in a step/display component, reusable logic in a utility,
  data loading in a data utility/server path, shared layout in the shell, and only final
  wiring in `CustomIngredientForm.svelte`. If a change would make the parent component
  grow materially, split it first.

**16b.** <a id="rule-route-page-boundaries"></a>Route pages should not own reusable
visual sections, sheet collections, dense card markup, or specialized display widgets.
Keep route files focused on route state, data loading, and high-level orchestration;
move feature chrome, pop-ins, repeated card pieces, search result sorting, and
nutrition-label rendering into named components or utilities.

**16c.** <a id="rule-refactor-findings"></a>When refactoring exposes a repeatable
process or architecture issue, add it to these development rules instead of fixing only
the current file. Do not create duplicate rule sets elsewhere; update this source of
truth and link QA items back here.

**16d.** <a id="rule-style-file-boundaries"></a>Organize every component as
`components/<domain>/<Component>/<Component>.svelte`, with `<Component>.scss` beside it
when the component has styles and a local `types.ts` when component-only types are
needed. Do not create empty companion files. A type shared by sibling components belongs
at their nearest common parent. Shared visual behavior must become a reusable component,
primitive, or mixin instead of a feature-global stylesheet. SvelteKit routes keep
`+page.svelte`, `page.scss`, and optional route `types.ts` together in the route folder;
layouts follow the equivalent `+layout.svelte` and `layout.scss` convention. Load private
SCSS only through the owner's scoped `<style lang="scss">` block. Do not use script-level
stylesheet imports in components or pages because they bypass Svelte's normal scoping.
Keep app-wide values in `_variables.scss`; keep component-only colors, dimensions,
radii, timing, and layout details in the paired SCSS file. Do not create global one-off
variables to make a local declaration look tokenized. `src/styles` must contain only
true app-wide style infrastructure, never ingredient-card or other feature styles.
Follow the complete ownership map in `docs/project-structure.md`. Do not create generic
dumping folders such as `defaults`, `helpers`, `misc`, or `shared`; place configuration,
constants, and utilities with the domain that owns them.

**16e.** <a id="rule-type-file-boundaries"></a>Keep reusable and feature-specific
TypeScript types out of Svelte component and route files. Components and pages should
import named types from nearby `types.ts`, `formTypes.ts`, or domain utility files
instead of declaring local `type`, `interface`, or inline object-shaped prop contracts.
Repeated option shapes, handler contracts, state shapes, sheet props, and route data
contracts must be centralized.
A named prop contract used by one component belongs in that component's local
`types.ts`. An exact prop contract used unchanged by multiple sibling components may
live in their nearest parent `types.ts`; that parent file must not merely collect the
siblings' separate `*Props` types. Flow-wide files such as `formTypes.ts` may hold shared
state and domain contracts, but component-specific prop contracts still stay with their
component owner.

**17.** Use the branch gate. Every new feature, major addition, and big change gets its
own branch from `staging`, merges into `staging` first, and only moves from `staging` to
`main` after the staging preview is approved.

**18.** Treat bypassing staging as a process problem. If a change is headed to `main`
without going through `staging`, stop and call that out before merging.

**19.** Do not automatically add changes to `staging`. Work should stay on the active
feature branch or working tree until explicitly approved for staging.

**20.** Do not auto commit. Show the diff and get explicit approval before committing or
pushing changes.

**21.** Verify meaningful changes with `npm run check`, focused tests, and builds when
scope warrants it.

**22.** For the full mobile UI rebuild, use `mobile-ui-rebuild` as the temporary
integration branch. Major rebuild sections branch from `mobile-ui-rebuild`, merge back
into `mobile-ui-rebuild` only after approval and checks, and do not move to `staging`
until the full rebuild is approved.

**23.** During the mobile UI rebuild, protected components require explicit written
approval before alteration. The graph and barcode scanner are currently protected.

**24.** <a id="rule-figma-screenshots"></a>Ask for Figma screenshots before implementing
any new UI element or materially changing an existing UI element during the mobile UI
rebuild. Do not move forward with implementation until the relevant screenshots, states,
or explicit visual direction are provided. Match provided screenshots before inventing
layout details, and name the exact screenshot references in QA notes for any
screenshot-backed UI change.

**25.** <a id="rule-ui-refactor-new-components"></a>During UI refactors, build new
focused components to match the approved Figma examples first, then wire the existing
app behavior and data into those components. Do not contort old UI components into the
new design when a clean replacement is more maintainable. If the new Figma UI does not
show existing data, controls, warnings, states, or behavior currently rendered by the
app, pause and confirm whether that functionality should move, be hidden, or be removed
before dropping it.

**26.** Keep database tables and data flow clean, normalized, and maintainable.
Canonical source tables should stay focused on canonical data; UI flow metadata,
grouping, ordering, and display configuration should live in separate purpose-built
tables when that keeps ownership clearer. Before adding schema, inventory existing
tables, RLS, indexes, and app access paths to avoid duplicated concepts.

**27.** <a id="rule-no-hardcoded-reference-data"></a>Do not hardcode DB-backed catalog
data, API-derived reference data, nutrient definitions, allergens, dietary restrictions,
source labels, or compatibility metadata in components or utility constants. If the app
needs reusable reference data, seed it into a table and query it through a focused
utility.

**28.** <a id="rule-api-seed-scripts"></a>If required reference data is not already
available in the database, create or extend a script that queries the available source
APIs, stores the observed/canonical data in Supabase with source/provenance metadata,
and renders from that database data instead of inventing fallback constants.

**29.** <a id="rule-api-observed-seeds"></a>Seed reusable app data only from
API-observed or database-canonical data. Do not hand-write fallback constants, static
option lists, nutrient catalogs, category catalogs, allergen catalogs, dietary
restriction catalogs, or source-derived metadata. If an API does not expose the needed
data directly, write a script that samples every relevant available source API, stores
observations/provenance in Supabase, and renders only from the stored database result.

**29a.** <a id="rule-manual-entry-nutrient-classification"></a>Keep manual-entry
nutrient grouping, titles, order, visibility, semantic type, aliases, and replacements
in a versioned database catalog. Source APIs may add raw nutrient definitions and
observations, but a seed or sync script must never guess a UI group from a nutrient name
or overwrite an approved classification. Store unknown source nutrients as hidden,
unclassified observations for review instead of discarding them or exposing them in the
form. Keep Macros limited to common nutrition-label values; move specialized
carbohydrate, fat, carotenoid, mineral, vitamin, amino-acid, and other composition data
to Extended. Preserve retired aliases and their canonical replacements so new provider
terms can be adopted without losing history or creating duplicate inputs.

**30.** <a id="rule-cross-reference-apis"></a>Cross-reference all relevant source APIs
before treating seeded reference data as verified. Any script that writes reusable,
shared, canonical, or reference data to the database must query every available source
API for that data domain, store source names, observation counts, first/last observed
timestamps, and enough provenance to distinguish single-source observations from
multi-source agreement. If a data domain can only be canonical from one source, still
record any available corroborating observations from the other APIs and expose that
confidence difference in the data model. Source-specific audit scripts are allowed only
when they are clearly named as diagnostics and do not write canonical app data.

**30a.** <a id="rule-usda-source-priority"></a>Apply source authority per field, not per
provider or whole product. Barcode lookup must require an exact normalized GTIN match
before any packaged-product source can provide verification evidence. USDA lookup must
select the newest active exact-match `Branded` record and must never substitute a
generic food estimate for a packaged label. Open Food Facts exact-barcode records are
equally valid association evidence and may provide nutrition, images, ingredients,
categories, or servings according to the policy for each field. Generic food search may
use `Foundation`, then `SR Legacy`, then `Survey (FNDDS)` as a quality tie-breaker after
text relevance. Store every provider, source subtype, source reference, and available
publication/modification date with field-level provenance, and show neutral attribution
in detailed views. A provider name alone must never create a user-facing trust level.
Never average nutrients across records, silently merge unrelated foods, replace a
reported zero, or store an unreported nutrient as a source-reported zero. Ingredient
labels and calculations may use the app's explicit zero fallback for an absent value,
but that presentation/calculation fallback must never be written back as observed data
or given source provenance.

**30b.** <a id="rule-source-quality-measurement"></a>Measure external product sources
with privacy-safe backend metrics instead of assumptions. Count logical lookups, actual
outbound API requests, cache hits, API failures, completed lookups, exact barcode
matches, returned nutrient depth, useful metadata coverage, and response time
separately. Never store a user's barcode, search text, user id, or raw vendor payload in
source-usage metrics. Keep field authority, observed coverage, and verification evidence
separate: a fuller record does not automatically replace a stronger value for a specific
field, and a provider name does not make an entire product verified. Runtime fallback
traffic is biased because later providers receive harder misses, so direct source
comparisons must use the same representative barcode sample through the controlled
benchmark before changing a field-selection policy.

**30c.** <a id="rule-external-api-request-efficiency"></a>Every external API integration
must minimize and bound outbound requests. Read the blendCalc database/cache first when
the source terms permit it. For barcode providers, use the shared candidate lookup so
the normal package code is tried before padded GTIN forms, candidates are requested
sequentially, and probing stops immediately after an exact usable match; never request
equivalent barcode forms in parallel. Fetch a detail record only after selecting an
exact search match. Coalesce identical requests that are already in flight so concurrent
app work shares one network call. Keep retries bounded, stop candidate probing on
provider errors or rate limits, and follow each provider's storage/license rules rather
than treating persistent caching as universally allowed. New providers and maintenance
scripts must use the shared barcode/request helpers, record logical lookups separately
from actual API calls and cache/request-reuse hits, report calls per lookup, and include
regression tests proving that requests stop after a match. Investigate any controlled
benchmark averaging more than 2.5 outbound calls per logical lookup before expanding or
reprioritizing that source.

**30d.** <a id="rule-api-rate-limit-handling"></a>API seed/audit scripts must handle
temporary failures politely. Retry short-lived server errors with backoff, honor
rate-limit responses with longer waits or stop the run, and never keep hammering an API
that is returning repeated 429/503 responses. Partial API instability should be
documented in the run summary instead of silently treated as complete coverage.

**30e.** <a id="rule-server-request-efficiency"></a>All server-side outbound requests
must use a shared request boundary instead of calling `fetch` directly. Give every
request a finite timeout, retry only idempotent requests or writes protected by a
provider-supported idempotency key, limit retries, respect `Retry-After`, and avoid
retrying long rate-limit windows inside an interactive request. Cache provider responses
only when source terms allow it; isolate raw provider caches from canonical app data,
use ETags when available, bound in-memory caches, coalesce identical pending work, and
allow a recent stale response during a temporary provider outage. Cache read/write
failures must be logged but must not turn a healthy provider response into a user-facing
failure. Start independent database/storage requests together, keep truly dependent work
sequential, use embedded relationships or focused RPCs for hot related records, batch
storage signing and database reads instead of creating N+1 requests, select named
columns instead of `*`, and use bounded concurrency for variable-size batches. Reuse one
server admin client per process, cache stable global reference catalogs briefly, and
reuse short-lived signed media URLs, but never cache user authorization, account-block
status, or other security decisions in a way that delays enforcement. When the project
uses asymmetric Supabase JWT signing, verify request identity with `getClaims()` so
normal requests do not contact the Auth server solely to decode the same user again;
keep immediate database-backed account-block checks and use Auth-server operations
wherever current revocation state or an Auth mutation is actually required. Hand
noncritical metrics and cache writes to the deployment runtime's background-task hook so
they do not extend the user response, with an awaited fallback for runtimes without that
hook. Server client setup must be smoke-tested under the supported local and deployment
Node runtimes. Add request-count, timeout, retry, cache, stale-fallback, batching,
authentication, and runtime-client tests for every shared request utility, and inspect
real query statistics before adding or removing indexes.

**30f.** <a id="rule-ingredient-provenance"></a>Keep ingredient origin, field authority,
and verification as separate database-backed concepts. Origin answers where each value
came from, field authority selects the accepted value for nutrition, image, category,
or serving, and verification records evidence such as an exact barcode match,
cross-source agreement, or moderator review. `Imported` describes an ingestion method,
not a lower trust level. USDA, Open Food Facts, national datasets, and future providers
must never receive blanket verified or unverified status from their names alone. Keep
origin and field-level provenance internally and show neutral source attribution in
detailed nutrition views where useful or legally required, but do not show provider or
`Imported` hierarchy badges on compact saved/search cards. Compact UI may show only
unresolved actionable states such as `Pending Review`, `Conflict`, or `Incomplete` on
saved Fridge and Shopping List cards. Search result cards may additionally show the
resolved `Verified` shield because verification helps the user choose a product before
adding it. Detailed nutrition views show verification plus neutral source attribution.
Verified evidence states must share one user-facing label and treatment regardless of
whether the evidence was an exact source match, corroboration, or moderator approval.
Badge labels, ordering, enabled states, and tones must come from database reference rows.
Saved list rows must use normalized foreign keys to their active shared product and
current user submission; database triggers must refresh those links and their indexed
origin/verification projections whenever a list item is written, a submission changes
status, or a shared product changes. JSON food payloads may remain compatibility
snapshots but must never be the authority for whether an item is pending or approved.
Provider and internal acceptance-method filters must not be exposed as consumer trust
controls. Unknown origin must remain `unknown`; never assign USDA or another provider
merely because source metadata is absent. Render verification states through the shared
`IngredientProvenanceBadges` component, use its saved-card variant to omit resolved
verification after an item is saved, and use its search-card and detail variants to show
the unified `VerifiedStatusBadge` where verification informs selection or detail review.
Retain the database label as the shield's accessible name and tooltip.

**30g.** <a id="rule-field-level-product-enrichment"></a>No API owns an entire product
record merely because it returned the first or most authoritative match. Build
exact-barcode products field by field: select nutrition, image, category, and serving
data independently, retain the chosen source, source reference, and confidence for each
field, and preserve per-nutrient provenance. The active `shared_products` row and its
normalized child rows are the canonical source of truth for published blendCalc product
reads and the future public API. Read that canonical database record first, then legal
source caches, and call external providers only for fields that are still missing.
External providers supply observations and gap-fill candidates; they never outrank an
accepted nonmissing canonical value merely because of the provider name. Apply an
explicit selection policy independently to every field;
the policy may prefer a source for a particular field but must not turn that preference
into a whole-product hierarchy or user-facing provider badge. Continue checking only
missing fields instead of returning early; an exact source match may supplement
nutrition, image, category, or serving without replacing accepted nutrients or reported
zeroes. A complete database record must make no external product request. A partial
record may request a fallback only while a tracked field remains missing, and a cache
failure, missing optional field, or later-source outage must never discard usable data.
Canonical-storage permission, license identity, and review notes must come from the
database-backed source policy, never a provider-name condition in application code.
When a legally reusable exact-source observation fills a missing canonical field,
record the observation, selected field provenance, canonical update, normalized rows,
and immutable revision in one server-only transaction so later app and API reads use
the improved database row instead of repeating the provider request. Never promote
provider data into the canonical/public database when its storage or redistribution
terms do not permit that use; keep it in its licensed cache or asset path instead. When
a fallback serving changes the working gram basis, rescale the retained nutrient values
exactly once to that serving before saving. Persist field-level provenance through
manual-entry autofill, catalog creation, normalized serving rows, and saved food
snapshots, and cover complete-cache, mixed-source, missing-field, concurrent-update,
cache-failure, source-outage, zero-value, legal-storage, and serving-rescale cases with
regression tests. Provider priority remains internal and must never be presented to
users as a trust hierarchy.

**30g.1.** <a id="rule-versioned-product-label-updates"></a>Treat a changed package
label for an existing barcode as a proposed revision of the blendCalc canonical product,
not as a new product and not as permission for an external provider to overwrite the
database. Compare the submission with the active `shared_products` row first. An
unchanged match creates no duplicate submission. A plausible change must record the
target product, exact base revision, label-observed timestamp, structured old/new field
values, submitted evidence, and the results of exact-barcode checks against every
available product source. Source agreement informs moderation but does not replace an
accepted nonmissing canonical value. Block clearly incompatible identities server-side;
send credible label changes to moderator review. Approval must append an immutable
revision and queryable field-change rows while preserving observations and provenance.
Use optimistic revision checks so a review based on an old revision cannot overwrite a
newer approved change. Never invent a label effective date: distinguish when blendCalc
observed the label from a manufacturer-provided effective/publication date. Keep private
evidence out of public product/API responses, and design the future public API to expose
the current canonical record separately from its documented revision history.

**30h.** <a id="rule-national-nutrition-datasets"></a>Import official national
food-composition datasets only after recording the exact release, download URL, file
hash, license, attribution, review status, and legal storage/reuse decision in Supabase.
Import through idempotent scripts into normalized, indexed generic-food tables; retain
source food and nutrient identifiers, raw descriptions, preparation, basis, source
status, and mapping provenance. Do not automatically merge similarly named foods across
countries or preparations. `Per 100 ml` alcohol records, edible-portion values,
dry/prepared variants, and other non-100g bases must remain explicitly typed and must
never be silently presented as per 100g. A dataset requiring unaccepted terms or
unresolved share-alike review stays disabled until that review is complete.

**30i.** <a id="rule-missing-nutrient-semantics"></a>Keep `reported zero`, `trace`,
`missing`, `derived`, and `unmapped` as different source-data states throughout
ingestion, normalized storage, moderation, provenance, and API responses. A reported
zero is real data. A trace value remains trace unless the source supplies a numeric
amount. Missing and unmapped values remain unknown source facts and must never be stored
as reported zero or copied from a vaguely similar food. At the app consumption boundary,
ingredient nutrition labels, Mix calculations, charts, warnings, and exports treat an
absent nutrient amount as zero without showing a partial-label disclosure. This is an
explicit product calculation/display fallback only; it must not mutate canonical data,
field status, attribution, confidence, or future API output. Before assigning internal
completeness or moderation status, check enabled source mappings, aliases, units,
conversions, and the record's stated basis. Define any required and recommended
nutrients in database-backed completeness profiles, not component arrays, and use those
profiles for ingestion quality, search ordering, and moderation rather than exposing a
large missing-nutrient warning to ordinary users. Profile selection must distinguish
private manual ingredients from source-backed packaged records: a private custom food
uses the database-backed manual-entry requirements even when the user typed a barcode,
while a source-imported, pending-review, or shared packaged product uses the applicable
packaged-label profile. A barcode alone must not make a private manual record appear
deficient against a full regulatory label.

**30i.1.** <a id="rule-product-allergen-disclosure"></a>Preserve and display
source-provided product ingredients and allergen disclosures without inference.
Structured allergens from exact DB/API records and confirmed compatibility facts with
the `contains` fact type render as `Contains`; source trace statements and confirmed
`may_contain` facts render separately as `May contain`. Never weaken an explicit
`Contains` statement into `May contain`, and if the same normalized allergen appears in
both groups, the explicit `Contains` statement wins. De-duplicate labels
case-insensitively while preserving readable source wording. Do not infer package
allergens or trace statements from the product name, category, ingredient text, or a
user preference warning. DB-reviewed exact-match rules may create
`ingredient_present` compatibility facts from source-provided ingredient lists or
authoritative generic-food identity fields; these facts must retain their matching
provenance and must never be presented as package `Contains` or `May contain`
statements. An inferred generic-food identity match may drive the compact warning edge
only as a `potential` preference conflict, never as confirmed package disclosure. Every
broad identity rule must be DB-backed and include an exclusion pattern when names can
explicitly contradict the inference, such as `gluten-free bread` or `rice noodles`.
Keep preference conflicts separate from source package
disclosures. Hide empty disclosure groups rather than inventing `none`, `zero`, or
`allergen-free`. Nutrition details must use the reusable ingredients/allergen
presentation directly after the nutrition label, with `Contains` and `May contain`
following `Ingredients` and without a one-off card shell. Exact-barcode enrichment may
merge nonconflicting ingredient, allergen, trace, and label metadata from multiple
sources, but it must retain canonical identity and source provenance and must never
overwrite a nonempty canonical ingredient statement automatically.

**30i.2.** <a id="rule-private-custom-food-classification"></a>Use `Custom` only for a
user-owned food that does not match an accepted blendCalc catalog record or external
source and that the user deliberately keeps as an unmatched, fully unshared personal
record. A source-backed autofill, active shared-catalog match, pending catalog
submission, approved catalog item, or otherwise shareable exact-barcode record is not
Custom merely because it entered the account through manual entry or is stored in the
user's personal-food table. Persist this classification in authoritative food data,
recompute stale projections from normalized catalog/source links, and use one shared
classification utility for cards, filters, badges, search, Mix, and saved views. Removing
a mismatched barcode for account-only saving converts the remaining draft to Custom;
accepting verified information or entering the review pipeline clears Custom. Do not use
table names, creation routes, provider names, or privacy alone as a substitute for this
classification.

**30j.** <a id="rule-confirmed-label-ocr"></a>Nutrition-label text recognition is an
optional data-entry aid, not an authority. Run recognition only after the user
deliberately selects a label photo and starts the action. Parse against database-backed
nutrient aliases and conversions, show the recognized amounts and serving for review,
and apply only values the user explicitly confirms. Never mistake `% Daily Value` for a
nutrient amount, never turn unreadable text into zero, and never publish unconfirmed
recognition output. Confirmed values remain `user-label` data with user-reported
confidence; original photos remain private moderation evidence unless separately
approved under the image rules.

**30k.** <a id="rule-gs1-digital-link"></a>GS1 Digital Link product QR codes are
identifier carriers, not permission to fetch arbitrary URLs. For the supported
uncompressed form, accept only HTTPS links containing a valid `01` GTIN application
identifier, verify the GTIN check digit, extract the GTIN locally, and run the existing
DB-first exact-barcode lookup. Do not request the scanned brand URL from the server or
browser. Before saving identifier provenance, remove lot, serial, expiration, query,
fragment, credentials, and other package-instance data; retain only the safe
product-level reference. Unsupported compressed links must fail clearly instead of being
guessed or partially decoded.

**30l.** <a id="rule-source-lifecycle-reviews"></a>Verify that an external provider is
active, documented, legally usable, and operational before building or rerunning a
benchmark. Record evaluations, retirement dates, replacements, and the decision outcome
in the source registry. Disabled or retired providers must not receive production
traffic. Benchmark active barcode sources with the same representative sample—roughly
200 products when practical—before changing priority, and distinguish
`not benchmarked because retired/unavailable` from poor coverage. Recheck provider
status, terms, and API version before every major integration expansion.

**30l.1.** <a id="rule-source-licensing-ledger"></a>Maintain the tracked
`docs/data-source-licensing.md` ledger for every external data API, imported dataset,
image source, standards service, and data-processing tool. Before integrating a source,
changing its cache or retention behavior, importing a release, promoting any field to
the canonical catalog, rendering its attribution, or exposing it through an API, record
its official terms, exact licence/version when available, required attribution,
storage/modification/public-redistribution limits, share-alike obligations, excluded
rights, operational requirements, review date, current blendCalc handling, and known
gaps. The ledger, `product_data_sources`, release-specific dataset rows, per-asset
licence metadata, app attribution, and API output must agree. A missing or contradictory
approval defaults to blocked canonical/public use; do not turn uncertainty into
permission. Update the ledger in the same change whenever the source terms or blendCalc
usage changes, and distinguish repository policy review from professional legal advice.

**31.** <a id="rule-store-useful-api-data"></a>Design blendCalc's ingestion and storage
as the foundation of a future incorporated, externally usable data API—not only as
support for the current UI. When an API, official dataset, approved label, moderation
result, or audit exposes an accurately observed field that may improve nutrition,
products, identifiers, servings, conversions, categories, ingredients, allergens,
compatibility, images, source quality, search, moderation, or user safety now or later,
preserve it in Supabase whenever the source terms and privacy rules permit. Do not
discard a useful field merely because the present UI does not render it. Add an
appropriate normalized table/column or legally permitted source-observation record and
an idempotent ingestion path instead of burying future-use data in feature-local code.
Preserve the raw observed value alongside the normalized value when legally allowed,
plus stable internal and source identifiers, units, basis, preparation, source
record/version, retrieval and publication timestamps, license and attribution,
confidence, mapping/conversion method, status, and field-level provenance. Keep
API-facing contracts versioned and separate from the physical database schema so storage
can evolve without breaking future consumers. Deduplicate repeated observations without
erasing meaningful source history or disagreement. Sample broadly—roughly 200
representative examples when practical—and add indexes, retention choices, and tests
appropriate to the expected access path. Never store fabricated estimates as observed
facts, persist the app's missing-value zero fallback as observed data, silently merge
uncertain matches, retain
prohibited vendor payloads, or collect secrets, private evidence, personal data, or
package-instance identifiers merely because storage is technically possible. If
storage/reuse rights or identity confidence are unresolved, retain only the legally
permitted audit metadata and mark the data unavailable for public/API use until
reviewed.

**31a.** <a id="rule-category-resolution"></a>Barcode and manual-entry category autofill
must preserve raw API category observations, then resolve the visible app category
through database-backed category options/mappings. Do not choose the first raw API
category string as the user-facing category. If no confident DB mapping exists, keep the
raw source data for moderation/provenance and ask the user to choose a category. Catalog
submission, automatic publication, moderator approval, and revision creation must
preserve the canonical category foreign key and the raw source categories; they must
never replace either with a generic placeholder category. The compatibility
`foodCategory` display field must mirror the canonical category label whenever a
canonical category id exists. `Custom Ingredient` describes origin, not category, and
must never be rendered or persisted as a category substitute.

**31a.1.** <a id="rule-canonical-category-picker"></a>Unresolved manual-entry categories
must use the shared canonical category picker backed by enabled
`custom_food_category_options` rows. The server ranks a small `Suggested` group from the
product name and preserved raw source categories, returns a bounded multi-source
`Common categories` group, and performs bounded database search as the user types. A
suggestion is help, not an automatic classification: the user must choose it before the
form can continue. Never render the entire category catalog in a native select, expose
raw provider labels as canonical choices, invent a client fallback list, or fetch and
sort every category in the browser. Persist both the chosen canonical category id and
label while retaining the raw source observations separately. A user's one-time choice
must not silently create or promote a global source mapping; mapping changes require the
normal evidence and review path.

**31b.** <a id="rule-source-backed-food-images"></a>Ingredient/product images must
follow the same API → DB → UI path as other reference data. Do not render new
third-party image URLs directly from live API responses without first storing the image
metadata, source, license, attribution, confidence, and fetch timestamp in Supabase.
Only store and display images whose source terms allow the app’s use case. Read the
active database image cache by normalized barcode before calling an optional image
provider; start that cache read alongside the primary nutrition lookup so request
savings do not add avoidable delay. Once a reusable image exists, do not call an
external image source merely to rediscover it. Prefer moderator-reviewed images over
source-verified images, source-verified images over imported images, and the newest
image only as a same-confidence tie-breaker. Database image records override stale image
snapshots embedded in saved food JSON. The accepted nutrition field and image field may
come from different providers: enrich exact barcode matches with legally usable package
images while preserving each field's provenance. A missing cache row, missing provider
image, or failed optional image lookup
must never discard an otherwise valid nutrition match. User-submitted product evidence
remains moderation evidence unless it is approved into a reusable image record.
Every detailed third-party image and trusted-image preview must use the shared asset
attribution component to show its stored credit and license, with the stored license URL
as an accessible link when available. Compact card thumbnails may omit inline credit to
protect readability only when the corresponding detailed view exposes it; never invent,
hardcode, or infer attribution in a component.

**31c.** <a id="rule-image-placement-editor"></a>Image zoom and placement must be
non-destructive and versioned. Keep the original image unchanged; placement only
controls card rendering. Every new image defaults to version 2 `Full image`: contain the
complete orientation-corrected image, center it, and treat `1×` as the full-image size.
Offer the shared `Full image` and `Fill card` presets plus a plainly labeled
`Restore default` action that returns to version 2 `Full image` at centered `1×`;
restoration must remain a draft until the surrounding save or approval flow is
completed. `Fill card` must calculate the minimum aspect-aware zoom needed to cover
the real card image lane. `Custom` is an automatic placement state rather than a
separate preset: dragging, pinching, scrolling, moving a slider, or changing zoom
must switch the placement to version 2 `Custom`. Normalized position always means
`0 = far left/top`, `50 = centered`, and `100 = far right/bottom`; disable an axis when
the measured image and frame leave no overflow on that axis. Keep native range controls
available for keyboard and assistive-technology use even when direct pointer/touch
interaction is supported. User submission, moderation approval, admin/moderator editing,
ingredient cards, and previews must use the same placement value (`fit_mode`, normalized
X/Y, zoom, and `placement_version`), shared geometry utility, and shared measured
renderer so previews cannot disagree with saved cards. Editors must show one interactive
preview using the real card proportions, image lane, fade, copy spacing, and action-space
reservation instead of separate circular approximations. Show the unchanged full image
once in the surrounding flow through the shared `ProductImageFrame` or existing private
evidence gallery; it must use contained scaling, a compact content-led frame, semantic
SCSS tokens, and no large full-width outlined area around narrow images. Preserve
existing records as version 1 until a person edits them; new or newly edited records use
version 2. Automatic API refreshes must never overwrite a saved placement. Any future
smart-placement revision may only offer an optional suggestion and must never silently
replace the selected placement. The current smart-placement flow runs Tesseract.js
on-device, caches OCR results in bounded browser memory, scores text against the known
product and brand names, penalizes nutrition/disclaimer text, and applies a draft only
after the person chooses `Suggest placement`. Keep manual drag, zoom, sliders, presets,
and restore available after every suggestion. Persist the accepted placement method,
algorithm version, and bounded confidence, but do not store raw OCR text. Do not rebuild
one-off full-image frames, sliders, placement math, crop CSS, OCR scoring, or preview
boxes in feature components.

**31d.** <a id="rule-source-backed-food-servings"></a>Serving information must follow
the API → DB → UI path and remain usable as conversion data. When a trusted source or
manual label provides a serving, store its display label, gram weight, optional
structured amount/unit, primary status, source, source reference, and confidence in
normalized `food_servings` rows. Nutrition views must load these rows and let users view
the source serving or the 100g standard; future mix conversions must consume the same
normalized gram weights instead of reparsing display text. When a stored serving is
selected, the nutrition sticker must show a standard weight-first statement such as
`Serving Size 125g (1/2 cup)` followed by `Amount per serving`; omit the household
measurement when the source only provides weight, and do not show a serving statement
for an arbitrary viewing amount. Keep one primary serving per food parent, preserve
reported zero values, and never invent a package serving when the source did not provide
one. Existing food JSON may remain as a compatibility snapshot, but database triggers
and backfills must keep normalized serving rows current for list items, private custom
foods, submissions, shared products, revisions, and observations.

**31e.** <a id="rule-serving-weight-volume-conversions"></a>Automatically provide weight
and volume choices when stored serving data contains a legitimate conversion between
them. A conversion is legitimate only when the same source-backed or user-entered
serving pairs an exact gram weight with a structured volume amount and unit, or when an
approved density record provides the relationship with source and confidence metadata.
Store and calculate from the normalized numeric values; never infer density from the
food name, a generic category, display text alone, or an unrelated product. Nutrition
and manual-entry views should expose both units where useful, and the Mix page must use
these conversions so users can enter either weight or volume and receive the same
calculated nutrients. Keep unit labels, aliases, availability, and conversion factors
database-backed, preserve the original serving as the primary reference, and clearly
omit volume choices when the conversion is unknown or too uncertain.

**31f.** <a id="rule-catalog-read-api"></a>Keep the versioned blendCalc catalog API
separate from both physical database rows and external provider responses. API reads
must use active canonical `shared_products` plus normalized child records as the source
of truth, perform no live provider request, return bounded indexed pagination, and use
one documented response contract for both the app and future consumers. Expose neutral
field-level source, revision, serving, image-license, warning, and missing-value
metadata without exposing provider hierarchy. Missing scalars are `null`; an observed
zero remains zero; unavailable collections are empty arrays. Never expose users,
private ingredients, pending submissions, moderation evidence, storage paths,
moderator identities, secrets, or package-instance identifiers. New information enters
through the existing observation/submission and review pipeline rather than direct
canonical writes. Authenticate the internal preview, publish and test its OpenAPI
specification, keep errors stable, and delay public keys, billing, and public write
access until redistribution rights, corrections, rate limits, monitoring, and abuse
controls are complete.

**31g.** <a id="rule-app-versioning"></a>Version the blendCalc application and its API
as separate products. `package.json` is the single source for the app's semantic
version, and the MVP starts at app version `1.0.0`. Every build must carry that release
version plus a deterministic deployment identifier, expose the app release/build through
shared runtime constants, HTML metadata, and response headers, and use the same release
version in outbound user-agent strings. Keep this technical version metadata out of the
app header, navigation, and primary product screens. If users or support need a visible
version, show the complete app release in a focused About or Settings view rather than
repeating `V1` throughout the interface; API versions belong in API URLs, responses, and
documentation rather than the normal app UI. Use semantic versioning:
major for incompatible app or persisted-data behavior, minor for backward-compatible
features, and patch for backward-compatible fixes. The catalog API keeps its own URL and
contract version such as `/api/v1` and `apiVersion: 1.0`; an app release never changes
the API version automatically. Database migrations keep timestamp IDs, catalog records
keep revision numbers, image placement keeps placement versions, and browser storage
keeps feature-specific schema versions rather than reusing the app or API version.
Document compatibility and migration behavior before any major bump, and do not scatter
literal app versions through components, routes, scripts, headers, or provider clients.

**32.** <a id="rule-loading-states"></a>Every fetch-backed, database-backed,
camera-backed, or long-running action needs a clear loading state. While pending,
prevent duplicate submissions or duplicate triggers, keep the user informed, and provide
useful failure feedback.

**33.** Do not schedule browser/API fetches during server-side rendering. Fetch route
data in SvelteKit `load` functions or server actions, and run client-only lookups from
`onMount`, user events, or code guarded with `browser`.

**34.** <a id="rule-mobile-readability"></a>Keep mobile typography and tap targets
readable. Body text should start from a 16px baseline, critical labels and controls
should avoid tiny metadata sizing, and interactive controls should target roughly 44px
minimum touch size unless there is a documented compact exception. Dense data panels
such as Nutrition Facts must switch to a stacked narrow-screen layout before columns
force labels, values, badges, or source details below readable sizes; compact styling is
not permission to use text smaller than the shared readable metadata tokens.

**35.** <a id="rule-api-structure-references"></a>Keep external API structure references
generated and isolated. When the app needs a full understanding of vendor payload shape,
run `npm run generate:api-structures` and store the generated reference files under
`docs/api-structures`. These files are documentation only and must not be imported by
runtime app code. If runtime types are needed, create curated app-owned types in
`src/lib/types` or the relevant `src/lib/utils/**` domain.

**36.** API structure references must come from observed API responses. Do not write
imagined vendor schemas by hand. The generator should use previously observed Supabase
query data or explicit script arguments, then hit every external API source the app
currently uses for that data domain.

**37.** <a id="rule-backend-best-practices"></a>Follow best practices across the full
stack, especially backend and database design. Do not guess at schema, indexing, query,
RLS, or data-flow decisions. For sorting, filtering, pagination, and shared reference
data, prefer indexed database queries or focused views that keep the UI thin. Use RPC
only when the behavior is complex, transactional, security-sensitive, or meaningfully
reusable. Keep backend ownership clear, documented, and maintainable. This rule extends
the global [best practices rule](#rule-best-practices), not replaces it.

Protected routes must load their initial durable data through `+page.server.ts` and a
focused server coordinator rather than waiting for `onMount`. Server loads and later
user-triggered browser refreshes must reuse the same typed Supabase query functions by
passing an explicit authenticated data context. Durable mutations must use one focused
database function or server action that derives ownership from the session, validates
current state, performs related writes atomically, and returns a small typed outcome.
Once that path exists, revoke direct authenticated table writes that could bypass it.

**37a.** <a id="rule-test-database-isolation"></a>Run destructive database tests
against the resettable local Supabase stack by default. The test workflow must replay
the complete migration chain, use synthetic fixtures, run database-level pgTAP checks,
and exercise authenticated client behavior where RLS matters. Every reset and test
command must pass `--local` explicitly, generated test environments must reject
non-localhost Supabase URLs, and automated tooling must never run `db reset --linked`.
Do not copy production users, evidence, images, or private records into test seeds. A
future remote staging environment must remain a separate project with separate keys and
synthetic data; it supplements local testing for hosted/device QA and never becomes the
default destructive test target.

**38.** Ingredient manipulation controls should use toggles, buttons, action sheets, or
explicit forms instead of raw checkboxes. If a setting behaves like on/off state, use
the shared toggle component.

**39.** <a id="rule-bottom-sheet-flows"></a>Bottom-sheet flows must use the shared
`BottomSheet` chrome. Manual entry, filters, ingredient actions, rename/edit sheets, and
future sheet content must share the same centered handle, title typography, top spacing,
backdrop behavior, Escape/backdrop close behavior, max/min height rules, and bottom-nav
anchoring. Back-arrow visibility must be configured through the shared sheet primitive
rather than hand-rolled in feature content; manual entry omits the top back arrow
because step navigation already provides its own Back controls. Do not hand-roll sheet
headers inside individual sheet bodies. The shared handle's complete keyboard focus
outline must remain visible inside the sheet's reserved top clearance; sheet chrome must
not clip interactive focus indicators. After a successful submit, the sheet wrapper
must close exactly once before forwarding to any next view; child forms must not issue a
second close or reset into a visible blank form while route navigation is in progress.

**40.** <a id="rule-right-sheet-flows"></a>Right-side full-content data views must use
the shared `RightSheet` primitive. Search views and future detail/data views that slide
in from the right should share the same shell bounds, right-to-left transition, Escape
close behavior, content width, and between-header-and-nav layout instead of each feature
hand-rolling its own slide-in panel.

**41.** <a id="rule-qa-process"></a>Maintain `docs/QA/qa-tasks.md` as the local-only QA
index, split active manual checks into `launch-blocker-qa-tasks.md`,
`before-launch-qa-tasks.md`, and `post-launch-qa-tasks.md`, and keep
`completed-qa-tasks.md` as the completed QA archive. These files and screenshot assets
are ignored by git and must not be committed. Every new feature, component, UI,
data-flow, or behavior change must add
concrete local QA notes before handoff unless it is clearly documentation-only and needs
no user verification. QA notes should be created as part of the task, not after the
fact. Give every QA section a stable `QA-GGG` group ID and every task a stable
`QA-GGG-TTT` ID. Use the next unused number, never reuse or renumber existing IDs, and
preserve IDs when archiving tasks. Active priority trackers are the user's manual QA
queue: keep only checks that require visual judgment, real-device/browser interaction,
assistive-technology verification, user-controlled deployment configuration, or another
human decision. Deterministic code, schema, migration, API, data-integrity, RLS, build,
lint, or test checks belong to the automated development workflow. Run those checks instead of assigning
them to the user, record successful evidence in the completed archive, and keep any
genuinely unfinished automation-owned work once in the gitignored
`docs/local-context/action-notes.md`. Never duplicate one action between an active
QA tracker and local action notes. Organize every active priority tracker with a
workflow-category index that links related QA groups so a reviewer can complete one
coherent area at a time without changing stable IDs or duplicating tasks. Begin every QA tracker and index with the current
disposable local test-account credentials and the complete categorized barcode-reference
catalog. Never place production credentials or private user data in those references.

**41a.** <a id="rule-qa-priorities"></a>Assign every active QA group one explicit MVP
priority, place the whole group in the matching active priority tracker, and keep that
priority visible in the group. `Launch blocker`
means the behavior can produce wrong calculations, data loss or corruption, duplicate
records, a security or privacy failure, a broken core save/navigation flow, unusable
mobile behavior, an accessibility blocker, or a failed required build, migration, or
schema check. Launch blockers for the current view must pass before work moves to the
next major view. `Before launch` covers common user flows, cross-view integration,
readability, consistency, and maintainability that may move into the full-app regression
pass without blocking the next view. `Post-launch` covers rare edge cases, deeper polish,
benchmarks, and planned expansion that does not compromise MVP correctness. Reassess
priority whenever scope or behavior changes; never downgrade a correctness, security,
privacy, data-integrity, mobile-usability, or accessibility problem merely to keep moving.

**41b.** <a id="rule-qa-task-consistency"></a>Before adding or changing any QA task,
automatically search all active priority trackers and the completed QA archive for the same route, component,
control, data flow, behavior, and expected outcome. Compare the proposed task against
every matching active task before writing it. Do not leave two active tasks that expect
opposing behavior, test a removed control, repeat the same coverage, or describe an old
version of the feature. Update an existing task when its stable ID still represents the
same behavior; merge duplicate coverage; and remove superseded tasks from the active
tracker immediately. Preserve a removed task's stable ID in the completed archive under
an explicit `Retired` heading with the reason and replacement QA ID, as required by
[QA clearance](#rule-qa-clearance). Completed tasks remain historical records rather
than current instructions. Recalculate QA priority summaries after these changes so the
tracker contains one clear, current expected outcome for each behavior.

**42.** <a id="rule-qa-clearance"></a>Finished tasks must prompt the user to run the
relevant QA checks from the active priority trackers linked by local
`docs/QA/qa-tasks.md`. Keep each QA item active until the user explicitly confirms it
passed; a checked checkbox counts as that confirmation. The sole exception is an
explicit user-requested automated QA pass: the agent may complete and archive only
deterministic tasks whose full expected outcome was directly proven by current tests,
database inspection, scripts, or build/lint output. Automated evidence must be written
into the archived task, and mixed visual/manual tasks must remain active even when their
automated portion passes. Whenever QA is updated and
before every handoff, automatically scan all active priority trackers and move confirmed,
checked items to `docs/QA/completed-qa-tasks.md` without waiting for
a separate cleanup request. Every QA cleanup or archive pass must also audit the
remaining active tasks for stale routes, controls, labels, components, files, expected
outcomes, superseded behavior, and duplicate coverage. When a whole section is complete,
move its section context with those items. If a checked item needs clarification before
archiving, add an unchecked `QA note needed:` prompt under the active section instead of
guessing. Never mark an item passed on the user's behalf, and do not silently delete
active QA coverage. When a feature or behavior has intentionally been removed or
superseded, remove its obsolete check from the appropriate active priority tracker and
record its stable ID
in the completed archive under an explicit `Retired` heading with the reason and
replacement QA ID; retired does not mean passed.

**43.** <a id="rule-view-primitives"></a>Full-height app views and sheet views must use
shared view layout primitives (`ViewFrame`, `ViewTop`, `ViewBody`,
`ViewHeader`) instead of hand-rolled page grids. Keep always-visible controls in
`ViewTop`, place only the intended scroll region in `ViewBody`, and avoid competing
nested scroll containers unless a component explicitly owns a sub-scroll area.

**44.** <a id="rule-sheet-base"></a>Sheet-style overlays must share implementation
through `SheetBase`, with thin semantic wrappers for placement-specific behavior
(`BottomSheet`, `RightSheet`, and future variants). `SheetBase` owns Escape and
intentional backdrop closing, entry focus, modal focus trapping, return focus, slide
transitions, safe-area-aware shell bounds, viewport fallbacks, z-index, and scroll
containment. A backdrop close must require a complete primary press that starts and ends
on the backdrop without becoming a drag. Leaving the browser or app window must disarm
backdrop dismissal so the first click used to return focus cannot close a sheet or
discard in-progress state. Feature sheets provide content and callbacks; they must not
duplicate or weaken those behaviors.

**45.** <a id="rule-icon-components"></a>All app UI icons must be reusable Svelte
components under `src/lib/assets/icons` or a clearly named nested icon folder. Avoid raw
emoji, one-off inline SVG, CSS-drawn icon glyphs, and ad hoc glyph spans in rendered UI
unless the symbol is user-facing text content rather than an icon. Directional chevrons
must use the shared `Chevron.svelte` component with a direction prop so shape, stroke,
sizing, and accessibility stay consistent; do not create separate feature-local chevron
paths or text characters. Feature-specific animated SVG is allowed only inside a
reusable, explicitly named icon component.

**45a.** <a id="rule-privileged-action-badges"></a>Every admin-only or moderator-only
action group must show exactly one shared crown badge in the heading of the nearest
container that owns those actions. Put the crown at the far end of a collapse summary,
card header, sheet group header, or other clear container heading; do not repeat crowns
on every button, field, preset, or control inside that group. A privileged action mixed
into a general-purpose action list must be placed in a clearly titled
`PrivilegedActionGroup` rather than marked as a one-off crowned button. Use the reusable
`PrivilegedActionBadge`; do not hardcode crown glyphs, duplicate badge styling, or hide
privileged actions inside an unmarked container. The crown is a standalone filled
yellow mark without a circular background or border. The profile variant may continue
to identify an admin or moderator account independently of action-group marking. Both
variants must use the shared component and token-backed sizes.

**45b.** <a id="rule-text-badges"></a>Compact text badges for actionable verification
states, statuses, and similar metadata must use the shared `TextBadge` component unless
an explicitly approved semantic status uses a focused shared icon badge such as
`VerifiedStatusBadge`. Provider origin and ingestion-method labels do not belong in
compact cards. Do not reproduce badge spans or pill styling inside feature components.
The shared primitive owns horizontal and vertical centering, minimum height, typography,
truncation, tone colors, padding, and rounding through SCSS variables; feature code
supplies only semantic label, tone, and accessible text.

**45c.** <a id="rule-verified-status-badge"></a>Any verification backed by accepted
evidence—an exact source match, corroboration, or moderator approval—must render as the
same reusable `ShieldCheck` icon inside `VerifiedStatusBadge` when verification context
is useful, such as nutrition details or moderation. `VerifiedStatusBadge` must compose
`StatusIconBadge` and the shared circular icon frame. Do not create provider-specific
verified treatments, show a separate visible `Verified` text pill, inline the shield
SVG, or recreate its circle in ingredient features. Keep the database-provided badge
label available through the icon's accessible name and tooltip so the icon is
understandable without relying on color or shape alone. Saved Fridge and Shopping List
cards must omit the resolved verified shield while retaining unresolved actionable
states through the saved-card `IngredientProvenanceBadges` variant. Search results use
the search-card variant to show the verified shield before a user adds a product.
Detailed nutrition views use the detail variant and keep the verified shield plus neutral
source attribution.

**46.** <a id="rule-qa-links"></a>QA tasks must include exact reproduction steps,
concrete example inputs, observable expected outcomes, exact code references, and links
to the relevant development rules. Every task must use the `Repro`, `Example input`, and
`Expected` labels. `Repro` must be a numbered bullet list with one exact action per
step. Example inputs must name concrete values, commands, roles, files, or UI controls;
never use `None` as a shortcut for an incomplete task. Do not create duplicate rule sets
inside QA docs; reference this document as the source of truth.

**47.** <a id="rule-local-recovery-context"></a>Keep temporary recovery checkpoints and
decision notes under local-only `docs/local-context/`. Keep that folder ignored by Git.
Never store passwords, tokens, environment values, private user data, or raw private
reasoning. Verify recovery notes against the current request, development rules, code,
migrations, database, and QA tasks before resuming work.

**47.** <a id="rule-qa-screenshot-assets"></a>If a QA task depends on a specific
screenshot reference, copy that screenshot into local-only `docs/QA/assets/` and link to
that asset from the QA task. Screenshot-backed QA items must include both the clickable
asset reference and the code references being verified. QA screenshots are working QA
artifacts, not source-controlled product assets.

**48.** <a id="rule-db-backed-nutrient-validation"></a>Nutrient relationship validation
must be database-backed and enforced on both client and server paths. Rules like child
nutrients not exceeding parent nutrients, required source nutrients, and label
consistency checks should live in focused Supabase tables with provenance and indexes,
then be consumed through shared utilities. Do not add UI-only constants for nutrient
math or allow shared/catalog submissions to bypass the same rule set.

**49.** <a id="rule-db-validation-first"></a>Prioritize database and server validation
over client-only validation. Client-side validation is for immediate UX feedback, but
every meaningful data integrity rule must be enforced through the database, server
actions, API handlers, RPC, constraints, triggers, policies, or indexed validation
tables as appropriate. Never rely on browser-only checks to protect canonical data.

**49a.** <a id="rule-exclusive-list-membership"></a>Fridge and Shopping List are
mutually exclusive states for one canonical ingredient identity. The same user must
never have the same FDC identity or normalized barcode identity in both lists. Adding an
ingredient that already exists in the other list must ask before moving it; confirming
must perform one atomic database-backed move, and canceling must leave the existing
membership unchanged. Enforce this with a database identity key and unique constraint,
not only browser checks or add-then-delete client sequences.

**49b.** <a id="rule-authoritative-write-paths"></a>Use one authoritative backend write
path for each meaningful data domain. Browser code may validate early for responsive
feedback, but it must submit through a secured server action, API, or database function
that revalidates current database-backed rules and completes related writes atomically.
Once the authoritative path is in place, revoke direct browser insert/update privileges
that could bypass it. Derive ownership from the authenticated session, never from a user
id supplied by the browser, and return small typed outcomes for expected conflicts.

**49c.** <a id="rule-bulk-list-moves"></a>Bulk Fridge and Shopping List moves must be
one coordinated action. Start every visible selected-card exit at the same time, move
Fridge items toward Shopping List on the right, and move Shopping List items toward
Fridge on the left. Honor reduced-motion preferences by skipping the slide without
delaying the write. Persist the complete selected set through one authenticated atomic
database function, reject stale or partial selections, notify list consumers once, and
update the visible lists once after success. Never implement a bulk move as a loop of
single-item writes or reload the full list after each selected item. Single-item moves
must use the same directional exit semantics and reduced-motion behavior as bulk moves
while retaining their item-level busy state.

**49d.** <a id="rule-long-press-selection"></a>Saved ingredient cards must keep bulk
selection controls out of the normal card layout. A deliberate 500ms long press on the
card's main content may enter selection mode, but the hidden gesture must never be the
only route: provide visible `Select items` and per-item action-sheet controls for mouse,
touch, keyboard, switch, and assistive-technology users. Cancel a pending hold when the
pointer moves far enough to indicate scrolling, suppress the follow-up browser click,
and avoid triggering selection from move, menu, or delete controls. Once selection mode
starts, let the card's native button toggle selection and expose the state through
`aria-pressed` plus an accurate `Select` or `Unselect` accessible name. Do not add a
second checkbox or circular selection button. Reserve the selected-border width in every
card so state changes do not shift layout, show a shared visible check indicator so color
is not the only cue, and keep the keyboard focus treatment visibly distinct from the
selected border. Announce selection mode and the selected count through a polite live
region. Hide unrelated item actions and provide `Select all`, `Move`, and `Cancel`
controls. Canceling, switching lists, or completing a move must clear the selection and
leave selection mode. Keep the press behavior in one reusable interaction utility and
test touch, mouse, keyboard alternatives, movement cancellation, selection
announcements, and reduced-motion-safe bulk movement.

**50.** <a id="rule-url-backed-popins"></a>Pop-in views, popovers, modals, sheets,
scanners, dialogs, and other meaningful overlay states need URL-backed state with
stable, readable path slugs. Use paths like `/fridge/search`, `/fridge/manual-entry`,
`/fridge/barcode-scanner`, and `/fridge/nutrition/123` instead of hiding major state in
local component booleans or query-only URLs. Query params are acceptable for small
modifiers, but the main view, list tab, or overlay identity belongs in the path. Use
`/fridge` and `/fridge/shopping-list` rather than a `tab` query parameter. Preserve the
active list as a readable path prefix when opening a list-specific overlay. Opening, closing,
refreshing, direct loading, app-name/base-route navigation, and browser back/forward
must go through navigation-aware handlers. When an overlay belongs on top of the current
page, update its path with shallow history rather than remounting the page. Opening or
closing an overlay must not reload, reset, reorder, repaginate, or move the underlying
page content.

**50a.** <a id="rule-page-metadata"></a>Every routable page, list tab, full-screen view,
and meaningful overlay must provide a concise, descriptive browser title that updates
during client-side and shallow-history navigation. Put the useful view or item name
first and the shared app name last, such as `Shopping List · blendCalc` or
`Tomato Soup Nutrition · blendCalc`, so narrow browser tabs remain identifiable. Keep
title composition and route labels centralized instead of scattering literal
`blendCalc` suffixes across pages. Canonical and social metadata URLs must use the
stable readable path and omit transient query parameters and hashes.

**50b.** <a id="rule-source-product-name-formatting"></a>Normalize every product name
supplied by USDA, Open Food Facts, shared source records, future external product APIs,
barcode scans, and valid barcodes entered in manual entry before those names are saved
or returned to the UI. Apply the same normalization when older API-backed records are
read so legacy DB or local-cache rows cannot bypass the rule. Collapse accidental
whitespace, use readable title-style capitalization for every API-backed display name,
and replace the standalone word `and` with `&` while preserving approved acronyms and
intentional mixed-case names. Record whether the current name came from a source, a
barcode-assisted entry, or the user. Preserve capitalization and wording exactly only
for a fully manual private item without a valid barcode and for an explicit personal
rename after saving; mark those names as user-owned so later saves, list moves, reads,
and backfills cannot reformat them. Keep raw vendor payloads and immutable audit
evidence unchanged. Backfills may update only source-backed names and inferred legacy
API records, and must skip records already marked as user-owned.

**51.** <a id="rule-input-placeholders"></a>All visible text, search, password,
textarea, and number inputs must have helpful placeholders. Required inputs should start
blank unless there is a real saved value to edit; do not prefill required fields with
fake `0`, `30`, or example values. Placeholder examples are for guidance only and must
not become submitted data. Numeric inputs should render blank for missing values so
typing a number never appends to a fake default.

**52.** <a id="rule-schema-first-features"></a>Before creating or changing any feature
that stores, verifies, moderates, filters, sorts, or shares data, inspect the current
Supabase schema, RLS, indexes, RPC/functions, generated DB types, and documented data
flow. Build on what exists before adding new tables or new client logic. If the current
schema limits the requested behavior, call out that limit plainly, then fix the data
model before layering UI on top.

**53.** <a id="rule-system-growth"></a>Every feature pass should improve the system, not
just add surface behavior. Prefer changes that reduce duplicate code, use existing
indexed/backend paths, preserve provenance, improve validation, tighten moderation, or
make future changes easier. Do not leave known schema, flow, or ownership problems
unspoken.

**54.** <a id="rule-catalog-divergence-blocks"></a>Shared catalog submissions that are
wildly different from an existing barcode match or trusted source should be blocked
before they reach normal moderation. This must be server-side and schema-aware. Do not
count silent machine blocks the same as human moderator rejections unless that is an
explicit product decision, because normal rejections affect the user’s submission-block
threshold. Private Custom records cannot be submitted directly. A source-backed
submission with any meaningful server-calculated identity, serving, ingredient,
allergen, category, or nutrient difference must require evidence and moderation rather
than relying on client review flags or automatic source publication. Validate GTIN
check digits, bounded names and brands, known unique nutrient identities, nonnegative
amounts, database-backed nutrient relationships, canonical categories, duplicate
submissions, evidence file signatures and sizes, and current submission blocks on the
server even when equivalent browser feedback exists.

**54a.** <a id="rule-private-barcode-detachment"></a>A user-authored product identity
that conflicts with a verified barcode must not be saved with that barcode still
attached. Offer the verified source data for shared use, or let the user explicitly
remove the barcode and keep the remaining draft as a private, user-owned ingredient.
Barcode removal must also clear source references, sharing consent, and barcode-specific
moderation evidence while preserving the user's other entered values. Enforce the
mismatch on the server and mirror the outcome immediately in the UI.

## Audit Summary

| Area                     | Status      | Notes                                                                                                                               |
| ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Mobile-first UI          | Partial     | Ingredients has explicit mobile behavior; remaining routes still need the same browser/device pass.                                 |
| Simple user flow         | Partial     | Barcode/manual flow is improving, but ingredient search, nutrition facts, list placement, and mix flow still have many transitions. |
| Design tokens            | Partial     | Ingredients and Mix pass the raw spacing/font scan; untouched routes still contain older one-off values.                            |
| No box shadows           | Pass        | `rg -n "box-shadow" src` returned no matches.                                                                                       |
| Calm visual language     | Mostly pass | Palette is coherent. Remaining risk is inconsistent typography and one-off component spacing.                                       |
| Obvious key actions      | Mostly pass | Barcode scan is now prominent. Save/add flows still need consistent loading and validation affordances.                             |
| Reusable UI              | Mostly pass | Shared controls are established and Ingredients/Mix prop contracts now live in imported type files.                                |
| Supabase source of truth | Pass        | Durable Fridge, Shopping, custom-food, and saved-drink data reads and writes use Supabase; browser storage is limited to transient UI state. |
| Email exposure           | Partial     | Normal profile copy avoids email, but layout fallback and moderation surfaces still use email intentionally.                        |
| Action validation        | Partial     | Validation and constraints exist, but duplicate prevention and pending states are not yet consistently centralized.                 |
| Auth predictability      | Mostly pass | Redirect flow was hardened and documented. Preview/production/local auth still deserves regression tests.                           |
| File/folder structure    | Pass        | Components and icons use namesake folders, props and styles stay with their owners, generic dumping folders are removed, and architecture tests guard the boundaries. |
| Branch workflow          | Pass        | `staging` exists as the integration gate before `main`; new major work should branch from and return to `staging`.                  |
| Verification             | Mostly pass | Type checks and focused regression tests cover the reference catalog; full browser QA remains required.                             |

## Findings

### 1. File Size and Boundaries

Some coordinator files remain long, but line count alone is not a reason to split them.
The risk is whether they absorb reusable UI, validation, formatting, persistence, or
reference-data policy that belongs elsewhere.

| File                                                         | Lines | Risk                                                                                                       |
| ------------------------------------------------------------ | ----: | ---------------------------------------------------------------------------------------------------------- |
| `src/lib/components/ingredients/manual-entry/CustomIngredientForm/CustomIngredientForm.svelte` |  376 | Pass: composes focused reactive controllers and typed step contracts while UI, validation, barcode, submission, and outcome behavior remain separately owned. |
| `src/routes/fridge/+page.svelte`                                           |  971 | Acceptable as route orchestration; repeated panels and list UI are delegated to reusable components.                                |
| `src/routes/mix/+page.svelte`                                              |  869 | Improved: tandem styles, shared controls, DB-owned catalogs, and extracted calculations leave the page focused on wiring.           |
| `src/routes/moderation/+page.svelte`                                       |  338 | Still pending the planned moderation UI rebuild; avoid growing it before that pass.                                                  |
| `src/lib/components/ingredients/nutrition/NutritionPanel/NutritionPanel.svelte`           |   38 | Pass: now a small coordinator around focused nutrition components.                                                                  |

Recommendation: keep coordinator ownership explicit. Extract only when a new change adds
a reusable view, business rule, formatter, persistence operation, or reference-data
decision—not merely to reduce a line count.

### 2. SCSS Variable Usage

The variable system now keeps only direct app-wide design decisions in
`src/styles/_variables.scss`. Obsolete palette, `figma`, `rebuild`, feature-alias, Mix,
and nutrition-label token layers were removed so a maintainer can edit the actual value
without following an alias chain.

Current result:

- Shared app rhythm, typography, shell colors, status roles, and primitive dimensions
  use direct semantic tokens. Component-only values live beside their components.
- `src/lib/utils/storage/storageKeys.ts` contains storage keys only. Nutrient choices, goals, runtime
  thresholds, and data choices come from the database reference catalog. Mix-only chart
  colors live with the Mix route rather than in global app styles.
- New non-trivial components use a component folder containing the Svelte file and its
  paired stylesheet; local `types.ts` files are added only when the component owns types.
- Moderation styling remains intentionally deferred until its planned UI rebuild.
- SVG path coordinates, measured runtime dimensions, animation timing, and standards
  constants are not app-wide design tokens and should not be globalized.

### 3. Box Shadows

`src` currently has no `box-shadow` declarations. This rule is being followed.

Recommendation: keep this as a cheap regression check:

```bash
rg -n "box-shadow" src
```

### 4. Browser Storage vs Supabase

Browser storage is now limited to:

- `DailyWelcome.svelte`: a device-only once-per-day presentation flag.
- `manualEntryDraft.ts`: an account-scoped, session-only unsaved manual-entry draft
  that survives development hot reloads, ordinary page reloads, and short-lived tab
  eviction; evidence photo files are intentionally excluded and successful or
  intentional sheet closure clears the draft.
- `mixState.ts`: an account-scoped unsaved Mix draft and nutrient-goal recovery state;
  Supabase remains authoritative for saved drinks and saved Mix preferences.
- `savedDrinks.ts`: the currently loaded drink identifier in `sessionStorage`, so it is
  discarded with the tab session.
- `storageScope.ts`: user scoping plus one-time removal of obsolete durable browser
  mirrors from the earlier local-first architecture.

Fridge, Shopping List, custom foods, and saved drinks no longer read or write durable
browser copies. Database failures render retryable errors instead of silently restoring
stale local records. The old generic local TTL cache and repository-level nutrition
dataset cache have been removed. Nutrition dataset import downloads now use disposable
operating-system temporary directories; the imported checksum, provenance, and rows are
stored in Supabase.

### 5. Email Exposure

The normal profile flow correctly tells users their email is not shown. The layout still
falls back to email if display name is unavailable, and moderation pages intentionally
show admin-only email data.

Recommendation:

- For public/normal app chrome, show display name first, then email prefix fallback,
  never full email.
- Keep full email restricted to moderation/admin surfaces only.
- Add a small utility for display identity so every component formats identity the same
  way.

### 6. Reusable Components

Current structure is understandable:

- `src/lib/components/common`
- `src/lib/components/app`
- `src/lib/components/auth`
- `src/lib/components/ingredients`
- `src/lib/components/mix`
- `src/lib/components/illustrations/fruit`

Strong reusable pieces already exist in namesake folders:

- `CloseButton/CloseButton.svelte`
- `Pill/Pill.svelte`
- `PillRow/PillRow.svelte`
- `FoodListSection/FoodListSection.svelte`
- `ListControls/ListControls.svelte`
- `Pagination/Pagination.svelte`
- `SortSelect/SortSelect.svelte`
- `ConfirmationDialog/ConfirmationDialog.svelte`
- `TextInputDialog/TextInputDialog.svelte`

Current result:

- Ingredients and Mix use shared button, badge, icon-frame, list, loading, pagination,
  and form primitives.
- Component and page prop contracts are imported from focused `types.ts` files rather
  than declared inline.
- Component-only prop contracts live with their namesake component; parent type files
  contain only shared sibling contracts.
- Dead components and utilities, empty directories, and the old generic `src/defaults`
  folder were removed during the full ownership audit.
- Feature components may still own genuinely unique semantic controls, but repeated
  controls must extend the shared primitives.

### 7. Authentication and Security

Auth has dedicated utilities and docs:

- `src/lib/utils/auth/authFlow.ts`
- `src/lib/utils/auth/authUrls.ts`
- `src/routes/auth/callback/+server.ts`
- `docs/authentication.md`

Current direction is sound:

- Auth callback is server-side.
- Redirect behavior accounts for localhost, Vercel previews, and production.
- Password policy and upgrade flow are separated.
- Moderation/admin access has database and route-level concepts.

Recommendation:

- Add tests for preview URL redirect behavior.
- Keep the Supabase URL allow list documented with examples for local, production, and
  preview.
- Avoid relying on Supabase Site URL for environment-specific returns; always pass
  explicit redirect URLs from the app.

### 8. Product and Nutrition Data

Product catalog, normalized nutrients, barcode lookup, generic datasets, and custom
foods now have clear domains.

Current result:

- Approved source mappings, nutrient equivalences, display profiles, manual-entry
  groups, Mix goals/runtime policy, source identities, serving units, and category
  symbols are database-owned.
- Missing nutrients remain `null`; a reported zero remains a real zero. Calories are
  derived only when all required macro inputs are present.
- Unsafe fuzzy parent/sub-nutrient substitutions are disabled and explicitly rejected.
- Runtime code performs arithmetic and orchestration but does not own source-derived
  nutrient names, units, aliases, conversions, or display catalogs.
- Source, timestamp, barcode, serving basis, field provenance, and quality details must
  remain attached when reusable products are normalized into Supabase.

### 9. UI Flow Complexity

The app has powerful features, but the user flow can still become jumpy:

- Search result → nutrition panel → add to list.
- Barcode scan → extra info → save custom ingredient → add to list.
- List item → mix selection → amount adjustment → graph → suggestions → save.

Recommendation:

- Ingredient entry should end with one clear question: “Add to On Hand or Shopping
  List?”
- After a custom/barcode product is saved, collapse manual details and scroll/focus to
  the next required action.
- Avoid making the user find the nutrition panel to finish an add flow.

### 10. Folder and File Structure

The folder structure is now directionally good. It is domain-oriented and easy to scan.

What is not yet “beautiful”:

- Large components are doing too much.
- Route pages still contain enough local styles and logic to hide the actual page
  intent.
- Some utility domains overlap: `food`, `storage/supabase`, `products`, and `barcode`
  need explicit boundaries.

Recommended boundaries:

- `food`: local nutrition models and data normalization.
- `products`: shared catalog, submissions, verification, cross-source product records.
- `barcode`: scanner adapters, barcode parsing, source lookup orchestration.
- `storage/supabase`: persistence adapters only.
- `mix`: smoothie-specific calculations and UI state.

## Priority Cleanup Plan

### Immediate

1. Complete browser and visual QA for the database-driven manual-entry nutrient groups.
2. Verify missing nutrients remain `null` in canonical/API data while ingredient labels,
   Mix totals, and exports consistently apply the app's zero fallback without partial-data warnings.
3. Apply the same token/type audit when rebuilding the moderation view.
4. Keep redirect/auth utility tests current for local, production, and preview URLs.

### Next

1. Create a shared identity display utility to avoid full email in normal UI.
2. Convert raw route styles to semantic tokens as each remaining view is rebuilt.
3. Keep list/search/pagination controls identical across fridge, shopping, Mix, and
   saved drinks.
4. Add browser QA for reference-catalog load failure and retry states.

### Later

1. Move product-source and nutrient-quality metadata deeper into the shared catalog
   flow.
2. Add a lightweight architecture doc that defines component, route, utility, server,
   and migration boundaries.

## Checks Run

```bash
git status --short --branch
find src/lib/components -maxdepth 2 -type d | sort
find src/lib/utils -maxdepth 3 -type d | sort
rg -n "box-shadow" src
rg -n "localStorage|sessionStorage" src/lib src/routes --glob '!src/lib/types/database.types.ts'
rg -n "\\.email|email" src/lib src/routes --glob '!src/lib/types/database.types.ts'
rg -n "#[0-9a-fA-F]{3,8}|rgb\\(|rgba\\(" src --glob '*.svelte' --glob '*.ts' --glob '*.scss' --glob '!src/styles/_variables.scss'
rg -n "(padding|margin|gap|font-size|font-weight|border-radius): [0-9]" src --glob '*.svelte' --glob '*.scss' --glob '!src/styles/_variables.scss'
wc -l src/routes/fridge/+page.svelte src/routes/mix/+page.svelte src/routes/saved/+page.svelte src/routes/moderation/+page.svelte src/routes/auth/+page.svelte src/lib/components/ingredients/manual-entry/CustomIngredientForm/CustomIngredientForm.svelte src/lib/components/ingredients/nutrition/NutritionPanel/NutritionPanel.svelte src/lib/components/mix/insights/PointShape/PointShape.svelte src/lib/components/mix/insights/NutrientAdjustmentSuggestions/NutrientAdjustmentSuggestions.svelte src/lib/components/mix/ingredients/IngredientCard/IngredientCard.svelte src/lib/components/ingredients/search/IngredientSearch/IngredientSearch.svelte
```
