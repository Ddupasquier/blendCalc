import { describe, expect, it } from "vitest";
import {
	mapOpenFoodFactsNutrients,
	mapOpenFoodFactsNutrientSourceReview,
	normalizeNutrientUnit,
} from "$lib/utils/barcode/barcodeNutrients";
import type { ProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";

const catalog: ProductReferenceCatalog = {
	sources: {},
	nutrientMappings: [
		{
			sourceKey: "open-food-facts",
			sourceNutrientKey: "vitamin-d",
			sourceNutrientName: "Vitamin D",
			sourceUnitName: "UG",
			priority: 0,
			mappingMethod: "db_reviewed_api_key_match",
			mappingReviewReference: "reviewed-vitamin-d-micrograms",
			nutrientId: 1114,
			nutrientName: "Vitamin D (D2 + D3)",
			nutrientNumber: "328",
			unitName: "UG",
		},
	],
	nutrientConversions: [],
	nutrientEquivalences: [],
};

describe("Open Food Facts nutrient unit identity", () => {
	it("normalizes common equivalent unit spellings", () => {
		expect(normalizeNutrientUnit("micrograms")).toBe("UG");
		expect(normalizeNutrientUnit("International Units")).toBe("IU");
	});

	it("maps a reviewed source key only when its reported unit matches", () => {
		expect(
			mapOpenFoodFactsNutrients(
				{ "vitamin-d_100g": 2.5, "vitamin-d_unit": "micrograms" },
				100,
				false,
				catalog,
			),
		).toMatchObject([{ nutrientId: 1114, value: 2.5 }]);
	});

	it("rejects the same source key when the provider reports another unit", () => {
		expect(
			mapOpenFoodFactsNutrients(
				{ "vitamin-d_100g": 100, "vitamin-d_unit": "IU" },
				100,
				false,
				catalog,
			),
		).toEqual([]);
	});

	it("uses the reviewed mapping unit when the provider omits its redundant unit field", () => {
		expect(
			mapOpenFoodFactsNutrients({ "vitamin-d_100g": 1.5 }, 100, false, catalog),
		).toMatchObject([{ nutrientId: 1114, value: 1.5 }]);
	});

	it("retains an unfamiliar numeric nutrient for review without mapping it", () => {
		const nutriments = {
			"future-nutrient_100g": 2.5,
			"future-nutrient_unit": "mg",
		};

		expect(mapOpenFoodFactsNutrients(nutriments, 100, false, catalog)).toEqual(
			[],
		);
		expect(
			mapOpenFoodFactsNutrientSourceReview(nutriments, false, catalog, {
				kind: "mass",
				quantity: 100,
				unitKey: "g",
			}),
		).toEqual([
			expect.objectContaining({
				nutrientName: "Future Nutrient",
				unitName: "mg",
				amount: 2.5,
				amountPer100g: 2.5,
				mappingStatus: "unmapped",
				sourceNutrientKey: "future-nutrient",
			}),
		]);
	});

	it("retains a reviewed key reported in an unapproved unit", () => {
		const review = mapOpenFoodFactsNutrientSourceReview(
			{ "vitamin-d_100g": 100, "vitamin-d_unit": "IU" },
			false,
			catalog,
			{ kind: "mass", quantity: 100, unitKey: "g" },
		);

		expect(review).toMatchObject([
			{
				nutrientId: 1114,
				nutrientName: "Vitamin D",
				unitName: "IU",
				amount: 100,
				mappingMethod: "reported-unit-or-conversion-not-approved",
			},
		]);
	});

	it("preserves zero and serving-basis evidence", () => {
		const review = mapOpenFoodFactsNutrientSourceReview(
			{
				"future-nutrient_serving": 0,
				"future-nutrient_100g": 3,
				"future-nutrient_unit": "mg",
			},
			true,
			catalog,
			{
				kind: "serving",
				quantity: 1,
				unitKey: "serving",
				servingLabel: "1 bar",
			},
		);

		expect(review).toMatchObject([
			{
				amount: 0,
				valueStatus: "reported-zero",
				measurementBasis: { kind: "serving", servingLabel: "1 bar" },
			},
		]);
	});

	it("ignores invalid values, modifiers, and provider score metadata", () => {
		const review = mapOpenFoodFactsNutrientSourceReview(
			{
				negative_100g: -1,
				negative_unit: "mg",
				"not-a-number_100g": "unknown",
				"not-a-number_unit": "mg",
				bounded_100g: 1,
				bounded_unit: "mg",
				bounded_modifier: "<",
				"nutrition-score-fr_100g": 7,
				"unitless-metadata_100g": 8,
			},
			false,
			catalog,
			{ kind: "mass", quantity: 100, unitKey: "g" },
		);

		expect(review).toEqual([]);
	});
});
