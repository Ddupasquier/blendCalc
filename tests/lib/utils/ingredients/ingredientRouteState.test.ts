import { describe, expect, it } from "vitest";
import { MIX_STORAGE_KEYS } from "../../../../src/defaults/mixDefaults";
import {
	buildIngredientRouteHref,
	findIngredientRouteFood,
	getIngredientRouteState,
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
	it("parses search, sheet, and nutrition route state", () => {
		expect(getIngredientRouteState(url("/fridge?view=search"))).toMatchObject({
			view: INGREDIENT_ROUTE_VIEWS.search,
			sheet: null,
			foodId: null,
			listKey: null,
			showListActions: true,
		});

		expect(
			getIngredientRouteState(url("/fridge?sheet=ingredient-actions&list=fridge&food=42")),
		).toMatchObject({
			view: null,
			sheet: INGREDIENT_ROUTE_SHEETS.ingredientActions,
			foodId: 42,
			listKey: MIX_STORAGE_KEYS.fridge,
		});

		expect(
			getIngredientRouteState(url("/fridge?view=nutrition&food=99&actions=hide")),
		).toMatchObject({
			view: INGREDIENT_ROUTE_VIEWS.nutrition,
			sheet: null,
			foodId: 99,
			showListActions: false,
		});
	});

	it("builds exclusive pop-in URLs while preserving unrelated params", () => {
		expect(
			buildIngredientRouteHref(url("/fridge?tab=fridge"), {
				view: INGREDIENT_ROUTE_VIEWS.search,
			}),
		).toBe("/fridge?tab=fridge&view=search");

		expect(
			buildIngredientRouteHref(url("/fridge?view=search"), {
				view: null,
				sheet: INGREDIENT_ROUTE_SHEETS.filters,
			}),
		).toBe("/fridge?sheet=filters");

		expect(
			buildIngredientRouteHref(url("/fridge?sheet=filters"), {
				view: INGREDIENT_ROUTE_VIEWS.nutrition,
				sheet: null,
				foodId: 101,
				showListActions: false,
			}),
		).toBe("/fridge?view=nutrition&food=101&actions=hide");
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
