# QA Tasks

This document tracks manual QA items that need user verification after feature, component, UI, data-flow, or behavior changes.

## Rules

- Add QA notes here for every new feature, component, UI, data-flow, or behavior change unless it is clearly documentation-only.
- Add QA notes during the task, before handoff, so new work does not ship without a manual verification path.
- Use Markdown checkboxes for active QA items: `- [ ]`.
- At handoff, prompt the user to run the relevant unchecked QA items.
- Do not mark an item complete until the user verifies it passed.
- After user verification, remove it from **Active QA** by moving it to **Cleared QA** and striking the text through: `- [x] ~~Verified item.~~`
- Keep each item concrete enough to test directly.
- Include the affected branch, files, expected behavior, and any important regression checks.

## Active QA

### Reusable View Layout Primitives

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Files:** `src/lib/components/common/view/**`, `src/routes/fridge/+page.svelte`, `src/lib/components/ingredients/search/IngredientSearchView.svelte`
- [ ] Confirm the ingredients page uses shared view primitives instead of a route-owned full-height grid.
- [ ] Confirm the ingredients page title, search row, scan/filter controls, manual-entry launcher, and list tabs remain visible while only the ingredient card list scrolls.
- [ ] Confirm the top controls do not collapse or overlap the list tabs when the viewport is short or when the list has many items.
- [ ] Confirm the active search view uses the same shared view primitives and fills the area between app header and bottom nav.
- [ ] Confirm the active search view keeps its header/search controls visible while search results own the remaining scrollable area.
- [ ] Confirm no view introduces a second accidental page scroll outside the intended `ViewBody` or component-owned list/result scroll region.

### Shared Sheet Base

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Files:** `src/lib/components/common/sheets/SheetBase.svelte`, `src/lib/components/common/BottomSheet.svelte`, `src/lib/components/common/RightSheet.svelte`, `src/routes/fridge/+page.svelte`
- [ ] Open manual entry, filter/sort, ingredient actions, and rename ingredient; confirm each still uses bottom-sheet behavior and rests above the bottom nav.
- [ ] Open active ingredient search; confirm it still uses right-sheet behavior, slides in from the right, and fills the content area between header and bottom nav.
- [ ] Confirm `Escape` closes both bottom-sheet and right-sheet flows.
- [ ] Confirm backdrop tap closes bottom sheets without triggering underlying controls.
- [ ] Confirm the right-sheet search view remains opaque and does not show app content through gaps.

### Ingredient SCSS Token Audit

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Files:** `src/styles/_variables.scss`, `src/routes/fridge/+page.svelte`, `src/lib/components/ingredients/**`, `src/lib/components/common/BottomSheet.svelte`, `src/lib/components/common/RightSheet.svelte`
- [ ] Verify the ingredients page still matches the current rebuild direction after token renaming: header/content width, search row, manual entry row, tabs, ingredient cards, action buttons, bottom sheet, and active search view.
- [ ] Open filters, manual entry, barcode scan, ingredient edit, and search active view; confirm spacing, colors, radii, and typography did not regress.
- [ ] In manual entry, trigger validation errors/warnings and saved/catalog status messages; confirm the status colors still read correctly after moving status styling to ingredient semantic tokens.
- [ ] Confirm the token cleanup did not alter data behavior: list loading, search result selection, add-to-fridge/shopping, manual entry submission, and barcode lookup still work as before.
- [ ] Confirm future ingredient-route styles use `$ingredient-*` tokens and shared shell primitives use `$app-shell-*` tokens instead of raw `$color-figma-*` or `$app-rebuild-*` values.

### Ingredient Search Active View

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Files:** `src/routes/fridge/+page.svelte`, `src/lib/components/common/RightSheet.svelte`, `src/lib/components/ingredients/search/IngredientSearchTrigger.svelte`, `src/lib/components/ingredients/search/IngredientSearchView.svelte`, `src/lib/components/ingredients/search/IngredientSearch.svelte`, `src/lib/components/ingredients/nutrition/NutritionDetailView.svelte`
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
- [ ] **Files:** `src/routes/fridge/+page.svelte`, `src/lib/components/ingredients/nutrition/NutritionDetailView.svelte`, `src/lib/components/ingredients/nutrition/NutritionPanel.svelte`, `src/lib/components/common/RightSheet.svelte`
- [ ] From active search, select a result and confirm nutrition facts open in a right-side detail view instead of inline on the ingredients page.
- [ ] From a fridge/shopping ingredient card, open nutrition details and confirm the same right-side detail view is used.
- [ ] Confirm the detail view header shows a back button, ingredient name, and viewing amount row above the nutrition facts label.
- [ ] Confirm the back button and `Escape` close the detail view without changing list data.
- [ ] Use the Add to Fridge and Shopping List controls from the detail view and confirm the existing duplicate/move/list refresh behavior still works.
- [ ] Confirm the main ingredients view no longer shows an inline nutrition facts preview above the fridge/shopping list.

### Right Sheet Reusable Shell

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Files:** `src/lib/components/common/RightSheet.svelte`, `src/routes/fridge/+page.svelte`
- [ ] Open the ingredient search active view and confirm it still slides in from the right, fills the content area between header and bottom nav, and closes with `Escape`.
- [ ] Confirm the right sheet is not clipped by the ingredient page scroll container and does not reveal underlying page content along the sides, top, or between search/results sections.
- [ ] Confirm the search active view uses the shared `RightSheet` primitive and does not depend on the removed `SlideInView` component name.
- [ ] When another right-side data view is added, confirm it uses the same shell behavior rather than a one-off slide panel.

### Ingredient Search Keyboard Navigation

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Files:** `src/lib/components/ingredients/search/IngredientSearch.svelte`, `src/lib/components/ingredients/search/SearchDropdown.svelte`
- [ ] Type a search term that returns results and verify only relevant quick-key hints appear: `↑↓ choose result` and `↵ view nutrition`.
- [ ] Press `ArrowDown` and `ArrowUp`; verify the active result visibly changes.
- [ ] Press `Enter`; verify the active result is selected and added through the normal ingredient flow.
- [ ] Confirm `Space`, `Backspace`, and old pill-style behavior are not treated as custom shortcuts.
- [ ] Confirm search still works by clicking/tapping a result on mobile.

### Manual Entry Extended Nutrients

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Files:** `src/lib/components/ingredients/manual-entry/CustomIngredientForm.svelte`, `src/lib/components/ingredients/manual-entry/ManualEntryNutrientFields.svelte`
- [ ] Open manual entry, continue to the Extended step, and confirm every nutrient group, including Vitamins, starts collapsed.
- [ ] Confirm tapping each nutrient group opens and closes only that group without losing entered nutrient values.
- [ ] Confirm the Macros step still keeps its first nutrient group open by default.

### Bottom Sheet Header Consistency

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Files:** `src/lib/components/common/BottomSheet.svelte`, `src/lib/components/ingredients/sheets/ManualEntrySheet.svelte`, `src/lib/components/ingredients/sheets/IngredientFilterSheet.svelte`, `src/lib/components/ingredients/sheets/IngredientActionSheet.svelte`, `src/lib/components/common/TextInputDialog.svelte`
- [ ] Open manual entry, filter/sort, ingredient actions, and rename ingredient; confirm each sheet has the same centered handle, back arrow, title font, title size, title weight, and header spacing.
- [ ] Confirm the back arrow, backdrop tap, handle tap, and `Escape` key all close the active sheet without triggering the content underneath.
- [ ] Confirm each sheet slides up from the bottom, rests above the bottom nav, keeps the overlay between header and nav, and respects the shared min-height and 80dvh max-height behavior.
- [ ] Confirm manual-entry steps no longer render a duplicate inner “Enter Manually” header inside the bottom sheet, while the step tabs remain directly under the shared header.
- [ ] Confirm long manual-entry content scrolls inside the sheet and the shared handle/header remains visible while scrolling.

## Cleared QA

No user-verified QA items have been cleared yet.
