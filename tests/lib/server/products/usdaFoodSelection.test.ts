import { describe, expect, it } from "vitest";
import {
	rankUsdaGenericFoods,
	selectPreferredUsdaBarcodeFood,
} from "$lib/server/products/usdaFoodSelection";
import type { FdcFood } from "$lib/utils/food/types";

const food = (overrides: Partial<FdcFood>): FdcFood => ({
	fdcId: 1,
	description: "Test food",
	dataType: "Branded",
	foodNutrients: [],
	...overrides,
});

describe("USDA food selection", () => {
	it("selects the newest exact Branded record for a barcode", () => {
		const selected = selectPreferredUsdaBarcodeFood([
			food({
				fdcId: 100,
				gtinUpc: "021130493609",
				publishedDate: "2021-10-28",
				foodNutrients: [{
					nutrientId: 1008,
					nutrientName: "Energy",
					nutrientNumber: "208",
					unitName: "KCAL",
					value: 48,
				}],
			}),
			food({
				fdcId: 200,
				gtinUpc: "021130493609",
				publishedDate: "2024-05-01",
				foodNutrients: [],
			}),
			food({
				fdcId: 300,
				gtinUpc: "021130493609",
				dataType: "Foundation",
				publishedDate: "2025-01-01",
			}),
			food({
				fdcId: 400,
				gtinUpc: "00021130462506",
				publishedDate: "2026-01-01",
			}),
		], "00021130493609");

		expect(selected?.fdcId).toBe(200);
	});

	it("prefers an active record over a discontinued duplicate", () => {
		const selected = selectPreferredUsdaBarcodeFood([
			food({
				fdcId: 100,
				gtinUpc: "021130493609",
				publishedDate: "2025-01-01",
				discontinuedDate: "2025-02-01",
			}),
			food({
				fdcId: 200,
				gtinUpc: "021130493609",
				publishedDate: "2024-01-01",
			}),
		], "00021130493609");

		expect(selected?.fdcId).toBe(200);
	});

	it("uses USDA subtype priority only after text relevance", () => {
		const ranked = rankUsdaGenericFoods([
			food({ fdcId: 1, description: "Tomato, raw", dataType: "SR Legacy" }),
			food({ fdcId: 2, description: "Tomato, raw", dataType: "Foundation" }),
			food({ fdcId: 3, description: "Soup with tomato", dataType: "Foundation" }),
			food({ fdcId: 4, description: "Tomato sauce", dataType: "Survey (FNDDS)" }),
		], "tomato");

		expect(ranked.map((item) => item.fdcId)).toEqual([2, 1, 4, 3]);
	});
});
