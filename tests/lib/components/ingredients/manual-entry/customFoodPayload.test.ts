import { describe, expect, it } from "vitest";
import { createManualEntryCustomFood } from "$lib/components/ingredients/manual-entry/utils/customFoodPayload";
import {
	getManualEntryFormResetState,
	getManualEntryFormStateFromFood,
} from "$lib/components/ingredients/manual-entry/utils/formState";

describe("Manual Entry source nutrient review evidence", () => {
	it("does not expose a weight-unit serving as a volume or item measure", () => {
		const state = getManualEntryFormStateFromFood(
			{
				fdcId: 9100045,
				description: "Source ounce serving",
				dataType: "Branded",
				foodNutrients: [],
				foodServings: [
					{
						label: "1 oz (28 g)",
						gramWeight: 28,
						amount: 1,
						unitKey: "oz",
						isPrimary: true,
						measureType: "Package serving",
						isHouseholdMeasure: true,
					},
				],
			},
			"catalog_correction",
		);

		expect(state).toMatchObject({
			servingLabel: "1 oz (28 g)",
			servingWeightGrams: 28,
			useServingMeasure: false,
			servingMeasureQuantity: 1,
			servingMeasureUnit: "oz",
		});
	});

	it("survives save construction and form rehydration without entering nutrition math", () => {
		const state = getManualEntryFormResetState();
		state.nutrientSourceReview = [
			{
				nutrientName: "Future nutrient",
				unitName: "mg",
				amount: 2,
				measurementBasis: { kind: "mass", quantity: 100, unitKey: "g" },
				amountPer100g: 2,
				valueStatus: "reported",
				mappingStatus: "unmapped",
				source: "open-food-facts",
				sourceNutrientKey: "future-nutrient",
			},
		];

		const food = createManualEntryCustomFood({
			...state,
			name: "Source review example",
			servingLabel: "50 g",
			servingWeightGrams: 50,
			barcode: "00000000000123",
			activeCategory: "Packaged food",
			manualEntryNutrientFields: [],
			customFood: false,
		});

		expect(food.foodNutrients).toEqual([]);
		expect(food.nutrientSourceReview).toMatchObject([
			{
				sourceNutrientKey: "future-nutrient",
				amount: 2,
				mappingStatus: "unmapped",
			},
		]);
		expect(
			getManualEntryFormStateFromFood(food, "catalog_correction")
				.nutrientSourceReview,
		).toEqual(food.nutrientSourceReview);
	});
});
