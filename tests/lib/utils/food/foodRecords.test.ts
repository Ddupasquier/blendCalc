import { describe, expect, it } from "vitest";
import { compactFood } from "$lib/utils/food/records/foodRecords";
import type { FdcFood } from "$lib/utils/food/types";

describe("compact food records", () => {
	it("keeps field-level source tracking in saved food snapshots", () => {
		const food: FdcFood = {
			fdcId: 2658692,
			description: "Roasted Onion & Garlic Pasta Sauce",
			foodNutrients: [],
			fieldProvenance: {
				nutrition: {
					source: "usda",
					sourceReference: "2658692",
					confidence: "source-verified",
				},
				image: {
					source: "open-food-facts",
					sourceReference: "00021130493609",
					confidence: "imported",
				},
				serving: {
					source: "open-food-facts",
					sourceReference: "00021130493609",
					confidence: "imported",
				},
			},
		};

		expect(compactFood(food).fieldProvenance).toEqual(food.fieldProvenance);
	});
});
