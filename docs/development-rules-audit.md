# Development Rules Audit

Date: 2026-06-15  
Branch: `audit-development-rules`  
Baseline: `main` after merging `compact-ingredient-scan-ui`

## Development Rules

These are the working rules gathered from prior product and implementation decisions.

1. Build mobile-first. Every screen and component should work on narrow phones before wider layouts.
2. Keep the user flow simple. Barcode scanning, search, manual entry, fridge, shopping, mix, and saved drinks should feel like a guided flow instead of disconnected tasks.
3. Use design tokens. Colors, spacing, font sizes, font weights, radii, and breakpoints should come from SCSS variables wherever practical.
4. Do not use box shadows. Use borders, spacing, and background contrast instead.
5. Keep the visual style calm, polished, and not overstimulating. Accent colors should be rare and intentional.
6. Make important actions obvious. Barcode scan, save, add, and confirm actions should be easy to find without overwhelming the screen.
7. Prefer reusable components for repeated UI. Pills, list sections, close buttons, dialogs, pagination, sorting, and controls should not be reimplemented ad hoc.
8. Treat Supabase as the source of truth for authenticated users. Browser storage should be a scoped cache or temporary UI state, not the durable data model.
9. Avoid exposing user email in normal app UI. Prefer display name, profile name, or a safe fallback.
10. Validate app actions. Prevent duplicate saves, invalid submissions, confusing disabled states, and dead-end flows.
11. Show loading or busy states for actions with network or camera latency.
12. Keep authentication secure and predictable across localhost, previews, and production.
13. Keep files and folders maintainable, clean, and beautiful. Structure should make the UI location and domain purpose obvious.
14. Extract reusable components and utilities whenever practical. Repeated UI, repeated functions, long route files, oversized component styles, and duplicated business logic are maintenance problems. Views should orchestrate; components should render focused UI; utilities should hold reusable calculations, formatting, filtering, sorting, validation, and storage helpers.
15. Use the branch gate. Every new feature, major addition, and big change gets its own branch from `staging`, merges into `staging` first, and only moves from `staging` to `main` after the staging preview is approved.
16. Treat bypassing staging as a process problem. If a change is headed to `main` without going through `staging`, stop and call that out before merging.
17. Do not automatically add changes to `staging`. Work should stay on the active feature branch or working tree until explicitly approved for staging.
18. Do not auto commit. Show the diff and get explicit approval before committing or pushing changes.
19. Verify meaningful changes with `npm run check`, focused tests, and builds when scope warrants it.
20. For the full mobile UI rebuild, use `mobile-ui-rebuild` as the temporary integration branch. Major rebuild sections branch from `mobile-ui-rebuild`, merge back into `mobile-ui-rebuild` only after approval and checks, and do not move to `staging` until the full rebuild is approved.
21. During the mobile UI rebuild, protected components require explicit written approval before alteration. The graph and barcode scanner are currently protected.
22. Ask for Figma screenshots before implementing any new UI element or materially changing an existing UI element during the mobile UI rebuild. Do not move forward with implementation until the relevant screenshots, states, or explicit visual direction are provided. Match provided screenshots before inventing layout details.
23. Keep database tables and data flow clean, normalized, and maintainable. Canonical source tables should stay focused on canonical data; UI flow metadata, grouping, ordering, and display configuration should live in separate purpose-built tables when that keeps ownership clearer. Before adding schema, inventory existing tables, RLS, indexes, and app access paths to avoid duplicated concepts.
24. Do not hardcode DB-backed catalog data, API-derived reference data, nutrient definitions, allergens, dietary restrictions, source labels, or compatibility metadata in components or utility constants. If the app needs reusable reference data, seed it into a table and query it through a focused utility.
25. If required reference data is not already available in the database, create or extend a script that queries the available source APIs, stores the observed/canonical data in Supabase with source/provenance metadata, and renders from that database data instead of inventing fallback constants.
26. Seed reusable app data only from API-observed or database-canonical data. Do not hand-write fallback constants, static option lists, nutrient catalogs, category catalogs, allergen catalogs, dietary restriction catalogs, or source-derived metadata. If an API does not expose the needed data directly, write a script that samples every relevant available source API, stores observations/provenance in Supabase, and renders only from the stored database result.
27. Cross-reference all relevant source APIs before treating seeded reference data as verified. Any script that writes reusable, shared, canonical, or reference data to the database must query every available source API for that data domain, store source names, observation counts, first/last observed timestamps, and enough provenance to distinguish single-source observations from multi-source agreement. If a data domain can only be canonical from one source, still record any available corroborating observations from the other APIs and expose that confidence difference in the data model. Source-specific audit scripts are allowed only when they are clearly named as diagnostics and do not write canonical app data.
28. Every fetch-backed, database-backed, camera-backed, or long-running action needs a clear loading state. While pending, prevent duplicate submissions or duplicate triggers, keep the user informed, and provide useful failure feedback.
29. Do not schedule browser/API fetches during server-side rendering. Fetch route data in SvelteKit `load` functions or server actions, and run client-only lookups from `onMount`, user events, or code guarded with `browser`.
30. Keep mobile typography and tap targets readable. Body text should start from a 16px baseline, critical labels and controls should avoid tiny metadata sizing, and interactive controls should target roughly 44px minimum touch size unless there is a documented compact exception.
31. Keep external API structure references generated and isolated. When the app needs a full understanding of vendor payload shape, run `npm run generate:api-structures` and store the generated reference files under `docs/api-structures`. These files are documentation only and must not be imported by runtime app code. If runtime types are needed, create curated app-owned types in `src/lib/types` or the relevant `src/lib/utils/**` domain.
32. API structure references must come from observed API responses. Do not write imagined vendor schemas by hand. The generator should use previously observed Supabase query data or explicit script arguments, then hit every external API source the app currently uses for that data domain.
33. Follow best practices across the full stack, especially backend and database design. Do not guess at schema, indexing, query, RLS, or data-flow decisions. For sorting, filtering, pagination, and shared reference data, prefer indexed database queries or focused views that keep the UI thin. Use RPC only when the behavior is complex, transactional, security-sensitive, or meaningfully reusable. Keep backend ownership clear, documented, and maintainable.
34. Ingredient manipulation controls should use toggles, buttons, action sheets, or explicit forms instead of raw checkboxes. If a setting behaves like on/off state, use the shared toggle component.

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

- Hard-coded colors still exist outside variables in `src/defaults/pointShapeDefaults.ts`, `src/defaults/mixDefaults.ts`, `src/lib/components/ingredients/BarcodeScanButton.svelte`, `src/lib/components/common/ConfirmationDialog.svelte`, `src/routes/+page.svelte`, and email template inline styles.
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
- `src/lib/utils/mix/mixState.ts`
- `src/lib/utils/mix/mixUi.ts`
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
wc -l src/routes/fridge/+page.svelte src/routes/mix/+page.svelte src/routes/saved/+page.svelte src/routes/moderation/+page.svelte src/routes/auth/+page.svelte src/lib/components/ingredients/CustomIngredientForm.svelte src/lib/components/ingredients/NutritionPanel.svelte src/lib/components/mix/PointShape.svelte src/lib/components/mix/NutrientAdjustmentSuggestions.svelte src/lib/components/mix/IngredientCard.svelte src/lib/components/ingredients/IngredientSearch.svelte
```
