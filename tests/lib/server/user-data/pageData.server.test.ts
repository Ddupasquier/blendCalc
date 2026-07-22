import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
	readCloudCustomFoods: vi.fn(),
	readCloudMixPreferences: vi.fn(),
	readCloudSavedDrinks: vi.fn(),
	readCloudSmoothieList: vi.fn(),
	readCloudSmoothieListIndex: vi.fn(),
	readCloudSmoothieListPage: vi.fn(),
}));
const provenance = vi.hoisted(() => ({
	readIngredientProvenanceOptions: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => storage);
vi.mock("$lib/utils/ingredients/ingredientProvenance", () => provenance);

import {
	loadIngredientPageData,
	loadMixPageData,
	loadSavedPageData,
} from "$lib/server/user-data/pageData.server";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const context = {
	supabase: {} as never,
	userId: "user-1",
};
const listIndex = {
	[MIX_STORAGE_KEYS.fridge]: { foodIds: [1], foodIdentityKeys: ["fdc:1"] },
	[MIX_STORAGE_KEYS.shoppingList]: {
		foodIds: [2],
		foodIdentityKeys: ["fdc:2"],
	},
};

describe("server-loaded user page data", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		storage.readCloudSmoothieListPage
			.mockResolvedValueOnce({ foods: [{ fdcId: 1 }], totalCount: 1 })
			.mockResolvedValueOnce({ foods: [{ fdcId: 2 }], totalCount: 1 });
		storage.readCloudCustomFoods.mockResolvedValue([{ fdcId: -1 }]);
		storage.readCloudSmoothieListIndex.mockResolvedValue(listIndex);
		storage.readCloudSmoothieList.mockImplementation(async (key: string) =>
			key === MIX_STORAGE_KEYS.fridge ? [{ fdcId: 1 }] : [{ fdcId: 2 }],
		);
		storage.readCloudMixPreferences.mockResolvedValue({
			nutrientGoals: { 1008: 2000 },
			mixState: {},
		});
		storage.readCloudSavedDrinks.mockResolvedValue([{ id: "drink-1" }]);
		provenance.readIngredientProvenanceOptions.mockResolvedValue([
			{ dimension: "trust", value: "source-verified" },
		]);
	});

	it("loads the Ingredients page through one server coordinator", async () => {
		const result = await loadIngredientPageData(context);

		expect(result.fridge.totalCount).toBe(1);
		expect(result.shoppingList.totalCount).toBe(1);
		expect(result.customFoods).toEqual([{ fdcId: -1 }]);
		expect(result.listIndex).toEqual(listIndex);
		expect(result.loadError).toBe("");
		expect(storage.readCloudSmoothieListPage).toHaveBeenCalledTimes(2);
	});

	it("loads Mix lists and preferences together on the server", async () => {
		const result = await loadMixPageData(context);

		expect(result.fridge).toEqual([{ fdcId: 1 }]);
		expect(result.shoppingList).toEqual([{ fdcId: 2 }]);
		expect(result.preferences.nutrientGoals).toEqual({ 1008: 2000 });
		expect(result.loadError).toBe("");
	});

	it("loads Saved data before rendering the page", async () => {
		const result = await loadSavedPageData(context);

		expect(result.drinks).toEqual([{ id: "drink-1" }]);
		expect(result.loadError).toBe("");
	});

	it("returns an honest empty error state instead of stale browser data", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		storage.readCloudSavedDrinks.mockRejectedValueOnce(new Error("offline"));

		await expect(loadSavedPageData(context)).resolves.toEqual({
			drinks: [],
			loadError: "Your saved drinks could not be loaded. Try again.",
		});
	});
});
