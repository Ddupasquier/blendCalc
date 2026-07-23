import { describe, expect, it } from "vitest";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import {
	buildIngredientRouteHref,
	buildIngredientListTabHref,
	findIngredientRouteFood,
	getIngredientListTab,
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
		expect(getIngredientListTab(url("/fridge?tab=shopping-list"))).toBe(
			MIX_STORAGE_KEYS.shoppingList,
		);
		expect(
			buildIngredientListTabHref(
				url("/fridge?sort=recent"),
				MIX_STORAGE_KEYS.shoppingList,
			),
		).toBe("/fridge?sort=recent&tab=shopping-list");
		expect(
			buildIngredientListTabHref(
				url("/fridge?sort=recent&tab=shopping-list"),
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
			getIngredientRouteState(url("/fridge/actions/fridge/42")),
		).toMatchObject({
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.ingredientActions,
			modal: null,
			foodId: 42,
			listKey: MIX_STORAGE_KEYS.fridge,
		});

		expect(
			getIngredientRouteState(
				url("/fridge/image-placement/shopping-list/42"),
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
			getIngredientRouteState(url("/fridge/manual-entry/barcode-scanner")),
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
			buildIngredientRouteHref(url("/fridge?tab=fridge"), {
				view: INGREDIENT_ROUTE_VIEWS.search,
			}),
		).toBe("/fridge/search?tab=fridge");

		expect(
			buildIngredientRouteHref(url("/fridge/search"), {
				view: null,
				sheet: INGREDIENT_ROUTE_SHEETS.filters,
			}),
		).toBe("/fridge/filters");

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
		).toBe("/fridge/image-placement/fridge/42");

		expect(
			buildIngredientRouteHref(url("/fridge/manual-entry"), {
				sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
				modal: INGREDIENT_ROUTE_MODALS.barcodeScanner,
			}),
		).toBe("/fridge/manual-entry/barcode-scanner");
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
