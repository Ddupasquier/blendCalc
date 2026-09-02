import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(path, "utf8");

describe("ingredient route performance architecture", () => {
	it("keeps closed route popins outside the initial Fridge graph", () => {
		const fridgePage = readSource("src/routes/ingredients/fridge/+page.svelte");
		const lazyPopins = readSource(
			"src/lib/components/ingredients/page/IngredientRoutePopins/LazyIngredientRoutePopins/LazyIngredientRoutePopins.svelte",
		);
		expect(fridgePage).toContain("LazyIngredientRoutePopins");
		expect(fridgePage).not.toContain(
			'IngredientRoutePopins/IngredientRoutePopins.svelte";',
		);
		expect(lazyPopins).toContain(
			'await import("../IngredientRoutePopins.svelte")',
		);
		expect(lazyPopins).not.toContain('from "svelte"');
		expect(lazyPopins).not.toContain("requestIdleCallback");
	});

	it("loads the visible list on the server and defers supporting list data", () => {
		const loader = readSource(
			"src/lib/server/user-data/ingredientPageData.server.ts",
		);
		expect(loader).toContain("readCloudIngredientListCount");
		expect(loader).toContain("deferredDataPending: true");
		expect(loader).not.toContain("readCloudCustomFoods(");
		expect(loader).not.toContain("readCloudIngredientListIndex(");
		expect(loader).not.toContain("readIngredientProvenanceOptions(");
	});

	it("keeps deferred custom-food safety evaluation on the server", () => {
		const supportingData = readSource(
			"src/lib/server/user-data/ingredientPageSupportingData.server.ts",
		);
		const fridgePage = readSource("src/routes/ingredients/fridge/+page.svelte");
		expect(supportingData).toContain("annotateFoodsWithFoodSafety");
		expect(supportingData).toContain("getUserFoodSafetyContext");
		expect(fridgePage).toContain("readIngredientPageSupportingData");
		expect(fridgePage).not.toContain("readCloudCustomFoods()");
	});

	it("yields before starting full-width progressive loading", () => {
		const list = readSource(
			"src/lib/components/ingredients/list/SavedIngredientList/SavedIngredientList.svelte",
		);
		expect(list).toContain("loadMoreScheduled = true");
		expect(list).toMatch(
			/requestAnimationFrame\(\(\) => \{\s*void Promise\.resolve\(onRevealMore\(\)\)/,
		);
	});
});
