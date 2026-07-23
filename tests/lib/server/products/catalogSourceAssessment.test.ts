import { describe, expect, it, vi } from "vitest";
import { assessCatalogProductSources } from "$lib/server/products/catalogSourceAssessment.server";
import type { Database } from "$lib/types/database.types";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { SupabaseClient } from "@supabase/supabase-js";

const makeDraft = (
	source: "usda" | "open-food-facts",
	overrides: Partial<BarcodeProductDraft> = {},
): BarcodeProductDraft => ({
	barcode: "00021130493609",
	name: "Roasted Onion & Garlic Pasta Sauce",
	nameProvenance: "source",
	brandOwner: "Signature Select",
	servingLabel: "100 g",
	servingWeightGrams: 100,
	hasSourceServing: false,
	nutrients: source === "usda"
		? [{
			nutrientId: 1008,
			nutrientName: "Energy",
			nutrientNumber: "208",
			unitName: "KCAL",
			value: 48,
			source: "usda",
		}]
		: [],
	reportedNutrientIds: source === "usda" ? [1008] : [],
	source,
	sourceLabel: source === "usda" ? "USDA FoodData Central" : "Open Food Facts",
	sourceReference: source === "usda" ? "2658692" : "00021130493609",
	...overrides,
});

const supabase = {} as SupabaseClient<Database>;
const resolveCategory = vi.fn(async (_supabase, draft: BarcodeProductDraft) => draft);

describe("catalog source assessment", () => {
	it("merges independently useful fields from both exact-barcode sources", async () => {
		const assessment = await assessCatalogProductSources(
			supabase,
			"00021130493609",
			{
				usda: vi.fn().mockResolvedValue(makeDraft("usda")),
				openFoodFacts: vi.fn().mockResolvedValue(makeDraft("open-food-facts", {
					ingredients: "Tomatoes, onions",
					allergens: ["milk"],
					image: {
						source: "open-food-facts",
						role: "front",
						imageUrl: "https://example.com/product.jpg",
						licenseName: "CC BY-SA",
						confidence: "imported",
					},
				})),
				resolveCategory,
			},
		);

		expect(assessment).toMatchObject({
			usdaLookupStatus: "exact-match",
			openFoodFactsLookupStatus: "exact-match",
			externalLookupFailed: false,
			mergedDraft: {
				source: "usda",
				ingredients: "Tomatoes, onions",
				allergens: ["milk"],
				image: { source: "open-food-facts" },
			},
		});
		expect(assessment.mergedDraft?.nutrients).toHaveLength(1);
	});

	it("retains a successful source when another source fails", async () => {
		const assessment = await assessCatalogProductSources(
			supabase,
			"00021130493609",
			{
				usda: vi.fn().mockRejectedValue(new Error("Unavailable")),
				openFoodFacts: vi.fn().mockResolvedValue(makeDraft("open-food-facts")),
				resolveCategory,
			},
		);

		expect(assessment).toMatchObject({
			usdaLookupStatus: "error",
			openFoodFactsLookupStatus: "exact-match",
			externalLookupFailed: true,
			mergedDraft: { source: "open-food-facts" },
		});
	});
});
