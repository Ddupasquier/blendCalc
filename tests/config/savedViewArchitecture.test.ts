import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Saved view architecture", () => {
	it("composes the shared app shell and focused saved components", () => {
		const page = readFileSync("src/routes/saved/+page.svelte", "utf8");

		expect(page).toContain("<ViewFrame appShell");
		expect(page).toContain("<ViewHeader");
		expect(page).toContain("<SavedRecipeCard");
		expect(page).toContain("<SavedRecipesEmptyState");
		expect(page).toContain("<ListSortSheet");
		expect(page).toContain("<PaginatedListControls");
		expect(page).toContain("createScrollDirectionTracker");
		expect(page).toContain("<ViewTop compactHidden={compactTopHidden}>");
		expect(page).toContain("onscroll={handleSavedScroll}");
		expect(page).not.toContain("<Pagination");
		expect(page).not.toContain('class="saved-card"');
	});

	it("keeps component presentation with each component owner", () => {
		const pageStyles = readFileSync("src/routes/saved/page.scss", "utf8");
		const cardStyles = readFileSync(
			"src/lib/components/saved/SavedRecipeCard/SavedRecipeCard.scss",
			"utf8",
		);
		const emptyStateStyles = readFileSync(
			"src/lib/components/saved/SavedRecipesEmptyState/SavedRecipesEmptyState.scss",
			"utf8",
		);

		expect(pageStyles).toContain(".saved-page__scroll");
		expect(pageStyles).not.toContain(".saved-recipe-card");
		expect(cardStyles).toContain(".saved-recipe-card");
		expect(cardStyles).not.toContain("box-shadow");
		expect(emptyStateStyles).not.toContain("$app-shell-border-subtle");
	});

	it("shares metadata and compact action primitives instead of duplicating pills", () => {
		const card = readFileSync(
			"src/lib/components/saved/SavedRecipeCard/SavedRecipeCard.svelte",
			"utf8",
		);
		const goals = readFileSync(
			"src/lib/components/saved/SavedRecipeGoalPills/SavedRecipeGoalPills.svelte",
			"utf8",
		);
		const ingredients = readFileSync(
			"src/lib/components/saved/SavedRecipeIngredientPills/SavedRecipeIngredientPills.svelte",
			"utf8",
		);

		expect(card).toContain("<MetadataPill");
		expect(card).toContain("<SavedRecipeExportAction");
		expect(card).toContain("compact");
		expect(goals).toContain("<MetadataPill");
		expect(ingredients).toContain("<MetadataPill");
	});

	it("keeps the compact filter trigger from shrinking the search field", () => {
		const listControlStyles = readFileSync(
			"src/lib/components/common/lists/ListControls/ListControls.scss",
			"utf8",
		);
		const compactStyles = listControlStyles.slice(
			listControlStyles.indexOf("@media"),
		);

		expect(compactStyles).toMatch(
			/\.list-controls--filter-trigger\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/,
		);
	});
});
