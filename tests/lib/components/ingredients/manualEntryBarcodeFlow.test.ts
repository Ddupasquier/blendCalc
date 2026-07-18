import { describe, expect, it } from "vitest";
import {
	getBarcodeCategoryWarningMessage,
	getBarcodeDraftState,
} from "$lib/components/ingredients/manual-entry/utils/barcodeFlow";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";

const createDraft = (overrides: Partial<BarcodeProductDraft> = {}): BarcodeProductDraft => ({
	barcode: "00021130462506",
	name: "Strawberry jelly, strawberry",
	nameProvenance: "source",
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

	it("does not use raw API category strings as the visible manual-entry category", () => {
		const state = getBarcodeDraftState(createDraft());

		expect(state.category).toBe("");
		expect(state.categories).toEqual([
			"Fruit and vegetable preserves",
			"Sweet spreads",
		]);
	});

	it("warns when a valid barcode match has no trusted DB category", () => {
		const warning = getBarcodeCategoryWarningMessage({
			barcode: "00021130462506",
			sourceDraft: createDraft(),
			selectedCategory: "",
		});

		expect(warning).toBe(
			"Barcode found, but blendCalc does not have a trusted category for it yet. Please select a category for this ingredient.",
		);
	});

	it("does not warn after the user selects a category", () => {
		const warning = getBarcodeCategoryWarningMessage({
			barcode: "00021130462506",
			sourceDraft: createDraft(),
			selectedCategory: "Jams",
		});

		expect(warning).toBe("");
	});

	it("does not warn when the barcode match has a trusted DB category", () => {
		const warning = getBarcodeCategoryWarningMessage({
			barcode: "00021130462506",
			sourceDraft: createDraft({
				resolvedCategory: "Jams",
				categoryResolution: {
					categoryOptionId: "jams",
					label: "Jams",
					sourceValue: "fruit and vegetable preserves",
					confidence: "exact",
				},
			}),
			selectedCategory: "",
		});

		expect(warning).toBe("");
	});
});
