# QA Tasks

This document tracks manual QA items that need user verification after feature, component, UI, data-flow, or behavior changes.

## Rules

- Add QA notes here whenever a change needs manual verification.
- Use Markdown checkboxes for active QA items: `- [ ]`.
- Do not mark an item complete until the user verifies it.
- After user verification, move it to **Cleared QA** and strike the text through: `- [x] ~~Verified item.~~`
- Keep each item concrete enough to test directly.
- Include the affected branch, files, expected behavior, and any important regression checks.

## Active QA

### Ingredient SCSS Token Audit

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Files:** `src/styles/_variables.scss`, `src/routes/fridge/+page.svelte`, `src/lib/components/ingredients/**`, `src/lib/components/common/BottomSheet.svelte`, `src/lib/components/common/SlideInView.svelte`
- [ ] Verify the ingredients page still matches the current rebuild direction after token renaming: header/content width, search row, manual entry row, tabs, ingredient cards, action buttons, bottom sheet, and active search view.
- [ ] Open filters, manual entry, barcode scan, ingredient edit, and search active view; confirm spacing, colors, radii, and typography did not regress.
- [ ] Confirm the token cleanup did not alter data behavior: list loading, search result selection, add-to-fridge/shopping, manual entry submission, and barcode lookup still work as before.
- [ ] Confirm future ingredient-route styles use `$ingredient-*` tokens and shared shell primitives use `$app-shell-*` tokens instead of raw `$color-figma-*` or `$app-rebuild-*` values.

### Ingredient Search Active View

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Files:** `src/routes/fridge/+page.svelte`, `src/lib/components/common/SlideInView.svelte`, `src/lib/components/ingredients/search/IngredientSearchTrigger.svelte`, `src/lib/components/ingredients/search/IngredientSearchView.svelte`, `src/lib/components/ingredients/search/IngredientSearch.svelte`
- [ ] On the ingredients page, tap/click the search-looking control and verify the active search view slides in from the right.
- [ ] Confirm the main search control is a button-style trigger, not the live text input.
- [ ] Confirm the active search view matches the provided Figma direction: title/subtitle, search row, scan button, filter button, quick-key hints, and result cards.
- [ ] Confirm search results span the active search view width instead of being constrained to the input column.
- [ ] Confirm the active search view fills the content area between header and bottom nav instead of floating over the ingredient list.
- [ ] Confirm long search result lists scroll with the active search view rather than inside a small nested result box.
- [ ] Type a term in the active search view and verify results render there without changing fridge/shopping list data.
- [ ] Select a result and verify the active search view closes, the nutrition facts preview opens, and the existing add-to-fridge/shopping flow still works.
- [ ] Press `Escape` while the active search view is open and verify it closes without changing list data.
- [ ] From the active search view, tap scan and filter controls and verify they open the existing scanner/manual-entry and filter flows without leaving the search view stuck open.

### Ingredient Search Keyboard Navigation

- [ ] **Branch:** `ui-rebuild/ingredients`
- [ ] **Files:** `src/lib/components/ingredients/search/IngredientSearch.svelte`, `src/lib/components/ingredients/search/SearchDropdown.svelte`
- [ ] Type a search term that returns results and verify only relevant quick-key hints appear: `↑↓ choose result` and `↵ view nutrition`.
- [ ] Press `ArrowDown` and `ArrowUp`; verify the active result visibly changes.
- [ ] Press `Enter`; verify the active result is selected and added through the normal ingredient flow.
- [ ] Confirm `Space`, `Backspace`, and old pill-style behavior are not treated as custom shortcuts.
- [ ] Confirm search still works by clicking/tapping a result on mobile.

## Cleared QA

No user-verified QA items have been cleared yet.
