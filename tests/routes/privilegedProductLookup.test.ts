import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	admin: { source: "admin" },
	requireModeratorApiAccess: vi.fn(),
	getSupabaseAdminClient: vi.fn(),
	getSharedProductByBarcode: vi.fn(),
	searchApprovedSharedProducts: vi.fn(),
	lookupUsdaBarcodeProduct: vi.fn(),
	lookupOpenFoodFactsBarcodeProduct: vi.fn(),
	getProductReferenceCatalog: vi.fn(),
	searchUsdaBrandedFoods: vi.fn(),
	searchUsdaFoods: vi.fn(),
	createCatalogFoodFromDraft: vi.fn(),
}));

vi.mock("$lib/server/moderation/moderationAccess.server", () => ({
	requireModeratorApiAccess: mocks.requireModeratorApiAccess,
}));
vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: mocks.getSupabaseAdminClient,
}));
vi.mock("$lib/server/products/catalog.server", () => ({
	getSharedProductByBarcode: mocks.getSharedProductByBarcode,
	searchApprovedSharedProducts: mocks.searchApprovedSharedProducts,
}));
vi.mock("$lib/server/products/externalProduct.server", () => ({
	lookupUsdaBarcodeProduct: mocks.lookupUsdaBarcodeProduct,
	lookupOpenFoodFactsBarcodeProduct: mocks.lookupOpenFoodFactsBarcodeProduct,
}));
vi.mock("$lib/server/products/productReferenceCatalog.server", () => ({
	getProductReferenceCatalog: mocks.getProductReferenceCatalog,
}));
vi.mock("$lib/server/products/usdaCache.server", () => ({
	searchUsdaBrandedFoods: mocks.searchUsdaBrandedFoods,
	searchUsdaFoods: mocks.searchUsdaFoods,
}));
vi.mock("$lib/server/products/catalogFood.server", () => ({
	createCatalogFoodFromDraft: mocks.createCatalogFoodFromDraft,
}));

import { GET } from "../../src/routes/api/moderation/product-lookup/+server";

const storedFood = {
	fdcId: 1,
	description: "Stored product",
	foodNutrients: [],
	sharedProductId: "product-id",
};

describe("privileged product lookup route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getSupabaseAdminClient.mockReturnValue(mocks.admin);
		mocks.requireModeratorApiAccess.mockResolvedValue({
			user: { id: "moderator" },
			role: "moderator",
		});
		mocks.getSharedProductByBarcode.mockResolvedValue(null);
		mocks.searchApprovedSharedProducts.mockResolvedValue([]);
		mocks.searchUsdaBrandedFoods.mockResolvedValue({ foods: [] });
		mocks.searchUsdaFoods.mockResolvedValue([]);
		mocks.lookupUsdaBarcodeProduct.mockResolvedValue(null);
		mocks.lookupOpenFoodFactsBarcodeProduct.mockResolvedValue(null);
		mocks.getProductReferenceCatalog.mockResolvedValue({ sources: [] });
	});

	it("requires privileged API access and returns only active stored catalog search results", async () => {
		mocks.searchApprovedSharedProducts.mockResolvedValue([storedFood]);
		const response = await GET({
			locals: {},
			url: new URL(
				"http://localhost/api/moderation/product-lookup?scope=stored&q=yogurt",
			),
		} as never);
		const body = await response.json();

		expect(mocks.requireModeratorApiAccess).toHaveBeenCalledOnce();
		expect(mocks.searchApprovedSharedProducts).toHaveBeenCalledWith(
			mocks.admin,
			"yogurt",
		);
		expect(body.results).toEqual([
			expect.objectContaining({
				id: "stored:product-id",
				scope: "stored",
				food: storedFood,
			}),
		]);
	});

	it("queries provider adapters separately for an exact UPC", async () => {
		const usdaDraft = {
			source: "usda",
			sourceLabel: "USDA FoodData Central",
			sourceReference: "123",
			barcode: "00076808006568",
		};
		const offDraft = {
			source: "open-food-facts",
			sourceLabel: "Open Food Facts",
			sourceReference: "00076808006568",
			barcode: "00076808006568",
		};
		mocks.lookupUsdaBarcodeProduct.mockResolvedValue(usdaDraft);
		mocks.lookupOpenFoodFactsBarcodeProduct.mockResolvedValue(offDraft);
		mocks.createCatalogFoodFromDraft
			.mockReturnValueOnce({ ...storedFood, fdcId: 123 })
			.mockReturnValueOnce({ ...storedFood, fdcId: -1 });

		const response = await GET({
			locals: {},
			url: new URL(
				"http://localhost/api/moderation/product-lookup?scope=live&q=076808006568",
			),
		} as never);
		const body = await response.json();

		expect(mocks.lookupUsdaBarcodeProduct).toHaveBeenCalledWith(
			"00076808006568",
			{ sources: [] },
		);
		expect(mocks.lookupOpenFoodFactsBarcodeProduct).toHaveBeenCalledWith(
			"00076808006568",
			{ sources: [] },
		);
		expect(body.results).toHaveLength(2);
		expect(
			body.results.map((result: { providerKey: string }) => result.providerKey),
		).toEqual(["usda", "open-food-facts"]);
	});

	it("uses the branded USDA provider search for live name lookups", async () => {
		mocks.searchUsdaBrandedFoods.mockResolvedValue({
			foods: [
				{
					fdcId: 42,
					description: "Provider yogurt",
					dataType: "Branded",
					foodNutrients: [],
				},
			],
		});

		const response = await GET({
			locals: {},
			url: new URL(
				"http://localhost/api/moderation/product-lookup?scope=live&q=yogurt",
			),
		} as never);
		const body = await response.json();

		expect(mocks.searchUsdaBrandedFoods).toHaveBeenCalledWith("yogurt");
		expect(mocks.searchUsdaFoods).not.toHaveBeenCalled();
		expect(body.results).toEqual([
			expect.objectContaining({
				id: "live:usda:42",
				providerLabel: "USDA FoodData Central",
			}),
		]);
	});
});
