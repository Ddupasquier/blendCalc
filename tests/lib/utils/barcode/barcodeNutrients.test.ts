import { describe, expect, it } from "vitest";
import {
	mapOpenFoodFactsNutrients,
	normalizeNutrientUnit,
} from "$lib/utils/barcode/barcodeNutrients";
import type { ProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";

const catalog: ProductReferenceCatalog = {
	sources: {},
	nutrientMappings: [{
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
	}],
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
			mapOpenFoodFactsNutrients(
				{ "vitamin-d_100g": 1.5 },
				100,
				false,
				catalog,
			),
		).toMatchObject([{ nutrientId: 1114, value: 1.5 }]);
	});
});
