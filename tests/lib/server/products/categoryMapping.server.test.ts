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

const createSupabaseMock = (
	resolved = {
		source_normalized_value: "fruit and vegetable preserves",
		category_option_id: "fruit-and-vegetable-preserves",
		category_option_label: "Fruit And Vegetable Preserves",
		confidence: "exact",
		symbol_key: "fruit",
	},
) => ({
	rpc: async () => ({
		data: [resolved],
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

	it("uses the specific exact category selected from source evidence", async () => {
		const draft = await resolveBarcodeDraftCategory(
			createSupabaseMock({
				source_normalized_value: "chocolate sauce",
				category_option_id: "chocolate-sauce",
				category_option_label: "Chocolate Sauce",
				confidence: "exact",
				symbol_key: "sauces-condiments",
			}) as never,
			createDraft([
				"en:dressings-and-sauces",
				"en:syrups",
				"en:chocolate-sauce",
			]),
		);

		expect(draft.resolvedCategory).toBe("Chocolate Sauce");
		expect(draft.categoryResolution).toMatchObject({
			categoryOptionId: "chocolate-sauce",
			sourceValue: "chocolate sauce",
			confidence: "exact",
			symbolKey: "sauces-condiments",
		});
	});

	it("uses the exact Gochujang category instead of a merchandising dip bucket", async () => {
		const draft = await resolveBarcodeDraftCategory(
			createSupabaseMock({
				source_normalized_value: "gochujang",
				category_option_id: "gochujang",
				category_option_label: "Gochujang",
				confidence: "exact",
				symbol_key: "sauces-condiments",
			}) as never,
			createDraft(["Dips and Salsa", "en:sauces", "en:gochujang"]),
		);

		expect(draft.resolvedCategory).toBe("Gochujang");
		expect(draft.categoryResolution).toMatchObject({
			categoryOptionId: "gochujang",
			sourceValue: "gochujang",
			confidence: "exact",
			symbolKey: "sauces-condiments",
		});
	});
});
