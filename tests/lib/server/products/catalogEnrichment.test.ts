import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";
import type { FoodItem } from "$lib/utils/food/types";

const mocks = vi.hoisted(() => ({
	rpc: vi.fn(),
	createCatalogFoodFromDraft: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("$lib/server/runtime/backgroundTask.server", () => ({
	completeServerBackgroundTask: async (task: Promise<unknown>) => await task,
}));
vi.mock("$lib/utils/food/records/foodRecords", () => ({
	normalizeFoodForStorage: (food: FoodItem) => food,
}));
vi.mock("$lib/server/products/catalogFood.server", () => ({
	createCatalogFoodFromDraft: mocks.createCatalogFoodFromDraft,
}));

import { persistSharedProductExternalEnrichment } from "$lib/server/products/catalogEnrichment.server";

const currentFood: FoodItem = {
	fdcId: -1,
	description: "Existing Product",
	dataType: "Shared Product",
	foodNutrients: [],
};

const enrichedDraft: BarcodeProductDraft = {
	barcode: "00041570054130",
	name: "Existing Product",
	nameProvenance: "source",
	brandOwner: "Blue Diamond",
	servingLabel: "100 g",
	servingWeightGrams: 100,
	hasSourceServing: false,
	nutrients: [],
	reportedNutrientIds: [],
	categories: [],
	source: "usda",
	sourceLabel: "USDA FoodData Central",
	sourceReference: "2757275",
	fieldProvenance: {
		brandOwner: {
			source: "usda",
			sourceReference: "2757275",
			confidence: "source-verified",
		},
		ingredients: {
			source: "usda",
			sourceReference: "2757275",
			confidence: "source-verified",
		},
	},
};

describe("canonical catalog enrichment persistence", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.createCatalogFoodFromDraft.mockReturnValue({
			...currentFood,
			brandOwner: enrichedDraft.brandOwner,
			ingredients: "Almondmilk ingredients",
		});
		mocks.rpc.mockImplementation(async (name: string) => ({
			data: name === "apply_shared_product_external_enrichment"
				? ["ingredients"]
				: ["brandOwner"],
			error: null,
		}));
	});

	it("routes identity fields through the supplemental RPC and other fields through the standard RPC", async () => {
		await persistSharedProductExternalEnrichment({
			sharedProductId: "shared-product-id",
			barcode: enrichedDraft.barcode,
			currentFood,
			enrichedDraft,
			fields: ["brandOwner", "ingredients"],
			productReferenceCatalog: {
				sources: {
					usda: {
						key: "usda",
						displayName: "USDA FoodData Central",
						attributionText: "USDA FoodData Central",
						canonicalStorageAllowed: true,
						canonicalLicenseName: "CC0-1.0",
					},
				},
				nutrientMappings: [],
				nutrientConversions: [],
				nutrientEquivalences: [],
			},
		});

		expect(mocks.rpc).toHaveBeenCalledTimes(2);
		expect(mocks.rpc).toHaveBeenCalledWith(
			"apply_shared_product_external_enrichment",
			expect.objectContaining({
				p_candidate_fields: ["ingredients"],
			}),
		);
		expect(mocks.rpc).toHaveBeenCalledWith(
			"apply_shared_product_supplemental_enrichment",
			expect.objectContaining({
				p_candidate_fields: ["brandOwner"],
			}),
		);
	});
});
