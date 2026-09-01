import { describe, expect, it } from "vitest";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { ProductReferenceCatalog } from "$lib/utils/food/reference/productReferenceCatalog";
import { barcodeDraftUsesOnlyCanonicalSources } from "$lib/utils/products/catalogSourcePolicy";

const catalog: ProductReferenceCatalog = {
	sources: {
		usda: {
			key: "usda",
			displayName: "USDA FoodData Central",
			attributionText: null,
			canonicalStorageAllowed: true,
			canonicalLicenseName: "CC0-1.0",
		},
		"open-food-facts": {
			key: "open-food-facts",
			displayName: "Open Food Facts",
			attributionText: null,
			canonicalStorageAllowed: false,
			canonicalLicenseName: "ODbL-1.0",
		},
	},
	nutrientMappings: [],
	nutrientConversions: [],
	nutrientEquivalences: [],
};

const createDraft = (overrides: Partial<BarcodeProductDraft> = {}) => ({
	barcode: "00021130493609",
	name: "Tomato Sauce",
	nameProvenance: "source" as const,
	brandOwner: "Example",
	servingLabel: "1 cup (245g)",
	servingWeightGrams: 245,
	nutrients: [],
	reportedNutrientIds: [],
	source: "usda" as const,
	sourceLabel: "USDA FoodData Central",
	sourceReference: "123",
	...overrides,
});

describe("catalog source policy", () => {
	it("allows a draft only when every product-data source is reusable", () => {
		expect(barcodeDraftUsesOnlyCanonicalSources(createDraft(), catalog)).toBe(
			true,
		);
		expect(
			barcodeDraftUsesOnlyCanonicalSources(
				createDraft({
					fieldProvenance: {
						ingredients: {
							source: "open-food-facts",
							confidence: "imported",
						},
					},
				}),
				catalog,
			),
		).toBe(false);
	});

	it("keeps separately licensed image provenance out of product-data policy", () => {
		expect(
			barcodeDraftUsesOnlyCanonicalSources(
				createDraft({
					fieldProvenance: {
						image: {
							source: "open-food-facts",
							confidence: "imported",
						},
					},
				}),
				catalog,
			),
		).toBe(true);
	});
});
