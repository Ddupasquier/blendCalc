import { describe, expect, it } from "vitest";
import { getBarcodeDraftState } from "$lib/components/ingredients/manual-entry/utils/barcodeFlow";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";

const createDraft = (overrides: Partial<BarcodeProductDraft> = {}): BarcodeProductDraft => ({
	barcode: "00021130462506",
	name: "Strawberry jelly, strawberry",
	brandOwner: "Safeway, Inc.",
	servingLabel: "50 g",
	servingWeightGrams: 50,
	nutrients: [],
	reportedNutrientIds: [],
	categories: ["Fruit and vegetable preserves", "Sweet spreads"],
	source: "open-food-facts",
	sourceLabel: "Open Food Facts",
	sourceReference: "00021130462506",
	...overrides,
});

describe("manual entry barcode flow", () => {
	it("uses the DB-resolved category for the visible manual-entry category", () => {
		const state = getBarcodeDraftState(createDraft({
			resolvedCategory: "Jams",
			categoryResolution: {
				categoryOptionId: "jams",
				label: "Jams",
				sourceValue: "fruit and vegetable preserves",
				confidence: "exact",
			},
		}));

		expect(state.category).toBe("Jams");
		expect(state.categories).toEqual([
			"Jams",
			"Fruit and vegetable preserves",
			"Sweet spreads",
		]);
	});
});
