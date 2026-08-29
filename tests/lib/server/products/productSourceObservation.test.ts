import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BarcodeProductDraft } from "$lib/utils/barcode/productLookup";

const mocks = vi.hoisted(() => ({
	maybeSingle: vi.fn(),
	insert: vi.fn(),
	createCatalogFoodFromDraft: vi.fn(),
}));

vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: () => ({
		from: () => ({
			select: () => ({
				eq: () => ({
					eq: () => ({
						eq: () => ({ maybeSingle: mocks.maybeSingle }),
					}),
				}),
			}),
			insert: mocks.insert,
		}),
	}),
}));
vi.mock("$lib/server/runtime/backgroundTask.server", () => ({
	completeServerBackgroundTask: async (task: Promise<unknown>) => await task,
}));
vi.mock("$lib/server/products/catalogFood.server", () => ({
	createCatalogFoodFromDraft: mocks.createCatalogFoodFromDraft,
}));
vi.mock("$lib/utils/food/records/foodRecords", () => ({
	normalizeFoodForStorage: (food: unknown) => food,
}));

import { persistLegallyStorableExactProductObservation } from "$lib/server/products/productSourceObservation.server";

const draft = {
	barcode: "00021130493609",
	name: "Roasted Onion Sauce",
	nameProvenance: "source",
	brandOwner: "",
	servingLabel: "",
	servingWeightGrams: 0,
	hasSourceServing: false,
	nutrients: [],
	reportedNutrientIds: [],
	categories: [],
	source: "usda",
	sourceLabel: "USDA FoodData Central",
	sourceReference: "2658692",
	fieldProvenance: {},
} satisfies BarcodeProductDraft;

describe("exact provider observation persistence", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
		mocks.insert.mockResolvedValue({ error: null });
		mocks.createCatalogFoodFromDraft.mockReturnValue({
			fdcId: 2658692,
			description: draft.name,
			dataType: "Shared Product",
			foodNutrients: [],
		});
	});

	it("stores a normalized immutable observation when source policy permits it", async () => {
		await persistLegallyStorableExactProductObservation({
			draft,
			providerKey: "usda",
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

		expect(mocks.insert).toHaveBeenCalledWith(
			expect.objectContaining({
				barcode: draft.barcode,
				source: "usda",
				source_license: "CC0-1.0",
				content_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
			}),
		);
	});

	it("does not retain a provider response without reviewed storage rights", async () => {
		await persistLegallyStorableExactProductObservation({
			draft: { ...draft, source: "cola-cloud" },
			providerKey: "cola-cloud",
			productReferenceCatalog: {
				sources: {
					"cola-cloud": {
						key: "cola-cloud",
						displayName: "COLA Cloud",
						attributionText: null,
						canonicalStorageAllowed: false,
						canonicalLicenseName: null,
					},
				},
				nutrientMappings: [],
				nutrientConversions: [],
				nutrientEquivalences: [],
			},
		});

		expect(mocks.maybeSingle).not.toHaveBeenCalled();
		expect(mocks.insert).not.toHaveBeenCalled();
	});
});
