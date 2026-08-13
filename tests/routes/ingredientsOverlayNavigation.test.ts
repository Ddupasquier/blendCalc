import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ingredientsPagePath = resolve(
	process.cwd(),
	"src/routes/ingredients/fridge/+page.svelte",
);
const ingredientListTabsPath = resolve(
	process.cwd(),
	"src/lib/components/ingredients/list/IngredientListTabs/IngredientListTabs.svelte",
);

describe("ingredient overlay navigation", () => {
	it("uses explicit canonical list and overlay route files", () => {
		const expectedRoutes = [
			"src/routes/ingredients/fridge/+page.svelte",
			"src/routes/ingredients/shopping/+page.svelte",
			"src/routes/ingredients/fridge/search/+page.svelte",
			"src/routes/ingredients/shopping/search/+page.svelte",
			"src/routes/ingredients/fridge/search/filters/+page.svelte",
			"src/routes/ingredients/shopping/search/filters/+page.svelte",
			"src/routes/ingredients/fridge/manual-entry/+page.svelte",
			"src/routes/ingredients/shopping/manual-entry/+page.svelte",
			"src/routes/ingredients/fridge/nutrition/[foodId=signedInteger]/+page.svelte",
			"src/routes/ingredients/shopping/nutrition/[foodId=signedInteger]/+page.svelte",
		];

		for (const route of expectedRoutes) {
			expect(existsSync(resolve(process.cwd(), route)), route).toBe(true);
		}
		expect(
			existsSync(resolve(process.cwd(), "src/routes/fridge")),
		).toBe(false);
		expect(
			existsSync(resolve(process.cwd(), "src/routes/ingredients/[...slug]")),
		).toBe(false);
	});

	it("uses shallow history so sheets do not remount the ingredient list", () => {
		const source = readFileSync(ingredientsPagePath, "utf8");

		expect(source).toContain("navigateShallowRoute({");
		expect(source).toContain("routeStateKey: SHALLOW_ROUTE_PAGE_STATE_KEYS.ingredients");
		expect(source).toContain("replace: replaceState");
		expect(source).not.toContain("goto(href");
	});

	it("pauses automatic list expansion while an overlay is open", () => {
		const source = readFileSync(ingredientsPagePath, "utf8");

		expect(source).toContain("const ingredientOverlayOpen = $derived(");
		expect(source).toContain("revealPaused={ingredientOverlayOpen}");
	});

	it("does not replay a stale barcode scan when manual entry is reopened", () => {
		const source = readFileSync(ingredientsPagePath, "utf8");
		const openManualEntry = source.match(
			/const openManualEntry = \(\) => \{[\s\S]*?\n    \};/,
		)?.[0];

		expect(openManualEntry).toContain("barcodeScannerRouteOpen = false;");
		expect(openManualEntry).toContain("scanSignal = 0;");
		expect(openManualEntry).toContain("modal: null,");
		expect(source).toMatch(
			/routeState\.modal === INGREDIENT_ROUTE_MODALS\.barcodeScanner[\s\S]*?\} else \{\s*barcodeScannerRouteOpen = false;\s*scanSignal = 0;/,
		);
	});

	it("leaves manual entry for one stable nutrition route after a successful save", () => {
		const source = readFileSync(ingredientsPagePath, "utf8");
		const handleCreate = source.match(
			/const handleCreate = \([\s\S]*?\n    };/,
		)?.[0];

		expect(handleCreate).toContain('view: INGREDIENT_ROUTE_VIEWS.nutrition');
		expect(handleCreate).toContain('sheet: null');
		expect(handleCreate).toContain('foodId: food.fdcId');
		expect(handleCreate).not.toContain('view: INGREDIENT_ROUTE_VIEWS.manualEntry');
		expect(handleCreate).not.toContain('activeSheet = "manual-entry"');
	});

	it("suppresses redundant nutrition actions after manual entry adds to a list", () => {
		const source = readFileSync(ingredientsPagePath, "utf8");
		const handleCreate = source.match(
			/const handleCreate = \([\s\S]*?\n    };/,
		)?.[0];

		expect(handleCreate).toContain(
			"selectedFoodShowListActions = !context.addedToList;",
		);
		expect(handleCreate).toContain(
			"showListActions: !context.addedToList,",
		);
	});

	it("adds a search result to Fridge without opening nutrition", () => {
		const source = readFileSync(ingredientsPagePath, "utf8");
		const addSearchResult = source.match(
			/const addSearchResultToFridge = async \(food: FoodItem\) => \{[\s\S]*?\n    \};/,
		)?.[0];
		const addFoodToListState = source.match(
			/const addFoodToListState = \(key: IngredientListKey, food: FoodItem\) => \{[\s\S]*?\n    \};/,
		)?.[0];

		expect(addSearchResult).toContain("await addFoodToIngredientList(");
		expect(addSearchResult).toContain("MIX_STORAGE_KEYS.fridge,");
		expect(addSearchResult).toContain("{ notify: false },");
		expect(addSearchResult).toContain('if (result === "added")');
		expect(addSearchResult).toContain(
			"addFoodToListState(MIX_STORAGE_KEYS.fridge, food);",
		);
		expect(addSearchResult).not.toContain("handleSearchSelect");
		expect(addSearchResult).not.toContain("navigateIngredientRoute");
		expect(addFoodToListState).toContain("onHand = [addedFood, ...onHand]");
		expect(addFoodToListState).toContain("onHandTotalCount += 1");
		expect(addFoodToListState).toContain(
			"foodIds: [food.fdcId, ...currentIndex.foodIds]",
		);
		expect(addFoodToListState).toContain("getFoodIdentityKey(food)");
	});

	it("uses the URL as the only source of truth for the active list tab", () => {
		const source = readFileSync(ingredientsPagePath, "utf8");

		expect(source).toContain(
			"getIngredientListTab(activeIngredientRouteUrl)",
		);
		expect(source).not.toContain("const selectList =");
		expect(source).not.toContain("activeList = key");
	});

	it("uses route links rather than shallow history for primary list tabs", () => {
		const source = readFileSync(ingredientListTabsPath, "utf8");

		expect(source).toContain("href: buildIngredientListTabHref(");
		expect(source).not.toContain('from "$app/navigation"');
		expect(source).not.toContain("pushState(");
	});
});
