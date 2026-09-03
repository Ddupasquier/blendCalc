import { describe, expect, it } from "vitest";
import {
	getBarcodeCategoryWarningMessage,
	getBarcodeDraftState,
} from "$lib/components/ingredients/manual-entry/utils/barcodeFlow";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";

const createDraft = (
	overrides: Partial<BarcodeProductDraft> = {},
): BarcodeProductDraft => ({
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
	it("keeps reported zeroes without fabricating zeroes for missing values", () => {
		const state = getBarcodeDraftState(
			createDraft({
				nutrients: [
					{
						nutrientId: 1004,
						nutrientName: "Total Fat",
						nutrientNumber: "204",
						unitName: "G",
						value: 0,
					},
					{
						nutrientId: 1003,
						nutrientName: "Protein",
						nutrientNumber: "203",
						unitName: "G",
						value: Number.NaN,
					},
				],
			}),
		);

		expect(state.manualNutrientValues).toEqual({ 1004: 0 });
		expect(state.importedNutrients).toHaveLength(1);
	});

	it("does not turn a mass-only source serving into an item measure", () => {
		const state = getBarcodeDraftState(
			createDraft({
				servingLabel: "28 g",
				servingWeightGrams: 28,
				serving: {
					label: "28 g",
					gramWeight: 28,
					amount: 28,
					unitKey: "g",
					isPrimary: true,
					measureType: "Package serving",
					isHouseholdMeasure: false,
				},
			}),
		);

		expect(state).toMatchObject({
			servingWeightGrams: 28,
			useServingMeasure: false,
			servingMeasureQuantity: 28,
			servingMeasureUnit: "g",
		});
	});

	it("uses the DB-resolved category for the visible manual-entry category", () => {
		const state = getBarcodeDraftState(
			createDraft({
				resolvedCategory: "Jams",
				categoryResolution: {
					categoryOptionId: "jams",
					label: "Jams",
					sourceValue: "fruit and vegetable preserves",
					confidence: "exact",
				},
			}),
		);

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

	it("carries the canonical image placement into the saved manual-entry draft", () => {
		const state = getBarcodeDraftState(
			createDraft({
				image: {
					source: "open-food-facts",
					sourceReference: "00021130462506",
					role: "front",
					imageUrl: "https://images.openfoodfacts.org/example.jpg",
					licenseName: "Example license",
					confidence: "source-verified",
					cropX: 62,
					cropY: 44,
					cropZoom: 2.4,
					rotationDegrees: 0,
					fitMode: "custom",
					placementVersion: 2,
					placementMethod: "automatic-ocr",
					suggestionVersion: "tesseract-product-label-v3",
					suggestionConfidence: 78,
				},
			}),
		);

		expect(state.imagePlacement).toMatchObject({
			cropX: 62,
			cropY: 44,
			cropZoom: 2.4,
			fitMode: "custom",
			placementMethod: "automatic-ocr",
		});
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
