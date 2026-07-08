import { describe, expect, it } from "vitest";
import { resolveBarcodeDraftCategory } from "$lib/server/products/categoryMapping.server";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";

const createDraft = (categories: string[]): BarcodeProductDraft => ({
	barcode: "00021130462506",
	name: "Strawberry jelly, strawberry",
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
	from: () => ({
		select: () => ({
			in: async () => ({
				data: [
					{
						source_normalized_value: "sweets",
						category_option_id: "sweets",
						category_option_label: "Sweets",
						confidence: "exact",
						observation_count: 287,
					},
					{
						source_normalized_value: "fruit and vegetable preserves",
						category_option_id: "fruit-and-vegetable-preserves",
						category_option_label: "Fruit And Vegetable Preserves",
						confidence: "exact",
						observation_count: 100,
					},
				],
				error: null,
			}),
		}),
	}),
});

describe("barcode category mapping", () => {
	it("prefers the more specific later API category over a broader high-count category", async () => {
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
