import { describe, expect, it } from "vitest";
import {
	summarizeBarcodeProductQuality,
	summarizeUsdaFoodQuality,
} from "$lib/utils/food/sources/sourceQuality";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";

describe("product source quality", () => {
	it("counts reported zero nutrients and source-backed product fields", () => {
		const draft: BarcodeProductDraft = {
			barcode: "00021130462506",
			name: "Strawberry jelly",
			nameProvenance: "source",
			brandOwner: "Safeway",
			servingLabel: "1 tbsp (20 g)",
			servingWeightGrams: 20,
			hasSourceServing: true,
			nutrients: [],
			reportedNutrientIds: [1008, 1004, 1004, 1005],
			categories: ["Jams"],
			ingredients: "Strawberries, sugar",
			image: {
				source: "open-food-facts",
				role: "front",
				imageUrl: "https://example.com/product.jpg",
				licenseName: "CC BY-SA",
				confidence: "imported",
			},
			source: "usda",
			sourceLabel: "USDA FoodData Central",
		};

		expect(summarizeBarcodeProductQuality(draft)).toEqual({
			reportedNutrientCount: 3,
			hasBrand: true,
			hasCategory: true,
			hasServing: true,
			hasIngredients: true,
			hasImage: true,
		});
	});

	it("does not treat a default 100g basis as a reported package serving", () => {
		expect(summarizeUsdaFoodQuality({
			fdcId: 1,
			description: "Tomato, raw",
			dataType: "Foundation",
			foodNutrients: [{
				nutrientId: 1008,
				nutrientName: "Energy",
				nutrientNumber: "208",
				unitName: "KCAL",
				value: 18,
			}],
			foodCategory: "Vegetables",
		})).toMatchObject({
			reportedNutrientCount: 1,
			hasCategory: true,
			hasServing: false,
		});
	});
});
