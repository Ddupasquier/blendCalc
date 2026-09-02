import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CloudDataContext } from "$lib/utils/storage/supabase";

const storage = vi.hoisted(() => ({
	readCloudCustomFoods: vi.fn(),
	readCloudIngredientListIndex: vi.fn(),
}));
const provenance = vi.hoisted(() => ({
	readIngredientProvenanceOptions: vi.fn(),
}));
const foodSafety = vi.hoisted(() => ({
	annotateFoodsWithFoodSafety: vi.fn(),
	getUserFoodSafetyContext: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => storage);
vi.mock("$lib/utils/ingredients/ingredientProvenance", () => provenance);
vi.mock("$lib/server/food-safety/foodSafetyEvaluation.server", () => ({
	annotateFoodsWithFoodSafety: foodSafety.annotateFoodsWithFoodSafety,
}));
vi.mock("$lib/server/food-safety/userFoodSafety.server", () => ({
	getUserFoodSafetyContext: foodSafety.getUserFoodSafetyContext,
}));

import { readIngredientPageSupportingData } from "$lib/server/user-data/ingredientPageSupportingData.server";

describe("readIngredientPageSupportingData", () => {
	const context = {
		supabase: { name: "client" },
		userId: "user-1",
	} as unknown as CloudDataContext;

	beforeEach(() => {
		vi.clearAllMocks();
		storage.readCloudCustomFoods.mockResolvedValue([{ fdcId: -1 }]);
		storage.readCloudIngredientListIndex.mockResolvedValue({
			fridge: { foodIds: [-1], foodIdentityKeys: ["custom:-1"] },
			shoppingList: { foodIds: [], foodIdentityKeys: [] },
		});
		provenance.readIngredientProvenanceOptions.mockResolvedValue([
			{ dimension: "trust", value: "source-verified" },
		]);
		foodSafety.getUserFoodSafetyContext.mockResolvedValue({ policy: {} });
		foodSafety.annotateFoodsWithFoodSafety.mockReturnValue([
			{ fdcId: -1, foodSafety: { status: "unknown" } },
		]);
	});

	it("returns current safety annotations with deferred list metadata", async () => {
		const result = await readIngredientPageSupportingData(context);

		expect(storage.readCloudCustomFoods).toHaveBeenCalledWith(context);
		expect(storage.readCloudIngredientListIndex).toHaveBeenCalledWith(context);
		expect(provenance.readIngredientProvenanceOptions).toHaveBeenCalledWith(
			context.supabase,
		);
		expect(foodSafety.getUserFoodSafetyContext).toHaveBeenCalledWith(
			context.supabase,
			"user-1",
		);
		expect(result.customFoods[0]).toMatchObject({
			foodSafety: { status: "unknown" },
		});
	});

	it("fails closed when any supporting dataset is unavailable", async () => {
		storage.readCloudIngredientListIndex.mockResolvedValue(null);

		await expect(readIngredientPageSupportingData(context)).rejects.toThrow(
			"Ingredient supporting data was unavailable",
		);
	});
});
