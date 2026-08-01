import { describe, expect, it } from "vitest";
import {
	getFoodServingByGrams,
	getFoodServings,
	getPrimaryFoodServing,
} from "$lib/utils/food/servings/foodServings";
import { formatNutritionServingSize } from "$lib/utils/food/servings/servingDisplay";
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

	it("does not turn a provider name into verified serving evidence", () => {
		expect(getFoodServings({
			...baseFood,
			barcodeSource: "usda",
			servingSize: 30,
			servingSizeUnit: "g",
			hasSourceServing: true,
		})[0]?.confidence).toBe("unknown");
	});

	it("does not invent USDA provenance for a source-less legacy serving", () => {
		expect(getFoodServings({
			...baseFood,
			servingSize: 30,
			servingSizeUnit: "g",
			hasSourceServing: true,
		})[0]).toMatchObject({
			source: "unknown",
			sourceReference: undefined,
			confidence: "unknown",
		});
	});

	it("does not interpret a source quantity without an explicit unit", () => {
		expect(getFoodServings({
			...baseFood,
			servingSize: 30,
			hasSourceServing: true,
		})).toEqual([]);
	});

	it("preserves explicit user serving lineage without reading food identity", () => {
		expect(getFoodServings({
			...baseFood,
			servingSize: 30,
			servingSizeUnit: "g",
			hasSourceServing: true,
			fieldProvenance: {
				serving: {
					source: "user-label",
					confidence: "user-reported",
				},
			},
		})[0]).toMatchObject({
			source: "user-label",
			origin: "user-entered",
			gramWeightMethod: "user-reported",
			confidence: "user-reported",
		});
	});

	it("formats nutrition-label serving sizes with grams in trailing parentheses", () => {
		expect(formatNutritionServingSize({
			label: "1/2 cup (125g)",
			gramWeight: 125,
			amount: 0.5,
			unitKey: "cup",
			isPrimary: true,
		})).toBe("1/2 cup (125g)");
		expect(formatNutritionServingSize({
			label: "30 g serving",
			gramWeight: 30,
			isPrimary: true,
		})).toBe("30g");
		expect(formatNutritionServingSize({
			label: "1 oz",
			gramWeight: 28.35,
			isPrimary: true,
		})).toBe("1 oz (28.35g)");
	});
});
