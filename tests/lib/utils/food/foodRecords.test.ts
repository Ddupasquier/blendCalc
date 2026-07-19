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

	it("keeps safe barcode capture provenance in saved food snapshots", () => {
		const food: FdcFood = {
			fdcId: -1,
			description: "GS1 Test Product",
			foodNutrients: [],
			barcode: "09506000151519",
			barcodeProvenance: {
				captureMethod: "gs1-digital-link",
				sourceReference: "https://id.gs1.org/01/09506000151519",
				format: "QR_CODE",
			},
		};

		expect(compactFood(food).barcodeProvenance).toEqual(food.barcodeProvenance);
	});
});
