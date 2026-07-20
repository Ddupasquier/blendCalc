import { describe, expect, it } from "vitest";
import { resolveBarcodeDraftCategory } from "$lib/server/products/categoryMapping.server";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";

const createDraft = (categories: string[]): BarcodeProductDraft => ({
	barcode: "00021130462506",
	name: "Strawberry jelly, strawberry",
	nameProvenance: "source",
	brandOwner: "Safeway, Inc.",
	servingLabel: "50 g",
	servingWeightGrams: 50,
	nutrients: [],
	reportedNutrientIds: [],
	categories,
	source: "open-food-facts",
	sourceLabel: "Open Food Facts",
	sourceReference: "00021130462506",
});

const createSupabaseMock = () => ({
	rpc: async () => ({
		data: [
			{
				source_normalized_value: "fruit and vegetable preserves",
				category_option_id: "fruit-and-vegetable-preserves",
				category_option_label: "Fruit And Vegetable Preserves",
				confidence: "exact",
				symbol_key: "fruit",
			},
		],
		error: null,
	}),
});

describe("barcode category mapping", () => {
	it("uses the category ranked by the database resolver", async () => {
		const draft = await resolveBarcodeDraftCategory(
			createSupabaseMock() as never,
			createDraft(["Sweets", "Fruit and vegetable preserves"]),
		);

		expect(draft.resolvedCategory).toBe("Fruit And Vegetable Preserves");
		expect(draft.categoryResolution).toMatchObject({
			categoryOptionId: "fruit-and-vegetable-preserves",
			sourceValue: "fruit and vegetable preserves",
		});
	});
});
