import { describe, expect, it } from "vitest";
import {
	getFoodServingByGrams,
	getFoodServings,
	getPrimaryFoodServing,
} from "$lib/utils/food/servings/foodServings";
import type { FdcFood } from "$lib/utils/food/types";

const baseFood: FdcFood = {
	fdcId: 1,
	description: "Test food",
	foodNutrients: [],
};

describe("food servings", () => {
	it("orders stored source servings with the primary option first", () => {
		const food: FdcFood = {
			...baseFood,
			foodServings: [
				{ label: "1 oz", gramWeight: 28, isPrimary: false, source: "usda" },
				{ label: "1 package", gramWeight: 56, isPrimary: true, source: "usda" },
			],
		};

		expect(getFoodServings(food).map((serving) => serving.label)).toEqual([
			"1 package",
			"1 oz",
		]);
		expect(getPrimaryFoodServing(food)?.gramWeight).toBe(56);
		expect(getFoodServingByGrams(food, 28)?.label).toBe("1 oz");
	});

	it("does not invent a serving when the source explicitly had none", () => {
		expect(getFoodServings({
			...baseFood,
			servingSize: 100,
			servingSizeUnit: "g",
			hasSourceServing: false,
		})).toEqual([]);
	});
});
