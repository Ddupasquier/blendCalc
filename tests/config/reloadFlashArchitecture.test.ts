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
		const moderation = readSource(
			"src/lib/components/moderation/ModerationWorkspace/ModerationWorkspace.svelte",
		);

		expect(moderation).toContain('import { goto } from "$app/navigation"');
		expect(moderation).toContain("onsubmit={submitAccountSearch}");
		expect(moderation).toContain("event.preventDefault()");
		expect(moderation).toContain("await goto(href");
	});

	it("refreshes ingredient data without remounting or shrinking the visible list", () => {
		const fridge = readSource("src/routes/ingredients/fridge/+page.svelte");
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

	it("hydrates durable route data from SSR without an eager browser reload", () => {
		const fridge = readSource("src/routes/ingredients/fridge/+page.svelte");
		const mix = readSource("src/routes/mix/+page.svelte");
		const saved = readSource("src/routes/saved/+page.svelte");

		expect(fridge).toContain("page.data.ingredientData");
		expect(mix).toContain("page.data.mixData");
		expect(saved).toContain("page.data.savedData");

		const fridgeMount = fridge.slice(fridge.indexOf("onMount(() =>"));
		const mixMount = mix.slice(mix.indexOf("onMount(() =>"));
		const savedMount = saved.slice(saved.indexOf("onMount(() =>"));

		expect(fridgeMount).not.toContain("void loadLists();");
		expect(mixMount).not.toContain("readCloudIngredientList");
		expect(savedMount).not.toContain("void loadSavedRecipes();");
	});

	it("hydrates direct nutrition routes with the selected food before SSR", () => {
		const fridge = readSource("src/routes/ingredients/fridge/+page.svelte");
		const selectedFoodStart = fridge.indexOf("let selectedFood = $state");
		const routeEffectStart = fridge.indexOf("$effect(() => {", selectedFoodStart);

		expect(fridge).toContain(
			"const initialIngredientRouteState = getIngredientRouteState(page.url)",
		);
		expect(fridge).toContain(
			"const initialRouteFood = initialIngredientData?.routeFood ??",
		);
		expect(fridge).toContain("findIngredientRouteFood(");
		expect(fridge.slice(selectedFoodStart, routeEffectStart)).toContain(
			"initialIngredientRouteState.view === INGREDIENT_ROUTE_VIEWS.nutrition",
		);
		expect(fridge.slice(selectedFoodStart, routeEffectStart)).toContain(
			"? initialRouteFood",
		);
	});
});
