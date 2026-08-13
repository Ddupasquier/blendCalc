import { describe, expect, it } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";
import {
	buildIngredientListTabHref,
	buildIngredientRouteHref,
	findIngredientRouteFood,
	getActiveIngredientRouteHref,
	getActiveIngredientRouteState,
	getActiveIngredientRouteUrl,
	getBarcodeScannerCloseRoutePatch,
	getBarcodeScannerOpenRoutePatch,
	getIngredientFiltersCloseRoutePatch,
	getIngredientFiltersOpenRoutePatch,
	getIngredientListTab,
	getIngredientRouteState,
	getIngredientRouteTitle,
	INGREDIENT_ROUTE_MODALS,
	INGREDIENT_ROUTE_SHEETS,
	INGREDIENT_ROUTE_VIEWS,
	parseIngredientApplicationFoodId,
} from "$lib/utils/ingredients/ingredientRouteState";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const url = (path: string) => new URL(path, "https://blendcalc.test");

const food = (fdcId: number, description: string): FoodItem => ({
	fdcId,
	description,
	foodNutrients: [],
});

describe("ingredient route state", () => {
	it("accepts positive and normalized negative food IDs but rejects zero", () => {
		expect(parseIngredientApplicationFoodId("42")).toBe(42);
		expect(parseIngredientApplicationFoodId("-42")).toBe(-42);
		expect(parseIngredientApplicationFoodId("0")).toBeNull();
		expect(parseIngredientApplicationFoodId("not-a-food")).toBeNull();
	});

	it("uses explicit list paths and preserves supported query modifiers", () => {
		expect(getIngredientListTab(url("/ingredients/fridge"))).toBe(
			MIX_STORAGE_KEYS.fridge,
		);
		expect(getIngredientListTab(url("/ingredients/shopping"))).toBe(
			MIX_STORAGE_KEYS.shoppingList,
		);
		expect(
			buildIngredientListTabHref(
				url("/ingredients/fridge?sort=recent"),
				MIX_STORAGE_KEYS.shoppingList,
			),
		).toBe("/ingredients/shopping?sort=recent");
		expect(
			buildIngredientListTabHref(
				url("/ingredients/shopping?sort=recent"),
				MIX_STORAGE_KEYS.fridge,
			),
		).toBe("/ingredients/fridge?sort=recent");
	});

	it("uses shallow route state while SvelteKit preserves the underlying page URL", () => {
		const pageUrl = url("/ingredients/fridge");
		const shallowRouteHref = "/ingredients/fridge/filters";

		expect(getActiveIngredientRouteHref(pageUrl, shallowRouteHref)).toBe(
			shallowRouteHref,
		);
		expect(
			getActiveIngredientRouteUrl(pageUrl, shallowRouteHref).pathname,
		).toBe(shallowRouteHref);
		expect(
			getActiveIngredientRouteState(pageUrl, shallowRouteHref),
		).toMatchObject({
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.filters,
			modal: null,
		});
	});

	it("parses explicit search, sheet, modal, and nutrition routes", () => {
		expect(
			getIngredientRouteState(url("/ingredients/fridge/nutrition/-123")),
		).toMatchObject({
			view: INGREDIENT_ROUTE_VIEWS.nutrition,
			foodId: -123,
			listKey: MIX_STORAGE_KEYS.fridge,
		});
		expect(
			getIngredientRouteState(url("/ingredients/fridge/search")),
		).toMatchObject({
			view: INGREDIENT_ROUTE_VIEWS.search,
			sheet: null,
			modal: null,
			foodId: null,
			listKey: null,
		});
		expect(
			getIngredientRouteState(url("/ingredients/fridge/actions/42")),
		).toMatchObject({
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.ingredientActions,
			foodId: 42,
			listKey: MIX_STORAGE_KEYS.fridge,
		});
		expect(
			getIngredientRouteState(
				url("/ingredients/shopping/image-placement/42"),
			),
		).toMatchObject({
			sheet: INGREDIENT_ROUTE_SHEETS.imagePlacement,
			foodId: 42,
			listKey: MIX_STORAGE_KEYS.shoppingList,
		});
		expect(
			getIngredientRouteState(
				url("/ingredients/fridge/nutrition/99?actions=hide"),
			),
		).toMatchObject({
			view: INGREDIENT_ROUTE_VIEWS.nutrition,
			foodId: 99,
			showListActions: false,
		});
		expect(
			getIngredientRouteState(url("/ingredients/fridge/barcode-scanner")),
		).toMatchObject({
			sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
			modal: INGREDIENT_ROUTE_MODALS.barcodeScanner,
		});
		expect(
			getIngredientRouteState(
				url("/ingredients/fridge/search/barcode-scanner"),
			),
		).toMatchObject({
			view: INGREDIENT_ROUTE_VIEWS.search,
			sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
			modal: INGREDIENT_ROUTE_MODALS.barcodeScanner,
		});
		expect(
			getIngredientRouteState(
				url("/ingredients/shopping/search/filters"),
			),
		).toMatchObject({
			view: INGREDIENT_ROUTE_VIEWS.search,
			sheet: INGREDIENT_ROUTE_SHEETS.filters,
			modal: null,
		});
		expect(
			getIngredientRouteState(
				url("/ingredients/shopping/manual-entry/move-ingredient"),
			),
		).toMatchObject({
			sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
			modal: INGREDIENT_ROUTE_MODALS.moveIngredient,
		});
		expect(
			getIngredientRouteState(
				url("/ingredients/fridge/nutrition/99/correct-information"),
			),
		).toMatchObject({
			view: INGREDIENT_ROUTE_VIEWS.nutrition,
			sheet: INGREDIENT_ROUTE_SHEETS.catalogCorrection,
			foodId: 99,
			listKey: MIX_STORAGE_KEYS.fridge,
		});
	});

	it("builds exclusive overlay paths beneath the active list", () => {
		expect(
			buildIngredientRouteHref(url("/ingredients/fridge"), {
				view: INGREDIENT_ROUTE_VIEWS.search,
			}),
		).toBe("/ingredients/fridge/search");
		expect(
			buildIngredientRouteHref(url("/ingredients/shopping/search"), {
				...getIngredientFiltersOpenRoutePatch(
					url("/ingredients/shopping/search"),
				),
			}),
		).toBe("/ingredients/shopping/search/filters");
		expect(
			buildIngredientRouteHref(
				url("/ingredients/shopping/search/filters"),
				getIngredientFiltersCloseRoutePatch(
					url("/ingredients/shopping/search/filters"),
				),
			),
		).toBe("/ingredients/shopping/search");
		expect(
			buildIngredientRouteHref(url("/ingredients/fridge/filters"), {
				view: INGREDIENT_ROUTE_VIEWS.nutrition,
				sheet: null,
				foodId: 101,
				showListActions: false,
			}),
		).toBe("/ingredients/fridge/nutrition/101?actions=hide");
		expect(
			buildIngredientRouteHref(url("/ingredients/shopping/actions/42"), {
				sheet: INGREDIENT_ROUTE_SHEETS.imagePlacement,
				foodId: 42,
				listKey: MIX_STORAGE_KEYS.fridge,
			}),
		).toBe("/ingredients/fridge/image-placement/42");
		expect(
			buildIngredientRouteHref(url("/ingredients/fridge/manual-entry"), {
				sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
				modal: INGREDIENT_ROUTE_MODALS.barcodeScanner,
			}),
		).toBe("/ingredients/fridge/barcode-scanner");
		expect(
			buildIngredientRouteHref(url("/ingredients/fridge/search"), {
				...getBarcodeScannerOpenRoutePatch(
					url("/ingredients/fridge/search"),
				),
			}),
		).toBe("/ingredients/fridge/search/barcode-scanner");
		expect(
			buildIngredientRouteHref(
				url("/ingredients/fridge/search/barcode-scanner"),
				getBarcodeScannerCloseRoutePatch(
					url("/ingredients/fridge/search/barcode-scanner"),
				),
			),
		).toBe("/ingredients/fridge/search");
		expect(
			buildIngredientRouteHref(
				url("/ingredients/fridge/barcode-scanner"),
				{
					view: null,
					sheet: INGREDIENT_ROUTE_SHEETS.manualEntry,
					modal: null,
				},
			),
		).toBe("/ingredients/fridge/manual-entry");
		expect(
			buildIngredientRouteHref(
				url("/ingredients/shopping/nutrition/101"),
				{
					view: INGREDIENT_ROUTE_VIEWS.nutrition,
					sheet: INGREDIENT_ROUTE_SHEETS.catalogCorrection,
					foodId: 101,
					listKey: MIX_STORAGE_KEYS.shoppingList,
				},
			),
		).toBe("/ingredients/shopping/nutrition/101/correct-information");
	});

	it("provides descriptive titles for list and overlay routes", () => {
		expect(getIngredientRouteTitle(url("/ingredients/fridge"))).toBe(
			"Fridge",
		);
		expect(getIngredientRouteTitle(url("/ingredients/shopping"))).toBe(
			"Shopping List",
		);
		expect(getIngredientRouteTitle(url("/ingredients/fridge/search"))).toBe(
			"Search Ingredients",
		);
		expect(
			getIngredientRouteTitle(
				url("/ingredients/shopping/nutrition/42"),
				"Tomato Soup",
			),
		).toBe("Tomato Soup Nutrition");
		expect(
			getIngredientRouteTitle(
				url("/ingredients/shopping/nutrition/42/correct-information"),
				"Tomato Soup",
			),
		).toBe("Correct Tomato Soup");
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
			findIngredientRouteFood(
				2,
				null,
				[fridgeFood],
				[shoppingFood],
				[customFood],
			),
		).toBe(customFood);
	});
});
