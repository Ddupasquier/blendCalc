import { describe, expect, it } from "vitest";
import { getFoodAllergenDisplay } from "$lib/utils/food/records/foodAllergens";
import type { FoodCompatibilityFact } from "$lib/utils/food/quality/compatibility";
import type { FdcFood } from "$lib/utils/food/types";

const createFood = (overrides: Partial<FdcFood> = {}): FdcFood => ({
	fdcId: 1,
	description: "Test food",
	foodNutrients: [],
	...overrides,
});

const createAllergenFact = (
	overrides: Partial<FoodCompatibilityFact>,
): FoodCompatibilityFact => ({
	slug: "milk",
	label: "Milk",
	category: "allergen",
	factType: "contains",
	sourceType: "label_allergen_field",
	sourceText: "milk",
	confidence: "confirmed",
	...overrides,
});

describe("getFoodAllergenDisplay", () => {
	it("separates source allergens from trace statements", () => {
		expect(
			getFoodAllergenDisplay(createFood({
				allergens: ["en:milk", "soybeans"],
				traces: ["tree-nuts", "sesame seeds"],
			})),
		).toEqual({
			contains: ["Milk", "Soybeans"],
			mayContain: ["Tree nuts", "Sesame seeds"],
		});
	});

	it("includes DB-derived compatibility facts without duplicating source arrays", () => {
		const containsMilk = createAllergenFact({});
		const mayContainPeanuts = createAllergenFact({
			slug: "peanuts",
			label: "Peanuts",
			factType: "may_contain",
			sourceType: "label_trace_field",
			sourceText: "peanuts",
		});

		expect(
			getFoodAllergenDisplay(createFood({
				allergens: ["milk"],
				compatibilitySummary: {
					version: 1,
					generatedAt: "2026-07-22T00:00:00.000Z",
					allFacts: [containsMilk, mayContainPeanuts],
					contains: [containsMilk],
					mayContain: [mayContainPeanuts],
					dietaryClaims: [],
					ingredientSignals: [],
				},
			})),
		).toEqual({
			contains: ["Milk"],
			mayContain: ["Peanuts"],
		});
	});

	it("lets an explicit contains statement outrank the same trace allergen", () => {
		expect(
			getFoodAllergenDisplay(createFood({
				allergens: ["Eggs"],
				traces: ["eggs", "nuts"],
			})),
		).toEqual({
			contains: ["Eggs"],
			mayContain: ["Nuts"],
		});
	});
});
