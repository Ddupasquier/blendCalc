# Development Rules Audit

Date: 2026-06-15  
Branch: `audit-development-rules`  
Baseline: `main` after merging `compact-ingredient-scan-ui`

## Navigation

Markdown cannot provide a true sticky sidebar in every editor, so this document
uses a clickable navigation block instead.

- [Development Rules](#development-rules)
- [Core Engineering Rules](#rule-best-practices)
- [Browser And Mobile Compatibility](#rule-browser-compatibility)
- [Accessibility](#rule-accessibility)
- [Search Relevance](#rule-search-relevance)
- [Explicit Pagination Controls](#rule-pagination-controls)
- [Design Tokens And Spacing](#rule-design-tokens)
- [Shared Style Utilities](#rule-shared-style-utilities)
- [Reusable Components And Buttons](#rule-reusable-components)
- [Circular Icon Alignment](#rule-circular-icon-alignment)
- [Destructive Action Confirmation](#rule-destructive-action-confirmation)
- [Component And Route Boundaries](#rule-component-boundaries)
- [Manual Entry Modularization](#rule-manual-entry-modularization)
- [Database And API-Driven Data](#rule-no-hardcoded-reference-data)
- [Source-Backed Food Images](#rule-source-backed-food-images)
- [Backend And Validation](#rule-backend-best-practices)
- [Exclusive Ingredient List Membership](#rule-exclusive-list-membership)
- [Sheets, Views, And URL State](#rule-bottom-sheet-flows)
- [Privileged Actions](#rule-privileged-action-badges)
- [QA Process](#rule-qa-process)
- [Audit Summary](#audit-summary)
- [Findings](#findings)

## Development Rules

These are the working rules gathered from prior product and implementation decisions.

0. <a id="rule-best-practices"></a>Best practices are mandatory across every layer of the app. Do not treat speed, visual iteration, or partial refactors as permission to bypass maintainability, accessibility, data integrity, security, reusable primitives, design tokens, tested behavior, clean architecture, or clear database ownership. If a requested implementation conflicts with these rules or a defensible best practice, stop and call out the conflict before writing code.
1. Build mobile-first. Every screen and component should work on narrow phones before wider layouts.
1a. <a id="rule-browser-compatibility"></a>Build and test browser features against an explicit compatibility floor. The current app floor is Safari/iOS 16.4, Chrome/Android 111, Edge 111, and Firefox 113. Keep Vite and CSS build targets explicit, provide `vh` before `dvh` fallbacks, account for device safe areas, and feature-detect optional browser APIs instead of assuming they exist. Camera, clipboard, sharing, storage, and other device-backed features must fail with useful guidance and preserve a non-device fallback when practical. Do not use browser-name checks when capability checks can answer the real question. Before handoff, test the current and previous two stable desktop releases plus real or emulated iOS Safari and Android Chrome at portrait and landscape sizes.
1b. <a id="rule-accessibility"></a>Target WCAG 2.2 AA and treat accessibility as part of normal implementation, not a later polish pass. Use native semantic elements first; add ARIA only when the resulting pattern is valid. Every control needs an accessible name, keyboard operation, visible focus, honest state, and a practical touch target. Dialogs and modal sheets must move focus inside, keep focus inside while modal, close with Escape where a keyboard is present, and return focus to the opening control. Announce loading, validation, and result-count changes without duplicating visible warnings. Honor reduced-motion settings, preserve content at 200% text zoom, avoid color-only meaning, and verify important flows with VoiceOver on Safari and TalkBack on Android Chrome.
2. Keep the user flow simple. Barcode scanning, search, manual entry, fridge, shopping, mix, and saved drinks should feel like a guided flow instead of disconnected tasks.
2a. <a id="rule-search-relevance"></a>Search candidate gathering, cross-source deduplication, preference-aware ordering, relevance ranking, and pagination belong on the server so the UI only renders the ordered result pages. Rank direct description matches before metadata-only matches, prioritize matches within the first three description words, and keep later matches available below stronger results. Use exact required-word queries first and a wider partial-word fallback for unfinished input; do not replace real search with hardcoded correction lists. Source quality, user preferences, and alphabetical order are tie-breakers after textual relevance, not substitutes for relevance. Keep local client search only as an explicit failure fallback for private cached data.
2b. <a id="rule-pagination-controls"></a>Paginated result lists must use bounded server pages, loading guards, stable ordering, and the shared footer containing explicit `Load more` and `Return to top` controls. Never fetch another page from a scroll threshold or intersection observer; loading must require a deliberate user action and preserve the current scroll position. Show `Load more` only while another page exists. Show `Return to top` only when the list actually overflows its scroll area. Use `PaginatedListControls.svelte` instead of rebuilding these controls inside a feature.
3. <a id="rule-design-tokens"></a>Use design tokens. Colors, spacing, font sizes, font weights, radii, and breakpoints should come from SCSS variables wherever practical. Component styles should consume readable semantic tokens for their domain or shared primitive (`$ingredient-*`, `$app-shell-*`, etc.) instead of raw source/provenance tokens such as `$color-figma-*` or `$app-rebuild-*`; keep those low-level aliases centralized in `src/styles/_variables.scss`.
3a. <a id="rule-spacing-tokens"></a>Use shared spacing tokens for all component and section spacing. Adjacent UI sections in rebuilt app views should use `$app-vertical-stack-gap` (`.75rem`) vertically and `$app-horizontal-control-gap` horizontally unless a smaller internal/micro-layout token is explicitly needed. Do not add raw `rem`, `px`, or `em` spacing values inside component styles; add or reuse a semantic SCSS variable instead.
3b. <a id="rule-shared-style-utilities"></a>Centralize repeated styling behavior. If the same accessibility helper, visually hidden text pattern, focus treatment, viewport fallback, motion preference, card shell, control state, or layout pattern appears in two places, move it into a shared utility, primitive, mixin, or token-backed class instead of maintaining feature-local copies. Keep genuinely unique component presentation local; do not create abstractions with no second use. Shared utilities must use semantic SCSS tokens and must not become a dumping ground for unrelated feature styles.
4. Do not use box shadows. Use borders, spacing, and background contrast instead.
5. Keep the visual style calm, polished, and not overstimulating. Accent colors should be rare and intentional.
6. Make important actions obvious. Barcode scan, save, add, and confirm actions should be easy to find without overwhelming the screen.
7. <a id="rule-reusable-components"></a>Prefer reusable components for repeated UI. One-off components are a strong code smell. If two components, blocks, controls, cards, rows, dialogs, sheets, pills, headers, action areas, or list sections are basically the same, extract or extend a reusable component instead of copying the pattern. Do not reimplement close buttons, pagination, sorting, controls, icons, spacing wrappers, or card shells ad hoc. A one-off is acceptable only when the UI and behavior are genuinely unique and unlikely to repeat; if that changes later, refactor immediately.
8. <a id="rule-button-primitives"></a>All app buttons must use shared button primitives. Circular icon actions, square icon controls, and rounded rectangle CTAs must render through reusable components so icon swaps, spacing, tap targets, disabled states, loading states, and typography stay consistent. Do not hardcode button dimensions, icon centering, icon wrappers, hover states, active states, disabled states, or one-off button layouts inside feature components. If a needed button shape or state does not already exist, extend or create the shared primitive first, then use it in the feature.
8a. <a id="rule-circular-icon-alignment"></a>Every icon inside a circular container must be centered both horizontally and vertically by the shared `CenteredIcon` layer. Interactive circles must use `CircleIconButton`, `CloseButton`, or another approved shared button; non-interactive icon circles must use `CircularIconFrame` through a focused component such as `StatusIconBadge`; circular avatars, food symbols, and image previews must use `CircularMediaFrame`. These primitives own equal width and height, `inline-grid` or `grid` with `place-items: center`, clipping, token-backed container/icon sizing, `line-height: 1`, and any reusable token-backed optical correction required by asymmetric SVG artwork. Feature components may set semantic CSS variables on those primitives, but must not recreate circular wrappers, duplicate centering CSS, or compensate with glyph whitespace, manual margins, one-off transforms, or browser-default alignment.
9. <a id="rule-functional-controls"></a>Never render non-functional controls. If something looks clickable, tappable, adjustable, expandable, or actionable, it must perform that behavior, have an honest disabled state, or render as plain non-interactive information instead. Repeating press-and-hold behavior must use a shared control, support touch, mouse, and keyboard input, stop immediately on release or cancellation, and suppress the duplicate click browsers may fire after a pointer or keyboard hold.
9a. <a id="rule-destructive-action-confirmation"></a>Destructive actions that immediately remove user data must use a shared two-step confirmation flow for both touch taps and mouse clicks. The first activation must never change data; it must arm the action, visibly explain that the user must tap or click delete again, and update the control's accessible label. Only a second, distinct activation may run the delete. Apply the same guard to every route into the action, including compact card controls and ingredient action sheets. Use `TwoStepConfirmation.svelte` rather than feature-local timers, `dblclick` handlers, or one-off confirmation messages. The shared guard must reject duplicate handling of the same browser event, expire automatically, preserve keyboard access, prevent mobile double-tap zoom on the control, show a busy/disabled state during the real delete, and use shared design tokens.
10. Treat Supabase as the source of truth for authenticated users. Browser storage should be a scoped cache or temporary UI state, not the durable data model.
11. Avoid exposing user email in normal app UI. Prefer display name, profile name, or a safe fallback.
12. Validate app actions. Prevent duplicate saves, invalid submissions, confusing disabled states, and dead-end flows.
13. Show loading or busy states for actions with network or camera latency.
14. Keep authentication secure and predictable across localhost, previews, and production.
15. <a id="rule-code-organization"></a>Keep files and folders maintainable, clean, and beautiful. Structure should make the UI location and domain purpose obvious.
16. <a id="rule-component-boundaries"></a>Extract reusable components and utilities whenever practical. Repeated UI, repeated functions, long route files, oversized component styles, and duplicated business logic are maintenance problems. Views should orchestrate; components should render focused UI; utilities should hold reusable calculations, formatting, filtering, sorting, validation, and storage helpers.
16a. <a id="rule-manual-entry-modularization"></a>Use the current manual entry split as the modularization standard for future feature work. Large flows should keep the parent component responsible for wiring state and child components/utilities responsible for focused UI, lookup flow, submit flow, reset/default state, validation, payload building, and styling. Do not let one file become the home for every new behavior.
    - <a id="rule-manual-entry-parent-role"></a>`CustomIngredientForm.svelte` is the model for parent flow ownership. Parent flow components may own current step, field state, pending flags, loaded reference data, and handler wiring. They should not own dense step markup, large style blocks, repeated display pieces, submission payload building, barcode lookup details, reset defaults, validation message construction, or list outcome behavior.
    - <a id="rule-manual-entry-shells"></a>Shared flow chrome belongs in shell components. `ManualEntryFormShell.svelte` owns common layout concerns such as the sheet/form frame, title area, step tabs, warning placement, body slot, action row, and repeated flow structure. Future multi-step flows should use the same pattern instead of rebuilding headers, tabs, warning rows, and buttons inside every feature.
    - <a id="rule-manual-entry-step-components"></a>Each step gets its own focused component under a clear `steps/` folder. `IdentityStep.svelte`, `ServingsStep.svelte`, `NutrientStep.svelte`, and `ShareStep.svelte` should render one step each, receive values and callbacks from the parent, and avoid direct database/API calls, storage writes, route navigation, or final submit behavior.
    - <a id="rule-manual-entry-step-content"></a>Step switching belongs in a small coordinator component such as `ManualEntryStepContent.svelte`. The parent should not contain a long `{#if}` block full of step markup. The step-content component should only choose which step component to render and pass through the needed props.
    - <a id="rule-manual-entry-display-components"></a>Repeated or self-contained visual pieces should be child components, not inline parent markup. Examples from manual entry include barcode autofill suggestions, scan options, validation lists, outcome messages, nutrient fields, step tabs, and toggles. If a block has its own title, card shape, repeated controls, or conditional rendering, consider a component.
    - <a id="rule-manual-entry-utils"></a>Reusable logic belongs in `utils/` files with plain names that describe the job. Examples from manual entry: `barcodeFlow.ts`, `barcodeScanFlow.ts`, `customFoodPayload.ts`, `formState.ts`, `listOutcome.ts`, `nutrientValues.ts`, `stepNavigation.ts`, `submitFlow.ts`, `submitValidation.ts`, and `validationItems.ts`. Put calculations, defaults, comparisons, payload shaping, navigation decisions, and validation builders there instead of inside Svelte markup.
    - <a id="rule-manual-entry-reference-data"></a>Reference data loading belongs in a focused data utility, not in step components. Manual entry uses `manualEntryReferenceData.ts` to load category options, nutrient groups, and nutrient relationship rules from the database-backed path. Components render that data; they do not invent fallback lists or hardcode API-derived options.
    - <a id="rule-manual-entry-types"></a>Flow-specific types and constants belong in `formTypes.ts` or `types.ts`, not scattered through components. Step ids, summary item shapes, nutrient value state, validation item shape, and create-handler types should stay centralized so future steps use one shared language.
    - <a id="rule-manual-entry-styles"></a>Large manual-entry styles belong in the paired SCSS file `styles/customIngredientForm.scss`. Keep component files readable by moving large style blocks out, but still use shared SCSS variables for spacing, colors, radii, font sizes, and breakpoints.
    - <a id="rule-manual-entry-growth-check"></a>Before adding manual-entry behavior, decide where it belongs: visual UI in a step/display component, reusable logic in a utility, data loading in a data utility/server path, shared layout in the shell, and only final wiring in `CustomIngredientForm.svelte`. If a change would make the parent component grow materially, split it first.
16b. <a id="rule-route-page-boundaries"></a>Route pages should not own reusable visual sections, sheet collections, dense card markup, or specialized display widgets. Keep route files focused on route state, data loading, and high-level orchestration; move feature chrome, pop-ins, repeated card pieces, search result sorting, and nutrition-label rendering into named components or utilities.
16c. <a id="rule-refactor-findings"></a>When refactoring exposes a repeatable process or architecture issue, add it to these development rules instead of fixing only the current file. Do not create duplicate rule sets elsewhere; update this source of truth and link QA items back here.
16d. <a id="rule-style-file-boundaries"></a>Keep small component styles local, but move large or noisy component/page styles into paired SCSS files when they make the Svelte file hard to scan. Use clear tandem naming such as `Component.svelte` plus `styles/component.scss`, keep style files near the component domain, and continue using shared SCSS variables for spacing, colors, radii, and typography.
16e. <a id="rule-type-file-boundaries"></a>Keep reusable and feature-specific TypeScript types out of Svelte component and route files. Components and pages should import named types from nearby `types.ts`, `formTypes.ts`, or domain utility files instead of declaring local `type` or `interface` blocks. Tiny one-use prop literals are acceptable only when they are simpler than a named type, but repeated option shapes, handler contracts, state shapes, sheet props, and route data contracts must be centralized.
17. Use the branch gate. Every new feature, major addition, and big change gets its own branch from `staging`, merges into `staging` first, and only moves from `staging` to `main` after the staging preview is approved.
18. Treat bypassing staging as a process problem. If a change is headed to `main` without going through `staging`, stop and call that out before merging.
19. Do not automatically add changes to `staging`. Work should stay on the active feature branch or working tree until explicitly approved for staging.
20. Do not auto commit. Show the diff and get explicit approval before committing or pushing changes.
21. Verify meaningful changes with `npm run check`, focused tests, and builds when scope warrants it.
22. For the full mobile UI rebuild, use `mobile-ui-rebuild` as the temporary integration branch. Major rebuild sections branch from `mobile-ui-rebuild`, merge back into `mobile-ui-rebuild` only after approval and checks, and do not move to `staging` until the full rebuild is approved.
23. During the mobile UI rebuild, protected components require explicit written approval before alteration. The graph and barcode scanner are currently protected.
24. <a id="rule-figma-screenshots"></a>Ask for Figma screenshots before implementing any new UI element or materially changing an existing UI element during the mobile UI rebuild. Do not move forward with implementation until the relevant screenshots, states, or explicit visual direction are provided. Match provided screenshots before inventing layout details, and name the exact screenshot references in QA notes for any screenshot-backed UI change.
25. <a id="rule-ui-refactor-new-components"></a>During UI refactors, build new focused components to match the approved Figma examples first, then wire the existing app behavior and data into those components. Do not contort old UI components into the new design when a clean replacement is more maintainable. If the new Figma UI does not show existing data, controls, warnings, states, or behavior currently rendered by the app, pause and confirm whether that functionality should move, be hidden, or be removed before dropping it.
26. Keep database tables and data flow clean, normalized, and maintainable. Canonical source tables should stay focused on canonical data; UI flow metadata, grouping, ordering, and display configuration should live in separate purpose-built tables when that keeps ownership clearer. Before adding schema, inventory existing tables, RLS, indexes, and app access paths to avoid duplicated concepts.
27. <a id="rule-no-hardcoded-reference-data"></a>Do not hardcode DB-backed catalog data, API-derived reference data, nutrient definitions, allergens, dietary restrictions, source labels, or compatibility metadata in components or utility constants. If the app needs reusable reference data, seed it into a table and query it through a focused utility.
28. <a id="rule-api-seed-scripts"></a>If required reference data is not already available in the database, create or extend a script that queries the available source APIs, stores the observed/canonical data in Supabase with source/provenance metadata, and renders from that database data instead of inventing fallback constants.
29. <a id="rule-api-observed-seeds"></a>Seed reusable app data only from API-observed or database-canonical data. Do not hand-write fallback constants, static option lists, nutrient catalogs, category catalogs, allergen catalogs, dietary restriction catalogs, or source-derived metadata. If an API does not expose the needed data directly, write a script that samples every relevant available source API, stores observations/provenance in Supabase, and renders only from the stored database result.
30. <a id="rule-cross-reference-apis"></a>Cross-reference all relevant source APIs before treating seeded reference data as verified. Any script that writes reusable, shared, canonical, or reference data to the database must query every available source API for that data domain, store source names, observation counts, first/last observed timestamps, and enough provenance to distinguish single-source observations from multi-source agreement. If a data domain can only be canonical from one source, still record any available corroborating observations from the other APIs and expose that confidence difference in the data model. Source-specific audit scripts are allowed only when they are clearly named as diagnostics and do not write canonical app data.
30a. <a id="rule-api-rate-limit-handling"></a>API seed/audit scripts must handle temporary failures politely. Retry short-lived server errors with backoff, honor rate-limit responses with longer waits or stop the run, and never keep hammering an API that is returning repeated 429/503 responses. Partial API instability should be documented in the run summary instead of silently treated as complete coverage.
31. <a id="rule-store-useful-api-data"></a>If API audits reveal useful information that belongs in our data model, add the schema and script path needed to store it in Supabase. Sample broadly, roughly 200 representative examples when practical, and persist every legally permitted data point that improves nutrition, product, category, compatibility, source-quality, or user-safety behavior now or later. Store provenance, source, timestamps, and confidence metadata so the app can build its own information bank without losing source context.
31a. <a id="rule-category-resolution"></a>Barcode and manual-entry category autofill must preserve raw API category observations, then resolve the visible app category through database-backed category options/mappings. Do not choose the first raw API category string as the user-facing category. If no confident DB mapping exists, keep the raw source data for moderation/provenance and ask the user to choose a category. Catalog submission, automatic publication, moderator approval, and revision creation must preserve the canonical category foreign key and the raw source categories; they must never replace either with a generic placeholder category.
31b. <a id="rule-source-backed-food-images"></a>Ingredient/product images must follow the same API → DB → UI path as other reference data. Do not render new third-party image URLs directly from live API responses without first storing the image metadata, source, license, attribution, confidence, and fetch timestamp in Supabase. Only store and display images whose source terms allow the app’s use case. User-submitted product evidence remains moderation evidence unless it is approved into a reusable image record.
31c. <a id="rule-image-placement-editor"></a>Image crop, zoom, and placement controls must use shared image-placement components. User-submitted image review, moderation approval, and admin/moderator post-approval adjustment should all share the same editor and crop value shape so card previews, nutrition-page previews, sliders, reset behavior, and saved DB crop fields stay consistent. Do not rebuild one-off crop sliders or image preview boxes in feature components.
32. <a id="rule-loading-states"></a>Every fetch-backed, database-backed, camera-backed, or long-running action needs a clear loading state. While pending, prevent duplicate submissions or duplicate triggers, keep the user informed, and provide useful failure feedback.
33. Do not schedule browser/API fetches during server-side rendering. Fetch route data in SvelteKit `load` functions or server actions, and run client-only lookups from `onMount`, user events, or code guarded with `browser`.
34. <a id="rule-mobile-readability"></a>Keep mobile typography and tap targets readable. Body text should start from a 16px baseline, critical labels and controls should avoid tiny metadata sizing, and interactive controls should target roughly 44px minimum touch size unless there is a documented compact exception.
35. <a id="rule-api-structure-references"></a>Keep external API structure references generated and isolated. When the app needs a full understanding of vendor payload shape, run `npm run generate:api-structures` and store the generated reference files under `docs/api-structures`. These files are documentation only and must not be imported by runtime app code. If runtime types are needed, create curated app-owned types in `src/lib/types` or the relevant `src/lib/utils/**` domain.
36. API structure references must come from observed API responses. Do not write imagined vendor schemas by hand. The generator should use previously observed Supabase query data or explicit script arguments, then hit every external API source the app currently uses for that data domain.
37. <a id="rule-backend-best-practices"></a>Follow best practices across the full stack, especially backend and database design. Do not guess at schema, indexing, query, RLS, or data-flow decisions. For sorting, filtering, pagination, and shared reference data, prefer indexed database queries or focused views that keep the UI thin. Use RPC only when the behavior is complex, transactional, security-sensitive, or meaningfully reusable. Keep backend ownership clear, documented, and maintainable. This rule extends the global [best practices rule](#rule-best-practices), not replaces it.
38. Ingredient manipulation controls should use toggles, buttons, action sheets, or explicit forms instead of raw checkboxes. If a setting behaves like on/off state, use the shared toggle component.
39. <a id="rule-bottom-sheet-flows"></a>Bottom-sheet flows must use the shared `BottomSheet` chrome. Manual entry, filters, ingredient actions, rename/edit sheets, and future sheet content must share the same centered handle, title typography, top spacing, backdrop behavior, Escape/backdrop close behavior, max/min height rules, and bottom-nav anchoring. Back-arrow visibility must be configured through the shared sheet primitive rather than hand-rolled in feature content; manual entry omits the top back arrow because step navigation already provides its own Back controls. Do not hand-roll sheet headers inside individual sheet bodies.
40. <a id="rule-right-sheet-flows"></a>Right-side full-content data views must use the shared `RightSheet` primitive. Search views and future detail/data views that slide in from the right should share the same shell bounds, right-to-left transition, Escape close behavior, content width, and between-header-and-nav layout instead of each feature hand-rolling its own slide-in panel.
41. <a id="rule-qa-process"></a>Maintain `docs/QA/qa-tasks.md` as the local-only active manual QA tracker and `docs/QA/completed-qa-tasks.md` as the local-only completed QA archive. These files and screenshot assets are ignored by git and must not be committed. Every new feature, component, UI, data-flow, or behavior change must add concrete local QA notes before handoff unless it is clearly documentation-only and needs no user verification. QA notes should be created as part of the task, not after the fact. Give every QA section a stable `QA-GGG` group ID and every task a stable `QA-GGG-TTT` ID. Use the next unused number, never reuse or renumber existing IDs, and preserve IDs when archiving tasks.
42. <a id="rule-qa-clearance"></a>Finished tasks must prompt the user to run the relevant QA checks from local `docs/QA/qa-tasks.md`. Keep each QA item active until the user explicitly confirms it passed; a checked checkbox counts as that confirmation. Whenever QA is updated and before every handoff, automatically scan the active tracker and move confirmed, checked items to `docs/QA/completed-qa-tasks.md` without waiting for a separate cleanup request. When a whole section is complete, move its section context with those items. If a checked item needs clarification before archiving, add an unchecked `QA note needed:` prompt under the active section instead of guessing. Never mark an item passed on the user's behalf, and do not silently delete active QA coverage.
43. <a id="rule-view-primitives"></a>Full-height app views and sheet views must use shared view layout primitives (`ViewFrame`, `ViewTop`, `ViewBody`, `ViewFooter`, `ViewHeader`) instead of hand-rolled page grids. Keep always-visible controls in `ViewTop`, place only the intended scroll region in `ViewBody`, and avoid competing nested scroll containers unless a component explicitly owns a sub-scroll area.
44. <a id="rule-sheet-base"></a>Sheet-style overlays must share implementation through `SheetBase`, with thin semantic wrappers for placement-specific behavior (`BottomSheet`, `RightSheet`, and future variants). `SheetBase` owns Escape and backdrop closing, entry focus, modal focus trapping, return focus, slide transitions, safe-area-aware shell bounds, viewport fallbacks, z-index, and scroll containment. Feature sheets provide content and callbacks; they must not duplicate or weaken those behaviors.
45. <a id="rule-icon-components"></a>All app UI icons must be reusable Svelte components under `src/lib/assets/icons` or a clearly named nested icon folder. Avoid raw emoji, one-off inline SVG, CSS-drawn icon glyphs, and ad hoc glyph spans in rendered UI unless the symbol is user-facing text content rather than an icon. Directional chevrons must use the shared `Chevron.svelte` component with a direction prop so shape, stroke, sizing, and accessibility stay consistent; do not create separate feature-local chevron paths or text characters. Feature-specific animated SVG is allowed only inside a reusable, explicitly named icon component.
45a. <a id="rule-privileged-action-badges"></a>Admin-only and moderator-only actions must show the shared crown badge on the action itself. Use the reusable `PrivilegedActionBadge` and shared button/action primitives; do not hardcode crown glyphs, duplicate badge styling, or hide privileged actions behind unmarked generic buttons. The crown is a standalone filled yellow mark without a circular background or border; both profile and action variants must use the shared component and token-backed sizes.
46. <a id="rule-qa-links"></a>QA tasks must include exact reproduction steps, concrete example inputs, observable expected outcomes, exact code references, and links to the relevant development rules. Every task must use the `Repro`, `Example input`, and `Expected` labels. `Repro` must be a numbered bullet list with one exact action per step. Example inputs must name concrete values, commands, roles, files, or UI controls; never use `None` as a shortcut for an incomplete task. Do not create duplicate rule sets inside QA docs; reference this document as the source of truth.
47. <a id="rule-local-recovery-context"></a>Keep temporary recovery checkpoints and decision notes under local-only `docs/local-context/`. Keep that folder ignored by Git. Never store passwords, tokens, environment values, private user data, or raw private reasoning. Verify recovery notes against the current request, development rules, code, migrations, database, and QA tasks before resuming work.
47. <a id="rule-qa-screenshot-assets"></a>If a QA task depends on a specific screenshot reference, copy that screenshot into local-only `docs/QA/assets/` and link to that asset from the QA task. Screenshot-backed QA items must include both the clickable asset reference and the code references being verified. QA screenshots are working QA artifacts, not source-controlled product assets.
48. <a id="rule-db-backed-nutrient-validation"></a>Nutrient relationship validation must be database-backed and enforced on both client and server paths. Rules like child nutrients not exceeding parent nutrients, required source nutrients, and label consistency checks should live in focused Supabase tables with provenance and indexes, then be consumed through shared utilities. Do not add UI-only constants for nutrient math or allow shared/catalog submissions to bypass the same rule set.
49. <a id="rule-db-validation-first"></a>Prioritize database and server validation over client-only validation. Client-side validation is for immediate UX feedback, but every meaningful data integrity rule must be enforced through the database, server actions, API handlers, RPC, constraints, triggers, policies, or indexed validation tables as appropriate. Never rely on browser-only checks to protect canonical data.
49a. <a id="rule-exclusive-list-membership"></a>Fridge and Shopping List are mutually exclusive states for one canonical ingredient identity. The same user must never have the same FDC identity or normalized barcode identity in both lists. Adding an ingredient that already exists in the other list must ask before moving it; confirming must perform one atomic database-backed move, and canceling must leave the existing membership unchanged. Enforce this with a database identity key and unique constraint, not only browser checks or add-then-delete client sequences.
49b. <a id="rule-authoritative-write-paths"></a>Use one authoritative backend write path for each meaningful data domain. Browser code may validate early for responsive feedback, but it must submit through a secured server action, API, or database function that revalidates current database-backed rules and completes related writes atomically. Once the authoritative path is in place, revoke direct browser insert/update privileges that could bypass it. Derive ownership from the authenticated session, never from a user id supplied by the browser, and return small typed outcomes for expected conflicts.
50. <a id="rule-url-backed-popins"></a>Pop-in views, popovers, modals, sheets, scanners, dialogs, and other meaningful overlay states need URL-backed state with stable, readable path slugs. Use paths like `/fridge/search`, `/fridge/manual-entry`, `/fridge/barcode-scanner`, and `/fridge/nutrition/123` instead of hiding major state in local component booleans or query-only URLs. Query params are acceptable for small modifiers, but the main view/overlay identity belongs in the path. Opening, closing, refreshing, direct loading, app-name/base-route navigation, and browser back/forward must go through navigation-aware handlers. When an overlay belongs on top of the current page, update its path with shallow history rather than remounting the page. Opening or closing an overlay must not reload, reset, reorder, repaginate, or move the underlying page content.
51. <a id="rule-input-placeholders"></a>All visible text, search, password, textarea, and number inputs must have helpful placeholders. Required inputs should start blank unless there is a real saved value to edit; do not prefill required fields with fake `0`, `30`, or example values. Placeholder examples are for guidance only and must not become submitted data. Numeric inputs should render blank for missing values so typing a number never appends to a fake default.
52. <a id="rule-schema-first-features"></a>Before creating or changing any feature that stores, verifies, moderates, filters, sorts, or shares data, inspect the current Supabase schema, RLS, indexes, RPC/functions, generated DB types, and documented data flow. Build on what exists before adding new tables or new client logic. If the current schema limits the requested behavior, call out that limit plainly, then fix the data model before layering UI on top.
53. <a id="rule-system-growth"></a>Every feature pass should improve the system, not just add surface behavior. Prefer changes that reduce duplicate code, use existing indexed/backend paths, preserve provenance, improve validation, tighten moderation, or make future changes easier. Do not leave known schema, flow, or ownership problems unspoken.
54. <a id="rule-catalog-divergence-blocks"></a>Shared catalog submissions that are wildly different from an existing barcode match or trusted source should be blocked before they reach normal moderation. This must be server-side and schema-aware. Do not count silent machine blocks the same as human moderator rejections unless that is an explicit product decision, because normal rejections affect the user’s submission-block threshold.

## Audit Summary

| Area | Status | Notes |
| --- | --- | --- |
| Mobile-first UI | Partial | Breakpoints exist, but several dense components still rely on local styling and large files. |
| Simple user flow | Partial | Barcode/manual flow is improving, but ingredient search, nutrition facts, list placement, and mix flow still have many transitions. |
| Design tokens | Partial | Strong variable foundation exists, but hard-coded color, spacing, and font values remain across route and component styles. |
| No box shadows | Pass | `rg -n "box-shadow" src` returned no matches. |
| Calm visual language | Mostly pass | Palette is coherent. Remaining risk is inconsistent typography and one-off component spacing. |
| Obvious key actions | Mostly pass | Barcode scan is now prominent. Save/add flows still need consistent loading and validation affordances. |
| Reusable UI | Mostly pass | `common`, `ingredients`, `mix`, `app`, and `auth` folders are clear. Some page/component styles still duplicate patterns. |
| Supabase source of truth | Partial | Supabase utilities exist, but local storage remains widely used and needs continued narrowing to cache-only behavior. |
| Email exposure | Partial | Normal profile copy avoids email, but layout fallback and moderation surfaces still use email intentionally. |
| Action validation | Partial | Validation and constraints exist, but duplicate prevention and pending states are not yet consistently centralized. |
| Auth predictability | Mostly pass | Redirect flow was hardened and documented. Preview/production/local auth still deserves regression tests. |
| File/folder structure | Partial | Folder names are much better than before. Some files are still too large and mix behavior, markup, and styling. |
| Branch workflow | Pass | `staging` exists as the integration gate before `main`; new major work should branch from and return to `staging`. |
| Verification | Mostly pass | Scripts exist for check/build/tests/database checks. Audit branch has not changed app code yet. |

## Findings

### 1. File Size and Boundaries

Several files are large enough that future changes will become risky:

| File | Lines | Risk |
| --- | ---: | --- |
| `src/lib/components/ingredients/CustomIngredientForm.svelte` | 1324 | Too many responsibilities: barcode/manual entry, nutrients, serving, volume, submission flow, and styling. |
| `src/routes/mix/+page.svelte` | 974 | Page orchestration, state, persistence, and UI wiring are all in one file. |
| `src/routes/moderation/+page.svelte` | 649 | Admin cards, submission review, account review, filtering, and styles should be split. |
| `src/routes/fridge/+page.svelte` | 572 | Page state and ingredient/search/list UI are still tightly coupled. |
| `src/lib/components/ingredients/NutritionPanel.svelte` | 567 | Nutrition-label rendering is specialized and dense; should stay isolated but may need subcomponents. |

Recommendation: prioritize `CustomIngredientForm.svelte` and `mix/+page.svelte`. These are the highest-traffic files and most likely to regress UX.

### 2. SCSS Variable Usage

The variable system is strong and well documented in `src/styles/_variables.scss`. It includes palette primitives, semantic colors, font roles, font weights, spacing, radii, and breakpoints.

Gaps found:

- Hard-coded colors still exist outside variables in `src/defaults/pointShapeDefaults.ts`, `src/defaults/mixDefaults.ts`, `src/lib/components/ingredients/BarcodeScanButton.svelte`, `src/lib/components/common/dialogs/ConfirmationDialog.svelte`, `src/routes/+page.svelte`, and email template inline styles.
- Hard-coded spacing and font weights are common across Svelte components, especially route pages and large components.
- Some hard-coded values are legitimate SVG/animation internals, but many should use `$app-gap-*`, `$app-font-size-*`, `$app-font-weight-*`, `$app-radius-*`, and semantic color tokens.

Recommendation: do not attempt a single global style rewrite. Convert one UI area at a time, starting with shared controls and the ingredient entry flow.

### 3. Box Shadows

`src` currently has no `box-shadow` declarations. This rule is being followed.

Recommendation: keep this as a cheap regression check:

```bash
rg -n "box-shadow" src
```

### 4. Browser Storage vs Supabase

Local/session storage is still used in:

- `src/lib/cache.ts`
- `src/lib/components/app/DailyWelcome.svelte`
- `src/lib/utils/mix/state/mixState.ts`
- `src/lib/utils/mix/ui/mixUi.ts`
- `src/lib/utils/food/customFoods.ts`
- `src/lib/utils/storage/savedDrinks.ts`
- `src/lib/utils/storage/smoothieLists.ts`
- `src/lib/utils/storage/storageScope.ts`

Some usage is valid:

- Daily welcome state is device-specific UI state.
- TTL cache is acceptable for read-through cache.
- Scoped storage helpers reduce cross-user contamination.

Remaining risk:

- Mix state and saved/list state still look capable of functioning as durable local state. That can reintroduce cross-user confusion if sync behavior drifts.

Recommendation: document which storage keys are cache-only, session-only, or migration-only. Long term, make route loaders hydrate from Supabase and write local storage only as recoverable cache.

### 5. Email Exposure

The normal profile flow correctly tells users their email is not shown. The layout still falls back to email if display name is unavailable, and moderation pages intentionally show admin-only email data.

Recommendation:

- For public/normal app chrome, show display name first, then email prefix fallback, never full email.
- Keep full email restricted to moderation/admin surfaces only.
- Add a small utility for display identity so every component formats identity the same way.

### 6. Reusable Components

Current structure is understandable:

- `src/lib/components/common`
- `src/lib/components/app`
- `src/lib/components/auth`
- `src/lib/components/ingredients`
- `src/lib/components/mix`
- `src/lib/components/illustrations/fruit`

Strong reusable pieces already exist:

- `CloseButton.svelte`
- `Pill.svelte`
- `PillRow.svelte`
- `FoodListSection.svelte`
- `ListControls.svelte`
- `Pagination.svelte`
- `SortSelect.svelte`
- `ConfirmationDialog.svelte`
- `TextInputDialog.svelte`

Remaining cleanup:

- Ingredient list sections on fridge and mix should use identical composition.
- Button variants need one shared convention for primary, secondary, mango-highlight, danger, and disabled.
- Large route pages still hold too much styling.

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
- Keep the Supabase URL allow list documented with examples for local, production, and preview.
- Avoid relying on Supabase Site URL for environment-specific returns; always pass explicit redirect URLs from the app.

### 8. Product and Nutrition Data

Product catalog, normalized nutrients, barcode lookup, FDC search, and custom foods now have clear domains.

Risk:

- Nutrition data can come from multiple sources and quality levels. Without clear source/quality metadata in the UI, users may overtrust incomplete data.

Recommendation:

- Continue showing confidence details, but keep them collapsed by default.
- Normalize nutrients into Supabase for products that are reused.
- Preserve source, source timestamp, barcode, serving basis, and quality flags.
- Resolve external nutrient keys, vendor identity, source labels, serving units,
  aliases, and nutrient-specific conversions through normalized DB reference
  tables. Runtime barcode code may perform arithmetic, but it must not own those
  source-derived definitions.

### 9. UI Flow Complexity

The app has powerful features, but the user flow can still become jumpy:

- Search result → nutrition panel → add to list.
- Barcode scan → extra info → save custom ingredient → add to list.
- List item → mix selection → amount adjustment → graph → suggestions → save.

Recommendation:

- Ingredient entry should end with one clear question: “Add to On Hand or Shopping List?”
- After a custom/barcode product is saved, collapse manual details and scroll/focus to the next required action.
- Avoid making the user find the nutrition panel to finish an add flow.

### 10. Folder and File Structure

The folder structure is now directionally good. It is domain-oriented and easy to scan.

What is not yet “beautiful”:

- Large components are doing too much.
- Route pages still contain enough local styles and logic to hide the actual page intent.
- Some utility domains overlap: `food`, `storage/supabase`, `products`, and `barcode` need explicit boundaries.

Recommended boundaries:

- `food`: local nutrition models and data normalization.
- `products`: shared catalog, submissions, verification, cross-source product records.
- `barcode`: scanner adapters, barcode parsing, source lookup orchestration.
- `storage/supabase`: persistence adapters only.
- `mix`: smoothie-specific calculations and UI state.

## Priority Cleanup Plan

### Immediate

1. Split `CustomIngredientForm.svelte` into smaller sections: barcode entry, manual serving details, nutrient inputs, volume equivalent, and post-save destination.
2. Add a shared button variant pattern so button typography, disabled state, and loading state are consistent.
3. Replace hard-coded scanner colors with tokens everywhere in `BarcodeScanButton.svelte`.
4. Add redirect/auth utility tests for local, production, and Vercel preview URLs.

### Next

1. Refactor `mix/+page.svelte` into page orchestration plus smaller panels.
2. Create a shared identity display utility to avoid full email in normal UI.
3. Convert route-page local spacing/font weights to SCSS variables.
4. Make list/search/pagination controls identical across fridge, shopping, mix chooser, and saved drinks.

### Later

1. Narrow local storage to cache-only behavior with clear comments and tests.
2. Move product-source and nutrient-quality metadata deeper into the shared catalog flow.
3. Add a lightweight architecture doc that defines component, route, utility, server, and migration boundaries.

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
wc -l src/routes/fridge/+page.svelte src/routes/mix/+page.svelte src/routes/saved/+page.svelte src/routes/moderation/+page.svelte src/routes/auth/+page.svelte src/lib/components/ingredients/manual-entry/CustomIngredientForm.svelte src/lib/components/ingredients/nutrition/NutritionPanel.svelte src/lib/components/mix/insights/PointShape.svelte src/lib/components/mix/insights/NutrientAdjustmentSuggestions.svelte src/lib/components/mix/ingredients/IngredientCard.svelte src/lib/components/ingredients/search/IngredientSearch.svelte
```
