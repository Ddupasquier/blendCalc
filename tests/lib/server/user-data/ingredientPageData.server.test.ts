import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const cloudStorage = vi.hoisted(() => ({
	readCloudCustomFoodByFdcId: vi.fn(),
	readCloudCustomFoods: vi.fn(),
	readCloudIngredientListIndex: vi.fn(),
}));
const ingredientLists = vi.hoisted(() => ({
	readCloudIngredientListCount: vi.fn(),
	readCloudIngredientListFood: vi.fn(),
	readCloudIngredientListPage: vi.fn(),
}));
const productCatalog = vi.hoisted(() => ({
	getApprovedCatalogRecordByApplicationFoodId: vi.fn(),
}));
const catalogRecordMetadata = vi.hoisted(() => ({
	readCanonicalFoodCatalogMetadata: vi.fn(),
}));
const genericFoods = vi.hoisted(() => ({
	readGenericFoodByApplicationId: vi.fn(),
}));
const supabaseAdmin = vi.hoisted(() => ({
	client: { role: "service" },
	getSupabaseAdminClient: vi.fn(),
}));
const ingredientProvenance = vi.hoisted(() => ({
	readIngredientProvenanceOptions: vi.fn(),
}));
const foodSafety = vi.hoisted(() => ({
	annotateFoodsWithFoodSafety: vi.fn((foods) => foods),
	getUserFoodSafetyContext: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudStorage);
vi.mock("$lib/server/user-data/foodLists.server", () => ingredientLists);
vi.mock("$lib/server/products/catalogRead.server", () => productCatalog);
vi.mock(
	"$lib/server/products/catalogRecordMetadata.server",
	() => catalogRecordMetadata,
);
vi.mock("$lib/server/products/genericFoods.server", () => genericFoods);
vi.mock("$lib/supabase/admin.server", () => ({
	getSupabaseAdminClient: supabaseAdmin.getSupabaseAdminClient,
}));
vi.mock(
	"$lib/utils/ingredients/ingredientProvenance",
	() => ingredientProvenance,
);
vi.mock("$lib/server/food-safety/foodSafetyEvaluation.server", () => ({
	annotateFoodsWithFoodSafety: foodSafety.annotateFoodsWithFoodSafety,
}));
vi.mock("$lib/server/food-safety/userFoodSafety.server", () => ({
	getUserFoodSafetyContext: foodSafety.getUserFoodSafetyContext,
}));

import { loadIngredientPageData } from "$lib/server/user-data/ingredientPageData.server";

const cloudDataContext = {
	supabase: {} as never,
	userId: "user-1",
};
const ingredientListIndex = {
	[MIX_STORAGE_KEYS.fridge]: { foodIds: [1], foodIdentityKeys: ["fdc:1"] },
	[MIX_STORAGE_KEYS.shoppingList]: {
		foodIds: [2],
		foodIdentityKeys: ["fdc:2"],
	},
};

describe("loadIngredientPageData", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		ingredientLists.readCloudIngredientListPage.mockResolvedValueOnce({
			foods: [{ fdcId: 1 }],
			totalCount: 1,
		});
		ingredientLists.readCloudIngredientListCount.mockResolvedValue(1);
		cloudStorage.readCloudCustomFoods.mockResolvedValue([{ fdcId: -1 }]);
		cloudStorage.readCloudCustomFoodByFdcId.mockResolvedValue(null);
		cloudStorage.readCloudIngredientListIndex.mockResolvedValue(
			ingredientListIndex,
		);
		ingredientLists.readCloudIngredientListFood.mockResolvedValue(null);
		productCatalog.getApprovedCatalogRecordByApplicationFoodId.mockResolvedValue(
			null,
		);
		catalogRecordMetadata.readCanonicalFoodCatalogMetadata.mockResolvedValue(
			null,
		);
		genericFoods.readGenericFoodByApplicationId.mockResolvedValue(null);
		supabaseAdmin.getSupabaseAdminClient.mockReturnValue(supabaseAdmin.client);
		ingredientProvenance.readIngredientProvenanceOptions.mockResolvedValue([
			{ dimension: "trust", value: "source-verified" },
		]);
		foodSafety.getUserFoodSafetyContext.mockResolvedValue({
			profile: null,
			policy: {
				version: 1,
				reviewedAt: "2026-07-29T00:00:00.000Z",
				preferenceConflictRules: [],
				compatibilityMatchRules: [],
				regionalProfiles: [],
			},
		});
	});

	it("adds current catalog history only to a routed shared food", async () => {
		ingredientLists.readCloudIngredientListFood.mockResolvedValueOnce({
			fdcId: 99,
			description: "Shared Routed Food",
			sharedProductId: "shared-product-1",
		});
		catalogRecordMetadata.readCanonicalFoodCatalogMetadata.mockResolvedValueOnce(
			{
				recordCreatedAt: "2026-07-01T00:00:00.000Z",
				recordUpdatedAt: "2026-08-10T00:00:00.000Z",
				lastVerifiedAt: "2026-08-11T00:00:00.000Z",
				currentRevisionNumber: 3,
			},
		);

		const result = await loadIngredientPageData(cloudDataContext, {
			routeFoodId: 99,
			routeListKey: MIX_STORAGE_KEYS.fridge,
		});

		expect(
			catalogRecordMetadata.readCanonicalFoodCatalogMetadata,
		).toHaveBeenCalledWith(supabaseAdmin.client, "shared-product-1");
		expect(result.routeFood?.canonicalCatalogMetadata).toMatchObject({
			currentRevisionNumber: 3,
			lastVerifiedAt: "2026-08-11T00:00:00.000Z",
		});
	});

	it("loads only the visible list while preserving the deferred list count", async () => {
		const result = await loadIngredientPageData(cloudDataContext);

		expect(result.fridge.totalCount).toBe(1);
		expect(result.shoppingList).toEqual({ foods: [], totalCount: 1 });
		expect(result.customFoods).toEqual([]);
		expect(result.routeFood).toBeNull();
		expect(result.listIndex).toEqual({
			[MIX_STORAGE_KEYS.fridge]: {
				foodIds: [1],
				foodIdentityKeys: ["fdc:1"],
			},
			[MIX_STORAGE_KEYS.shoppingList]: {
				foodIds: [],
				foodIdentityKeys: [],
			},
		});
		expect(result.initialListKey).toBe(MIX_STORAGE_KEYS.fridge);
		expect(result.deferredDataPending).toBe(true);
		expect(result.loadError).toBe("");
		expect(ingredientLists.readCloudIngredientListPage).toHaveBeenCalledTimes(
			1,
		);
		expect(ingredientLists.readCloudIngredientListCount).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.shoppingList,
			cloudDataContext,
		);
		expect(cloudStorage.readCloudCustomFoods).not.toHaveBeenCalled();
		expect(cloudStorage.readCloudIngredientListIndex).not.toHaveBeenCalled();
		expect(
			ingredientProvenance.readIngredientProvenanceOptions,
		).not.toHaveBeenCalled();
	});

	it("loads a routed food directly from its requested ingredient list", async () => {
		ingredientLists.readCloudIngredientListFood.mockResolvedValueOnce({
			fdcId: 99,
			description: "Original Routed Food",
		});

		const result = await loadIngredientPageData(cloudDataContext, {
			routeFoodId: 99,
			routeListKey: MIX_STORAGE_KEYS.fridge,
		});

		expect(result.routeFood).toMatchObject({
			fdcId: 99,
			description: "Original Routed Food",
		});
		expect(ingredientLists.readCloudIngredientListFood).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			99,
			cloudDataContext,
		);
		expect(
			productCatalog.getApprovedCatalogRecordByApplicationFoodId,
		).not.toHaveBeenCalled();
	});

	it("uses the approved catalog and generic-food readers for public routed foods", async () => {
		productCatalog.getApprovedCatalogRecordByApplicationFoodId.mockResolvedValueOnce(
			{
				food: { fdcId: 99, description: "Catalog Routed Food" },
			},
		);

		const result = await loadIngredientPageData(cloudDataContext, {
			routeFoodId: 99,
			routeListKey: MIX_STORAGE_KEYS.fridge,
		});

		expect(result.routeFood).toMatchObject({
			fdcId: 99,
			description: "Catalog Routed Food",
		});
		expect(
			productCatalog.getApprovedCatalogRecordByApplicationFoodId,
		).toHaveBeenCalledWith(supabaseAdmin.client, 99);
		expect(genericFoods.readGenericFoodByApplicationId).toHaveBeenCalledWith(
			supabaseAdmin.client,
			99,
		);
	});

	it("reloads a negative application ID from the normalized generic-food catalog", async () => {
		genericFoods.readGenericFoodByApplicationId.mockResolvedValueOnce({
			fdcId: -123,
			description: "Authoritative Generic Food",
		});

		const result = await loadIngredientPageData(cloudDataContext, {
			routeFoodId: -123,
			routeListKey: MIX_STORAGE_KEYS.fridge,
		});

		expect(result.routeFood).toMatchObject({
			fdcId: -123,
			description: "Authoritative Generic Food",
		});
		expect(
			productCatalog.getApprovedCatalogRecordByApplicationFoodId,
		).toHaveBeenCalledWith(supabaseAdmin.client, -123);
		expect(genericFoods.readGenericFoodByApplicationId).toHaveBeenCalledWith(
			supabaseAdmin.client,
			-123,
		);
	});

	it("returns an honest empty state when authenticated ingredient data is unavailable", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		ingredientLists.readCloudIngredientListPage.mockReset();
		ingredientLists.readCloudIngredientListPage.mockRejectedValueOnce(
			new Error("offline"),
		);

		await expect(loadIngredientPageData(cloudDataContext)).resolves.toEqual({
			fridge: { foods: [], totalCount: 0 },
			shoppingList: { foods: [], totalCount: 0 },
			customFoods: [],
			routeFood: null,
			listIndex: {
				[MIX_STORAGE_KEYS.fridge]: {
					foodIds: [],
					foodIdentityKeys: [],
				},
				[MIX_STORAGE_KEYS.shoppingList]: {
					foodIds: [],
					foodIdentityKeys: [],
				},
			},
			provenanceOptions: [],
			initialListKey: MIX_STORAGE_KEYS.fridge,
			deferredDataPending: false,
			loadError: "Saved ingredients could not be loaded. Try again.",
			provenanceError: "",
		});
	});
});
