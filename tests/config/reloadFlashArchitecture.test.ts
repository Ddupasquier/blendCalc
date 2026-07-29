import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(path, "utf8");

describe("reload-flash architecture", () => {
	it("preserves enhanced form values while one server invalidation completes", () => {
		const pendingSubmit = readSource(
			"src/lib/utils/forms/pendingSubmit.ts",
		);
		const profile = readSource("src/routes/profile/+page.svelte");

		expect(pendingSubmit).toContain("update({ reset: false })");
		expect(profile).not.toContain("invalidateAll");
	});

	it("uses client navigation for moderation search instead of a document reload", () => {
		const moderation = readSource("src/routes/moderation/+page.svelte");

		expect(moderation).toContain('import { goto } from "$app/navigation"');
		expect(moderation).toContain("onsubmit={submitAccountSearch}");
		expect(moderation).toContain("event.preventDefault()");
		expect(moderation).toContain("await goto(href");
	});

	it("refreshes ingredient data without remounting or shrinking the visible list", () => {
		const fridge = readSource("src/routes/fridge/+page.svelte");
		const savedList = readSource(
			"src/lib/components/ingredients/list/SavedIngredientList/SavedIngredientList.svelte",
		);
		const loadListsStart = fridge.indexOf("const loadLists = async");
		const getRouteFoodStart = fridge.indexOf(
			"const getRouteFood",
			loadListsStart,
		);
		const loadLists = fridge.slice(loadListsStart, getRouteFoodStart);

		expect(loadLists).toContain("if (resetViewport) resetVisibleCounts()");
		expect(loadLists).not.toContain("\n        resetVisibleCounts();");
		expect(fridge).toContain("Math.max(onHandVisibleCount, onHand.length)");
		expect(fridge).toContain(
			"Math.max(shoppingVisibleCount, shoppingList.length)",
		);
		expect(fridge).toContain("loadLists({ resetViewport: true })");
		expect(fridge).toContain(
			"listLoading && onHand.length === 0 && shoppingList.length === 0",
		);
		expect(fridge).toContain("listLoading={showListLoadingIndicator}");
		expect(fridge).toContain("readIngredientListWindow");
		expect(fridge).toContain("addFoodToListState(MIX_STORAGE_KEYS.fridge, food)");
		expect(fridge).toContain("removeFoodFromListState(key, foodId)");
		expect(fridge).toContain(
			"renameFoodInListState(key, food.fdcId, description)",
		);
		expect(savedList).not.toContain("{#key");
		expect(savedList).toContain("listElement?.scrollTo");
	});
});
