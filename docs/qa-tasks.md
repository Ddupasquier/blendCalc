# QA Tasks

This document tracks manual QA items that need user verification after feature, component, UI, data-flow, or behavior changes.

## QA Process

Follow the [QA process rule](./development-rules-audit.md#rule-qa-process) and [QA clearance rule](./development-rules-audit.md#rule-qa-clearance). This file only tracks active and cleared manual QA items.

## References

- [Development rules](./development-rules-audit.md#development-rules)
- [QA process rule](./development-rules-audit.md#rule-qa-process)
- [QA clearance rule](./development-rules-audit.md#rule-qa-clearance)
- [QA link rule](./development-rules-audit.md#rule-qa-links)
- [UI functionality contract](./ui-functionality.md)
- [Figma theme notes](./figma-theme.md)

## Active QA

### Manual Entry Component Split

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [Component boundaries](./development-rules-audit.md#rule-component-boundaries), [Reusable components](./development-rules-audit.md#rule-reusable-components), [UI refactor components](./development-rules-audit.md#rule-ui-refactor-new-components), [QA link rule](./development-rules-audit.md#rule-qa-links)
- [ ] **Code references:** [`src/lib/components/ingredients/manual-entry/CustomIngredientForm.svelte`](../src/lib/components/ingredients/manual-entry/CustomIngredientForm.svelte), [`src/lib/components/ingredients/manual-entry/steps/IdentityStep.svelte`](../src/lib/components/ingredients/manual-entry/steps/IdentityStep.svelte), [`src/lib/components/ingredients/manual-entry/steps/ServingsStep.svelte`](../src/lib/components/ingredients/manual-entry/steps/ServingsStep.svelte), [`src/lib/components/ingredients/manual-entry/steps/NutrientStep.svelte`](../src/lib/components/ingredients/manual-entry/steps/NutrientStep.svelte), [`src/lib/components/ingredients/manual-entry/steps/ShareStep.svelte`](../src/lib/components/ingredients/manual-entry/steps/ShareStep.svelte)
- [ ] **Route/setup:** Open `/fridge` while signed in, then tap `Enter manually`.
- [ ] **Identity step:** Enter a food name, brand, category, optional UPC/barcode, and toggle `Liquid ingredient`; verify values persist when moving away and back.
- [ ] **Servings step:** Add a serving description and serving weight, then add/remove an extra serving size; verify validation still requires at least one valid serving.
- [ ] **Macros step:** Enter required macro values and optional macro details; verify values persist when moving between tabs.
- [ ] **Extended step:** Open and close nutrient accordions, enter an optional nutrient value, switch tabs, and return; verify entered values remain.
- [ ] **Share step:** Toggle `Share with community`, choose an add destination, submit, and verify the existing custom ingredient save/list placement behavior still works.
- [ ] **Follow-up refactor check:** Confirm `CustomIngredientForm.svelte` is treated as remaining refactor debt until logic/style ownership is split further; it should not grow with new feature logic.

### Ingredients Route Component Boundary Follow-Up

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [Component boundaries](./development-rules-audit.md#rule-component-boundaries), [View primitives](./development-rules-audit.md#rule-view-primitives), [UI refactor components](./development-rules-audit.md#rule-ui-refactor-new-components), [QA link rule](./development-rules-audit.md#rule-qa-links)
- [ ] **Code references:** [`src/routes/fridge/+page.svelte`](../src/routes/fridge/+page.svelte), [`src/lib/components/ingredients/list/`](../src/lib/components/ingredients/list/), [`src/lib/components/ingredients/search/`](../src/lib/components/ingredients/search/), [`src/lib/components/ingredients/sheets/`](../src/lib/components/ingredients/sheets/)
- [ ] **Route/setup:** Open `/fridge` while signed in with fridge and shopping-list ingredients.
- [ ] **Scope check:** Verify new ingredient-page features are added as focused components/utilities instead of growing `src/routes/fridge/+page.svelte`.
- [ ] **Behavior check:** Verify the route still orchestrates state, while list cards, list tabs, bulk actions, search view, filters, manual entry, action sheet, and nutrition detail rendering stay in dedicated components.
- [ ] **Regression check:** Any future ingredient route change should include before/after QA notes for the exact component touched rather than one generic `/fridge` smoke test.

### API-Driven Manual Entry Reference Data

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [No hardcoded reference data](./development-rules-audit.md#rule-no-hardcoded-reference-data), [API seed scripts](./development-rules-audit.md#rule-api-seed-scripts), [API-observed seeds](./development-rules-audit.md#rule-api-observed-seeds), [Cross-reference APIs](./development-rules-audit.md#rule-cross-reference-apis), [Backend best practices](./development-rules-audit.md#rule-backend-best-practices), [QA link rule](./development-rules-audit.md#rule-qa-links)
- [ ] **Code references:** [`scripts/seed_manual_entry_nutrients.mjs`](../scripts/seed_manual_entry_nutrients.mjs), [`scripts/seed_custom_food_categories.mjs`](../scripts/seed_custom_food_categories.mjs), [`src/lib/utils/food/nutrientDefinitions.ts`](../src/lib/utils/food/nutrientDefinitions.ts), [`src/lib/utils/food/categoryOptions.ts`](../src/lib/utils/food/categoryOptions.ts)
- [ ] **Database setup:** Confirm the remote or local database has run the current manual-entry/category migrations and seed scripts.
- [ ] **Manual nutrient source:** Open `/fridge` → `Enter manually` → `Extended`; verify nutrient groups and fields render from database-backed results, not fallback constants.
- [ ] **Manual category source:** Open `/fridge` → `Enter manually` → `Identity`; verify the `Category` dropdown is populated, sorted A-Z, and contains API-observed categories.
- [ ] **Failure state:** Temporarily test with a missing/empty category or nutrient result set if practical; verify the UI shows a useful loading/error message instead of silently rendering stale hardcoded options.

### Backend List Filtering and Sorting Support

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [Backend best practices](./development-rules-audit.md#rule-backend-best-practices), [Loading states](./development-rules-audit.md#rule-loading-states), [QA link rule](./development-rules-audit.md#rule-qa-links)
- [ ] **Code references:** [`supabase/migrations/20260628193000_user_food_list_filter_indexes.sql`](../supabase/migrations/20260628193000_user_food_list_filter_indexes.sql), [`src/lib/utils/storage/supabase/lists.ts`](../src/lib/utils/storage/supabase/lists.ts), [`src/routes/fridge/+page.svelte`](../src/routes/fridge/+page.svelte)
- [ ] **Database setup:** Push/apply the list filter index migration before testing large-list behavior.
- [ ] **Newest first:** Open `/fridge` with at least 20 fridge items; verify the default list order is newest-to-oldest and resets to the initial visible batch after a hard refresh.
- [ ] **Source filtering:** Open the filter sheet, choose each source filter (`All sources`, `USDA FDC`, `Shared & verified`, `Custom`), tap `Apply`, and verify results filter across the full saved list, not just currently rendered items.
- [ ] **Search filtering:** Search saved fridge/shopping ingredients by a known name and brand/category term; verify filtering searches all saved rows and not just the loaded batch.
- [ ] **Pagination behavior:** Scroll to the bottom of a long fridge/shopping list and verify more items load automatically; if auto-load fails, verify the manual fallback load button appears and works.

### App Icon Component Conversion

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [Icon components](./development-rules-audit.md#rule-icon-components), [Reusable components](./development-rules-audit.md#rule-reusable-components), [QA link rule](./development-rules-audit.md#rule-qa-links)
- [ ] **Code references:** [`src/lib/assets/icons/SmoothieCup.svelte`](../src/lib/assets/icons/SmoothieCup.svelte), [`src/lib/assets/icons/Crown.svelte`](../src/lib/assets/icons/Crown.svelte), [`src/lib/components/app/AppHeader.svelte`](../src/lib/components/app/AppHeader.svelte)
- [ ] **Header icon:** Open `/fridge`, `/mix`, and `/saved`; verify the Smoothie Mixer cup mark renders consistently in the app header with no raw emoji fallback.
- [ ] **Moderator crown:** Sign in as a moderator/admin user; verify the crown badge renders over the profile icon consistently and does not shift header alignment.
- [ ] **Non-moderator state:** Sign in as a normal user; verify the crown badge is hidden and header spacing stays unchanged.

### Reusable View Layout Primitives

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [View primitives](./development-rules-audit.md#rule-view-primitives), [UI refactor components](./development-rules-audit.md#rule-ui-refactor-new-components), [QA process](./development-rules-audit.md#rule-qa-process)
- [ ] **Code references:** [`src/lib/components/common/view/`](../src/lib/components/common/view/), [`src/routes/fridge/+page.svelte`](../src/routes/fridge/+page.svelte), [`src/lib/components/ingredients/search/IngredientSearchView.svelte`](../src/lib/components/ingredients/search/IngredientSearchView.svelte)
- [ ] **Route/setup:** Open `/fridge` while signed in with at least 15 saved fridge or shopping-list ingredients.
- [ ] **Ingredients page layout:** Verify the page title, subtitle, search trigger, scan button, filter button, manual-entry launcher, fridge/shopping tabs, and bulk action row are stacked top-to-bottom with no overlap.
- [ ] **Short viewport regression:** Resize the browser height to roughly 650px or use mobile device emulation; verify the manual-entry row does not overlap the fridge/shopping tabs and the tabs do not overlap the first ingredient card.
- [ ] **Scroll ownership:** Scroll the visible ingredient cards; verify only the card list scrolls while the title/search/manual-entry/tabs area stays fixed in place.
- [ ] **Active search route:** Tap the search-looking control on `/fridge`; verify the active search view fills the app content area between the app header and bottom nav.
- [ ] **Active search scroll:** Search for `tomato`, then scroll results; verify the search title/search row stays visible while only results scroll.
- [ ] **Regression:** Confirm the browser page itself does not get a second accidental page scrollbar outside the intended list or search-result scroll regions.

### Shared Sheet Base

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [Sheet base](./development-rules-audit.md#rule-sheet-base), [Bottom-sheet flows](./development-rules-audit.md#rule-bottom-sheet-flows), [Right-sheet flows](./development-rules-audit.md#rule-right-sheet-flows), [QA process](./development-rules-audit.md#rule-qa-process)
- [ ] **Code references:** [`src/lib/components/common/sheets/SheetBase.svelte`](../src/lib/components/common/sheets/SheetBase.svelte), [`src/lib/components/common/BottomSheet.svelte`](../src/lib/components/common/BottomSheet.svelte), [`src/lib/components/common/RightSheet.svelte`](../src/lib/components/common/RightSheet.svelte), [`src/routes/fridge/+page.svelte`](../src/routes/fridge/+page.svelte)
- [ ] Open manual entry, filter/sort, ingredient actions, and rename ingredient; confirm each still uses bottom-sheet behavior and rests above the bottom nav.
- [ ] Open active ingredient search; confirm it still uses right-sheet behavior, slides in from the right, and fills the content area between header and bottom nav.
- [ ] Confirm `Escape` closes both bottom-sheet and right-sheet flows.
- [ ] Confirm backdrop tap closes bottom sheets without triggering underlying controls.
- [ ] Confirm the right-sheet search view remains opaque and does not show app content through gaps.

### Ingredient SCSS Token Audit

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [Design tokens](./development-rules-audit.md#rule-design-tokens), [Reusable components](./development-rules-audit.md#rule-reusable-components), [QA process](./development-rules-audit.md#rule-qa-process)
- [ ] **Code references:** [`src/styles/_variables.scss`](../src/styles/_variables.scss), [`src/routes/fridge/+page.svelte`](../src/routes/fridge/+page.svelte), [`src/lib/components/ingredients/`](../src/lib/components/ingredients/), [`src/lib/components/common/BottomSheet.svelte`](../src/lib/components/common/BottomSheet.svelte), [`src/lib/components/common/RightSheet.svelte`](../src/lib/components/common/RightSheet.svelte)
- [ ] Verify the ingredients page still matches the current rebuild direction after token renaming: header/content width, search row, manual entry row, tabs, ingredient cards, action buttons, bottom sheet, and active search view.
- [ ] Open filters, manual entry, barcode scan, ingredient edit, and search active view; confirm spacing, colors, radii, and typography did not regress.
- [ ] In manual entry, trigger validation errors/warnings and saved/catalog status messages; confirm the status colors still read correctly after moving status styling to ingredient semantic tokens.
- [ ] Confirm the token cleanup did not alter data behavior: list loading, search result selection, add-to-fridge/shopping, manual entry submission, and barcode lookup still work as before.
- [ ] Confirm future ingredient-route styles use `$ingredient-*` tokens and shared shell primitives use `$app-shell-*` tokens instead of raw `$color-figma-*` or `$app-rebuild-*` values.

### Ingredient Search Active View

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [Right-sheet flows](./development-rules-audit.md#rule-right-sheet-flows), [View primitives](./development-rules-audit.md#rule-view-primitives), [UI refactor components](./development-rules-audit.md#rule-ui-refactor-new-components), [QA process](./development-rules-audit.md#rule-qa-process)
- [ ] **Code references:** [`src/routes/fridge/+page.svelte`](../src/routes/fridge/+page.svelte), [`src/lib/components/common/RightSheet.svelte`](../src/lib/components/common/RightSheet.svelte), [`src/lib/components/ingredients/search/IngredientSearchTrigger.svelte`](../src/lib/components/ingredients/search/IngredientSearchTrigger.svelte), [`src/lib/components/ingredients/search/IngredientSearchView.svelte`](../src/lib/components/ingredients/search/IngredientSearchView.svelte), [`src/lib/components/ingredients/search/IngredientSearch.svelte`](../src/lib/components/ingredients/search/IngredientSearch.svelte), [`src/lib/components/ingredients/nutrition/NutritionDetailView.svelte`](../src/lib/components/ingredients/nutrition/NutritionDetailView.svelte)
- [ ] On the ingredients page, tap/click the search-looking control and verify the active search view slides in from the right.
- [ ] Confirm the main search control is a button-style trigger, not the live text input.
- [ ] Confirm the active search view matches the provided Figma direction: title/subtitle, search row, scan button, filter button, quick-key hints, and result cards.
- [ ] Confirm search results span the active search view width instead of being constrained to the input column.
- [ ] Confirm the active search view fills the content area between header and bottom nav with an opaque surface; no ingredient page text, controls, cards, or gaps should show through behind it.
- [ ] Confirm the search view content stretches to the full available height and the results area uses the remaining vertical space instead of collapsing to content height.
- [ ] Confirm long search result lists scroll with the active search view rather than inside a small nested result box.
- [ ] Type a term in the active search view and verify results render there without changing fridge/shopping list data.
- [ ] Select a result and verify the active search view closes, the nutrition facts detail view slides in from the right, and the existing add-to-fridge/shopping flow still works.
- [ ] Press `Escape` while the active search view is open and verify it closes without changing list data.
- [ ] From the active search view, tap scan and filter controls and verify they open the existing scanner/manual-entry and filter flows without leaving the search view stuck open.

### Nutrition Detail Right Sheet

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [Right-sheet flows](./development-rules-audit.md#rule-right-sheet-flows), [UI refactor components](./development-rules-audit.md#rule-ui-refactor-new-components), [QA process](./development-rules-audit.md#rule-qa-process)
- [ ] **Code references:** [`src/routes/fridge/+page.svelte`](../src/routes/fridge/+page.svelte), [`src/lib/components/ingredients/nutrition/NutritionDetailView.svelte`](../src/lib/components/ingredients/nutrition/NutritionDetailView.svelte), [`src/lib/components/ingredients/nutrition/NutritionPanel.svelte`](../src/lib/components/ingredients/nutrition/NutritionPanel.svelte), [`src/lib/components/common/RightSheet.svelte`](../src/lib/components/common/RightSheet.svelte)
- [ ] From active search, select a result and confirm nutrition facts open in a right-side detail view instead of inline on the ingredients page.
- [ ] From a fridge/shopping ingredient card, open nutrition details and confirm the same right-side detail view is used.
- [ ] Confirm the detail view header shows a back button, ingredient name, and viewing amount row above the nutrition facts label.
- [ ] Confirm the back button and `Escape` close the detail view without changing list data.
- [ ] Use the Add to Fridge and Shopping List controls from the detail view and confirm the existing duplicate/move/list refresh behavior still works.
- [ ] Confirm the main ingredients view no longer shows an inline nutrition facts preview above the fridge/shopping list.

### Right Sheet Reusable Shell

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [Right-sheet flows](./development-rules-audit.md#rule-right-sheet-flows), [Sheet base](./development-rules-audit.md#rule-sheet-base), [QA process](./development-rules-audit.md#rule-qa-process)
- [ ] **Code references:** [`src/lib/components/common/RightSheet.svelte`](../src/lib/components/common/RightSheet.svelte), [`src/routes/fridge/+page.svelte`](../src/routes/fridge/+page.svelte)
- [ ] Open the ingredient search active view and confirm it still slides in from the right, fills the content area between header and bottom nav, and closes with `Escape`.
- [ ] Confirm the right sheet is not clipped by the ingredient page scroll container and does not reveal underlying page content along the sides, top, or between search/results sections.
- [ ] Confirm the search active view uses the shared `RightSheet` primitive and does not depend on the removed `SlideInView` component name.
- [ ] When another right-side data view is added, confirm it uses the same shell behavior rather than a one-off slide panel.

### Ingredient Search Keyboard Navigation

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [UI refactor components](./development-rules-audit.md#rule-ui-refactor-new-components), [QA process](./development-rules-audit.md#rule-qa-process)
- [ ] **Code references:** [`src/lib/components/ingredients/search/IngredientSearch.svelte`](../src/lib/components/ingredients/search/IngredientSearch.svelte), [`src/lib/components/ingredients/search/SearchDropdown.svelte`](../src/lib/components/ingredients/search/SearchDropdown.svelte)
- [ ] Type a search term that returns results and verify only relevant quick-key hints appear: `↑↓ choose result` and `↵ view nutrition`.
- [ ] Press `ArrowDown` and `ArrowUp`; verify the active result visibly changes.
- [ ] Press `Enter`; verify the active result is selected and added through the normal ingredient flow.
- [ ] Confirm `Space`, `Backspace`, and old pill-style behavior are not treated as custom shortcuts.
- [ ] Confirm search still works by clicking/tapping a result on mobile.

### Manual Entry Extended Nutrients

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [No hardcoded reference data](./development-rules-audit.md#rule-no-hardcoded-reference-data), [Backend best practices](./development-rules-audit.md#rule-backend-best-practices), [QA process](./development-rules-audit.md#rule-qa-process)
- [ ] **Code references:** [`src/lib/components/ingredients/manual-entry/CustomIngredientForm.svelte`](../src/lib/components/ingredients/manual-entry/CustomIngredientForm.svelte), [`src/lib/components/ingredients/manual-entry/ManualEntryNutrientFields.svelte`](../src/lib/components/ingredients/manual-entry/ManualEntryNutrientFields.svelte), [`src/lib/utils/food/nutrientDefinitions.ts`](../src/lib/utils/food/nutrientDefinitions.ts)
- [ ] Open manual entry, continue to the Extended step, and confirm every nutrient group, including Vitamins, starts collapsed.
- [ ] Confirm tapping each nutrient group opens and closes only that group without losing entered nutrient values.
- [ ] Confirm the Macros step still keeps its first nutrient group open by default.

### Bottom Sheet Header Consistency

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Rule references:** [Bottom-sheet flows](./development-rules-audit.md#rule-bottom-sheet-flows), [Sheet base](./development-rules-audit.md#rule-sheet-base), [QA process](./development-rules-audit.md#rule-qa-process)
- [ ] **Code references:** [`src/lib/components/common/BottomSheet.svelte`](../src/lib/components/common/BottomSheet.svelte), [`src/lib/components/ingredients/sheets/ManualEntrySheet.svelte`](../src/lib/components/ingredients/sheets/ManualEntrySheet.svelte), [`src/lib/components/ingredients/sheets/IngredientFilterSheet.svelte`](../src/lib/components/ingredients/sheets/IngredientFilterSheet.svelte), [`src/lib/components/ingredients/sheets/IngredientActionSheet.svelte`](../src/lib/components/ingredients/sheets/IngredientActionSheet.svelte), [`src/lib/components/common/TextInputDialog.svelte`](../src/lib/components/common/TextInputDialog.svelte)
- [ ] **Manual entry handle:** Open `/fridge`, tap the `Enter manually` row, and verify the small grey drag handle is horizontally centered at the top of the white bottom sheet, above the back arrow and `Enter Manually` title.
- [ ] **Manual entry close behavior:** With manual entry open, tap the centered handle; verify the sheet closes and no underlying ingredient card or control is triggered.
- [ ] **Filter sheet handle:** Open `/fridge`, tap the slider/filter icon to the right of the scan button, and verify the `Filter & Sort` bottom sheet uses the same centered handle position, title font, title size, title weight, and top spacing as manual entry.
- [ ] **Action sheet handle:** Open `/fridge`, tap the `•••` button on any ingredient card, and verify the ingredient action sheet uses the same centered handle and sheet chrome as manual entry.
- [ ] **Rename sheet handle:** From the ingredient action sheet, tap `Rename`; verify the rename sheet/dialog also uses the same centered handle and bottom-sheet chrome.
- [ ] **Shared close behavior:** For manual entry, filter/sort, ingredient actions, and rename, verify the back arrow, backdrop tap, handle tap, and `Escape` key close the active sheet without changing list data.
- [ ] **Sheet bounds:** Verify each sheet slides up from the bottom, rests above the bottom nav, greys out only the app content between header and nav, and respects the shared min-height and 80dvh max-height behavior.
- [ ] **Manual entry header:** In manual entry, verify there is one shared `Enter Manually` header only; the step tabs should sit directly below that header with no duplicate inner title.
- [ ] **Manual entry scroll:** In manual entry, advance to a long tab such as `Extended`; verify form content scrolls inside the sheet while the centered handle and shared header remain visible.

## Cleared QA

No user-verified QA items have been cleared yet.
