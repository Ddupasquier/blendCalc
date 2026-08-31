import { describe, expect, it } from "vitest";
import {
	barcodeDraftMatchesEntry,
	type BarcodeProductDraftComparisonEntry,
} from "$lib/utils/barcode/barcodeDraftComparison";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";

const zeroProtein = {
	nutrientId: 1003,
	nutrientName: "Protein",
	nutrientNumber: "203",
	unitName: "G",
	value: 0,
};

const draft = {
	barcode: "00021130462506",
	name: "Test food",
	nameProvenance: "barcode",
	brandOwner: "Test brand",
	servingLabel: "100 g",
	servingWeightGrams: 100,
	hasSourceServing: true,
	nutrients: [],
	reportedNutrientIds: [],
	ingredients: "",
	ingredientList: [],
	allergens: [],
	traces: [],
	dietaryTags: [],
	labels: [],
	categories: ["Test category"],
	resolvedCategory: "Test category",
	source: "usda",
	sourceLabel: "USDA FoodData Central",
} satisfies BarcodeProductDraft;

const entry = {
	name: "Test food",
	brandOwner: "Test brand",
	category: "Test category",
	servingLabel: "100 g",
	servingWeightGrams: 100,
	volumeEquivalent: null,
	nutrients: [zeroProtein],
	nutrientQualitativeFacts: [],
	ingredients: "",
	ingredientList: [],
	allergens: [],
	traces: [],
	dietaryTags: [],
	labels: [],
	categories: [],
} satisfies BarcodeProductDraftComparisonEntry;

describe("barcode draft comparison", () => {
	it("does not treat a missing nutrient as a reported zero", () => {
		expect(barcodeDraftMatchesEntry(draft, entry)).toBe(false);
	});

	it("matches when both records explicitly report zero", () => {
		expect(
			barcodeDraftMatchesEntry(
				{
					...draft,
					nutrients: [zeroProtein],
					reportedNutrientIds: [zeroProtein.nutrientId],
				},
				entry,
			),
		).toBe(true);
	});
});
