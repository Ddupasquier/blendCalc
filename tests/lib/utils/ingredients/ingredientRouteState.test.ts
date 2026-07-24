import { describe, expect, it } from "vitest";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import {
	buildIngredientRouteHref,
	buildIngredientListTabHref,
	findIngredientRouteFood,
	getCanonicalIngredientRouteHref,
	getIngredientListTab,
	getIngredientRouteTitle,
	getIngredientRouteState,
	INGREDIENT_ROUTE_MODALS,
	INGREDIENT_ROUTE_SHEETS,
	INGREDIENT_ROUTE_VIEWS,
} from "$lib/utils/ingredients/ingredientRouteState";
import type { FdcFood } from "$lib/utils/food/types";

const url = (path: string) => new URL(path, "https://blendcalc.test");

const food = (fdcId: number, description: string): FdcFood => ({
	fdcId,
	description,
	foodNutrients: [],
});

describe("ingredient route state", () => {
	it("keeps the active saved list in browser history", () => {
		expect(getIngredientListTab(url("/fridge"))).toBe(MIX_STORAGE_KEYS.fridge);
		expect(getIngredientListTab(url("/fridge/shopping-list"))).toBe(
			MIX_STORAGE_KEYS.shoppingList,
		);
		expect(getIngredientListTab(url("/fridge?tab=shopping-list"))).toBe(
			MIX_STORAGE_KEYS.shoppingList,
		);
		expect(
			buildIngredientListTabHref(
				url("/fridge?sort=recent"),
				MIX_STORAGE_KEYS.shoppingList,
			),
		).toBe("/fridge/shopping-list?sort=recent");
		expect(
			buildIngredientListTabHref(
				url("/fridge/shopping-list?sort=recent"),
				MIX_STORAGE_KEYS.fridge,
			),
		).toBe("/fridge?sort=recent");
	});

	it("parses search, sheet, and nutrition route state", () => {
		expect(getIngredientRouteState(url("/fridge/search"))).toMatchObject({
			view: INGREDIENT_ROUTE_VIEWS.search,
			sheet: null,
			modal: null,
			foodId: null,
			listKey: null,
			showListActions: true,
		});

		expect(
			getIngredientRouteState(url("/fridge/actions/42")),
		).toMatchObject({
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.ingredientActions,
			modal: null,
			foodId: 42,
			listKey: MIX_STORAGE_KEYS.fridge,
		});

		expect(
			getIngredientRouteState(
				url("/fridge/shopping-list/image-placement/42"),
			),
		).toMatchObject({
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.imagePlacement,
			modal: null,
			foodId: 42,
			listKey: MIX_STORAGE_KEYS.shoppingList,
		});

		expect(
			getIngredientRouteState(url("/fridge/nutrition/99?actions=hide")),
		).toMatchObject({
			view: INGREDIENT_ROUTE_VIEWS.nutrition,
			sheet: null,
			modal: null,
			foodId: 99,
			showListActions: false,
		});

		expect(
			getIngredientRouteState(url("/fridge/barcode-scanner")),
		).toMatchObject({
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
			modal: INGREDIENT_ROUTE_MODALS.barcodeScanner,
			foodId: null,
			listKey: null,
		});
	});

	it("builds exclusive pop-in slug URLs while preserving unrelated params", () => {
		expect(
			buildIngredientRouteHref(url("/fridge"), {
				view: INGREDIENT_ROUTE_VIEWS.search,
			}),
		).toBe("/fridge/search");

		expect(
			buildIngredientRouteHref(url("/fridge/shopping-list/search"), {
				view: null,
				sheet: INGREDIENT_ROUTE_SHEETS.filters,
			}),
		).toBe("/fridge/shopping-list/filters");

		expect(
			buildIngredientRouteHref(url("/fridge/filters"), {
				view: INGREDIENT_ROUTE_VIEWS.nutrition,
				sheet: null,
				foodId: 101,
				showListActions: false,
			}),
		).toBe("/fridge/nutrition/101?actions=hide");

		expect(
			buildIngredientRouteHref(url("/fridge/actions/shopping-list/42"), {
				sheet: INGREDIENT_ROUTE_SHEETS.imagePlacement,
				foodId: 42,
				listKey: MIX_STORAGE_KEYS.fridge,
			}),
		).toBe("/fridge/image-placement/42");

		expect(
			buildIngredientRouteHref(url("/fridge/manual-entry"), {
				sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
				modal: INGREDIENT_ROUTE_MODALS.barcodeScanner,
			}),
		).toBe("/fridge/barcode-scanner");
	});

	it("canonicalizes legacy query tabs and item URLs", () => {
		expect(
			getCanonicalIngredientRouteHref(
				url("/fridge?tab=shopping-list&sort=recent"),
			),
		).toBe("/fridge/shopping-list?sort=recent");
		expect(
			getCanonicalIngredientRouteHref(
				url("/fridge/actions/shopping-list/42"),
			),
		).toBe("/fridge/shopping-list/actions/42");
		expect(
			getCanonicalIngredientRouteHref(
				url("/fridge/manual-entry/barcode-scanner"),
			),
		).toBe("/fridge/barcode-scanner");
		expect(
			getCanonicalIngredientRouteHref(url("/fridge/shopping-list")),
		).toBeNull();
	});

	it("does not read URL fragments while canonicalizing server requests", () => {
		const serverUrl = url("/fridge");
		Object.defineProperty(serverUrl, "hash", {
			get() {
				throw new Error("Request URL fragments are unavailable");
			},
		});

		expect(getCanonicalIngredientRouteHref(serverUrl)).toBeNull();
	});

	it("provides descriptive titles for list and overlay routes", () => {
		expect(getIngredientRouteTitle(url("/fridge"))).toBe("Fridge");
		expect(getIngredientRouteTitle(url("/fridge/shopping-list"))).toBe(
			"Shopping List",
		);
		expect(getIngredientRouteTitle(url("/fridge/search"))).toBe(
			"Search Ingredients",
		);
		expect(
			getIngredientRouteTitle(
				url("/fridge/shopping-list/nutrition/42"),
				"Tomato Soup",
			),
		).toBe("Tomato Soup Nutrition");
	});

	it("resolves route food from the requested list first", () => {
		const fridgeFood = food(1, "Fridge spinach");
		const shoppingFood = food(1, "Shopping spinach");
		const customFood = food(2, "Custom protein");

		expect(
			findIngredientRouteFood(
				1,
				MIX_STORAGE_KEYS.shoppingList,
				[fridgeFood],
				[shoppingFood],
				[customFood],
			),
		).toBe(shoppingFood);

		expect(
			findIngredientRouteFood(2, null, [fridgeFood], [shoppingFood], [customFood]),
		).toBe(customFood);
	});
});
