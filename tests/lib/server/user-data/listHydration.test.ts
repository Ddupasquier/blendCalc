import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";

const mocks = vi.hoisted(() => ({
	readNormalizedNutrientsByParent: vi.fn(),
	readFoodServingsByParent: vi.fn(),
	hydrateFoodsWithCachedImages: vi.fn(),
	readSelectedCatalogFieldProvenance: vi.fn(),
	getSupabaseAdminClient: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase/normalizedNutrients", () => ({
	readNormalizedNutrientsByParent: mocks.readNormalizedNutrientsByParent,
}));
vi.mock("$lib/utils/storage/supabase/servings", () => ({
	readFoodServingsByParent: mocks.readFoodServingsByParent,
}));
vi.mock("$lib/utils/storage/supabase/foodImages", () => ({
	hydrateFoodsWithCachedImages: mocks.hydrateFoodsWithCachedImages,
}));
vi.mock("$lib/server/products/catalogFieldProvenance.server", async (importOriginal) => {
	const original = await importOriginal<
		typeof import("$lib/server/products/catalogFieldProvenance.server")
	>();
	return {
		...original,
		readSelectedCatalogFieldProvenance:
			mocks.readSelectedCatalogFieldProvenance,
	};
});
vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));

import { hydrateCloudFoodListRows } from "$lib/server/user-data/listHydration.server";

const listItemId = "91000000-0000-4000-8000-000000000001";
const sharedProductId = "81000000-0000-4000-8000-000000000011";

describe("cloud food-list hydration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readNormalizedNutrientsByParent.mockResolvedValue(new Map([
			[listItemId, [
				{
					nutrientId: 1008,
					nutrientName: "Energy",
					nutrientNumber: "208",
					unitName: "KCAL",
					value: 48,
					valueOrigin: "reported",
					source: "usda",
					sourceReference: "2032704",
					confidence: "source-verified",
					valueStatus: "reported",
					standardError: null,
					sourceNutrientKey: "1008",
					sourceNutrientCode: "208",
					mappingStatus: "canonical",
					mappingMethod: null,
					mappingReviewReference: null,
					derivationMethod: null,
				},
				{
					nutrientId: 1079,
					nutrientName: "Fiber, total dietary",
					nutrientNumber: "291",
					unitName: "G",
					value: 1.6,
					valueOrigin: "reported",
					source: "usda",
					sourceReference: "2032704",
					confidence: "source-verified",
					valueStatus: "reported",
					standardError: null,
					sourceNutrientKey: "1079",
					sourceNutrientCode: "291",
					mappingStatus: "canonical",
					mappingMethod: null,
					mappingReviewReference: null,
					derivationMethod: null,
				},
			]],
		]));
		mocks.readFoodServingsByParent.mockResolvedValue(new Map([
			[listItemId, [{
				servingOrder: 0,
				label: "1/2 cup",
				gramWeight: 125,
				amount: 0.5,
				unitKey: "cup",
				isPrimary: true,
				measureType: "Package serving",
				isHouseholdMeasure: true,
				sourceMeasureKey: "usda:2032704:serving",
				origin: "package-label",
				gramWeightMethod: "source-reported",
				calculationBasis: null,
				source: "usda",
				sourceReference: "2032704",
				confidence: "source-verified",
			}]],
		]));
		mocks.hydrateFoodsWithCachedImages.mockImplementation(
			async (_supabase: unknown, foods: FoodItem[]) => foods.map((food) => ({
				...food,
				image: {
					source: "open-food-facts" as const,
					sourceReference: "021130493609",
					role: "front" as const,
					imageUrl: "https://example.com/pasta-sauce.jpg",
					licenseName: "CC BY-SA 3.0",
					licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
					attributionText: "Open Food Facts contributors",
					confidence: "imported" as const,
				},
			})),
		);
		mocks.readSelectedCatalogFieldProvenance.mockResolvedValue(new Map([
			[sharedProductId, {
				nutrition: {
					observationId: "82000000-0000-4000-8000-000000000001",
					source: "usda",
					sourceReference: "2032704",
					confidence: "source-verified",
					observedAt: "2026-08-01T00:00:00.000Z",
					verificationMethod: "exact-barcode",
					reviewState: "accepted",
				},
				categories: {
					observationId: "82000000-0000-4000-8000-000000000001",
					source: "usda",
					sourceReference: "2032704",
					confidence: "source-verified",
					observedAt: "2026-08-01T00:00:00.000Z",
					verificationMethod: "exact-barcode",
					reviewState: "accepted",
				},
				serving: {
					observationId: "82000000-0000-4000-8000-000000000001",
					source: "usda",
					sourceReference: "2032704",
					confidence: "source-verified",
					observedAt: "2026-08-01T00:00:00.000Z",
					verificationMethod: "exact-barcode",
					reviewState: "accepted",
				},
				image: {
					observationId: "82000000-0000-4000-8000-000000000002",
					source: "open-food-facts",
					sourceReference: "021130493609",
					confidence: "imported",
					observedAt: "2026-08-01T00:00:00.000Z",
					verificationMethod: "exact-barcode",
					reviewState: "accepted",
				},
			}],
		]));
	});

	it("reconstructs canonical field sources after a list reload", async () => {
		const staleSnapshot: FoodItem = {
			fdcId: 2032704,
			description: "Roasted Onion & Garlic Pasta Sauce",
			barcode: "00021130493609",
			foodCategory: "Old category",
			foodNutrients: [],
			fieldProvenance: {
				nutrition: { source: "open-food-facts" },
			},
		};
		const sharedProductFood: FoodItem = {
			...staleSnapshot,
			foodCategory: "Dips And Salsa",
			categories: ["Dips And Salsa"],
			sourceLabel: "USDA FoodData Central",
			sourceDataType: "Branded",
		};
		const supabase = {
			from: vi.fn((table: string) => {
				expect(table).toBe("shared_products");
				return {
					select: vi.fn(() => ({
						in: vi.fn(async () => ({
							data: [{
								id: sharedProductId,
								food: sharedProductFood,
								compatibility_summary: null,
							}],
							error: null,
						})),
					})),
				};
			}),
		};
		const catalogSupabase = { from: vi.fn() };

		const rows = [{
			id: listItemId,
			food: staleSnapshot as never,
			created_at: "2026-08-01T00:00:00.000Z",
			shared_product_id: sharedProductId,
			shared_product_submission_id: null,
			source_key: "shared-catalog",
			trust_status: "source-verified",
		}];
		const [food] = await hydrateCloudFoodListRows(
			supabase as never,
			rows,
			catalogSupabase as never,
		);

		expect(mocks.readSelectedCatalogFieldProvenance)
			.toHaveBeenCalledWith(catalogSupabase, [sharedProductId]);

		expect(food.foodCategory).toBe("Dips And Salsa");
		expect(food.foodNutrients).toEqual(expect.arrayContaining([
			expect.objectContaining({
				nutrientId: 1079,
				value: 1.6,
				source: "usda",
				sourceReference: "2032704",
			}),
		]));
		expect(food.foodServings).toEqual([
			expect.objectContaining({
				label: "1/2 cup",
				gramWeight: 125,
				source: "usda",
				sourceReference: "2032704",
			}),
		]);
		expect(food.image).toMatchObject({
			source: "open-food-facts",
			sourceReference: "021130493609",
		});
		expect(food.fieldProvenance).toEqual({
			nutrition: expect.objectContaining({
				source: "usda",
				sourceReference: "2032704",
				observationId: "82000000-0000-4000-8000-000000000001",
				observedAt: "2026-08-01T00:00:00.000Z",
				verificationMethod: "exact-barcode",
				reviewState: "accepted",
			}),
			categories: expect.objectContaining({
				source: "usda",
				sourceReference: "2032704",
			}),
			serving: expect.objectContaining({
				source: "usda",
				sourceReference: "2032704",
			}),
			image: expect.objectContaining({
				source: "open-food-facts",
				sourceReference: "021130493609",
			}),
		});

		mocks.getSupabaseAdminClient.mockReturnValue(catalogSupabase);
		await hydrateCloudFoodListRows(supabase as never, rows);
		expect(mocks.getSupabaseAdminClient).toHaveBeenCalledOnce();
		expect(mocks.readSelectedCatalogFieldProvenance)
			.toHaveBeenLastCalledWith(catalogSupabase, [sharedProductId]);
	});
});
