import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readStyles = (path: string) => readFileSync(path, "utf8");

describe("Ingredients narrow-screen layout", () => {
	it("keeps synchronized compact shell dimensions at the shared phone breakpoint", () => {
		const variables = readStyles("src/styles/_variables.scss");
		const appHeader = readStyles(
			"src/lib/components/app/AppHeader/AppHeader.scss",
		);
		const tabNavigation = readStyles(
			"src/lib/components/app/TabNavigation/TabNavigation.scss",
		);
		const viewFrame = readStyles(
			"src/lib/components/common/view/ViewFrame/ViewFrame.scss",
		);

		expect(variables).toContain("$app-breakpoint-xs: 420px");
		expect(variables).toContain("$app-breakpoint-sm: 520px");
		expect(variables).toContain("$app-breakpoint-md: 680px");
		expect(variables).toContain("$app-breakpoint-height-compact: 700px");
		expect(variables).toContain("$app-shell-header-height-compact: 3.5rem");
		expect(variables).toContain("$app-shell-nav-height-compact: 4.25rem");
		expect(variables).toContain("$app-shell-control-height-narrow: 2.75rem");
		expect(appHeader).toContain("@media (max-width: $app-breakpoint-xs)");
		expect(appHeader).toContain(
			"(max-height: $app-breakpoint-height-compact)",
		);
		expect(appHeader).toContain("$app-shell-header-height-compact");
		expect(tabNavigation).toContain("$app-shell-nav-height-compact");
		expect(viewFrame).toContain("$app-shell-header-height-compact");
		expect(viewFrame).toContain("$app-shell-nav-height-compact");
	});

	it("compacts Ingredients controls and cards without hiding card media", () => {
		const searchPanel = readStyles(
			"src/lib/components/ingredients/page/IngredientsSearchPanel/IngredientsSearchPanel.scss",
		);
		const manualEntry = readStyles(
			"src/lib/components/ingredients/manual-entry/ManualEntryLauncher/ManualEntryLauncher.scss",
		);
		const segmentedControl = readStyles(
			"src/lib/components/common/buttons/SegmentedControl/SegmentedControl.scss",
		);
		const cardLayout = readStyles(
			"src/lib/components/ingredients/card/IngredientCardMediaLane/_IngredientCardLayout.scss",
		);
		const savedList = readStyles(
			"src/lib/components/ingredients/list/SavedIngredientList/SavedIngredientList.scss",
		);
		const savedCard = readStyles(
			"src/lib/components/ingredients/list/SavedIngredientCard/SavedIngredientCard.svelte",
		);
		const searchCard = readStyles(
			"src/lib/components/ingredients/search/IngredientSearchCard/IngredientSearchCard.svelte",
		);

		expect(searchPanel).toContain("$app-shell-control-height-narrow");
		expect(manualEntry).toContain("@media (max-width: $app-breakpoint-xs)");
		expect(searchPanel).toContain(
			".search-toolbar :global(.manual-entry-launcher)",
		);
		expect(searchPanel).toContain("grid-column: auto");
		expect(manualEntry).toContain("width: $app-shell-control-height-narrow");
		expect(manualEntry).toContain(".manual-entry-toggle__copy");
		expect(manualEntry).toContain("display: none");
		expect(segmentedControl).toContain(
			"min-height: $app-shell-control-height-compact",
		);
		expect(segmentedControl).toContain(
			'.segmented-control[data-variant="pill"] {',
		);
		expect(segmentedControl).toContain("background: $app-shell-surface-control");
		expect(segmentedControl).toContain("border-radius: $app-shell-radius-pill");
		expect(segmentedControl).toContain("inset-block: calc(-1 * $app-gap-xs)");
		expect(cardLayout).toContain("$card-min-height-narrow: 4.1rem");
		expect(cardLayout).toContain("$card-action-size-narrow: 2rem");
		expect(cardLayout).toContain("font-size: $app-font-size-sm");
		expect(cardLayout).toContain("font-size: $app-font-size-xs");
		expect(cardLayout).not.toContain("display: none");
		expect(savedCard).toContain('class="ingredient-card-action-button"');
		expect(searchCard).toContain("ingredient-card-action-button");
		expect(savedList).toContain("@media (max-width: $app-breakpoint-xs)");
	});

	it("animates the compact Ingredients header with list scroll direction", () => {
		const viewTop = readStyles(
			"src/lib/components/common/view/ViewTop/ViewTop.svelte",
		);
		const viewTopStyles = readStyles(
			"src/lib/components/common/view/ViewTop/ViewTop.scss",
		);
		const savedList = readStyles(
			"src/lib/components/ingredients/list/SavedIngredientList/SavedIngredientList.svelte",
		);

		expect(viewTop).toContain(
			"class:view-top--compact-hidden={compactHidden}",
		);
		expect(viewTopStyles).toContain("grid-template-rows: 0fr");
		expect(viewTopStyles).toContain("transform: translateY(-100%)");
		expect(viewTopStyles).toContain("@media (prefers-reduced-motion: reduce)");
		expect(savedList).toContain("onscroll={handleListScroll}");
		expect(savedList).toContain("new ResizeObserver");
		expect(savedList).toContain("scrollDirectionTracker.rebase(element.scrollTop)");
		expect(savedList).toContain('onScrollDirectionChange("up")');
	});
});
