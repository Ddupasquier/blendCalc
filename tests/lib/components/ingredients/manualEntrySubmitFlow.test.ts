import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	saveCustomFood: vi.fn(),
	findCustomFoodByBarcode: vi.fn(),
	findCustomFoodByName: vi.fn(),
	submitSharedProduct: vi.fn(),
	notifySmoothieListsChanged: vi.fn(),
}));

vi.mock("$lib/utils/food/custom/customFoods", () => ({
	saveCustomFood: mocks.saveCustomFood,
	findCustomFoodByBarcode: mocks.findCustomFoodByBarcode,
	findCustomFoodByName: mocks.findCustomFoodByName,
}));

vi.mock("$lib/utils/products/catalog", () => ({
	submitSharedProduct: mocks.submitSharedProduct,
}));

vi.mock("$lib/utils/storage/client/smoothieLists", () => ({
	notifySmoothieListsChanged: mocks.notifySmoothieListsChanged,
}));

import { saveManualEntryCustomFood } from "$lib/components/ingredients/manual-entry/utils/submitFlow";
import type { FdcFood } from "$lib/utils/food/types";

const food: FdcFood = {
	fdcId: -1,
	description: "Trader Joe's Peanut Butter",
	barcode: "00000000119993",
	barcodeSource: "open-food-facts",
	foodNutrients: [],
};

const photos = {
	frontPhoto: null,
	nutritionPhoto: null,
	barcodePhoto: null,
	frontImageCrop: null,
};

describe("manual entry catalog submission", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.saveCustomFood.mockResolvedValue("saved");
		mocks.submitSharedProduct.mockResolvedValue({ message: "Submitted" });
	});

	it("keeps an Open Food Facts import private without explicit sharing", async () => {
		const useIngredient = vi.fn().mockResolvedValue(true);
		const result = await saveManualEntryCustomFood({
			food,
			name: food.description,
			normalizedBarcode: food.barcode ?? null,
			shareWithCatalog: false,
			photos,
			reviewFlags: [],
			useIngredient,
		});

		expect(result).toEqual({
			status: "complete",
			catalogMessage: "",
			resetForm: true,
		});
		expect(mocks.saveCustomFood).toHaveBeenCalledOnce();
		expect(useIngredient).toHaveBeenCalledOnce();
		expect(useIngredient).toHaveBeenCalledWith(food);
		expect(mocks.submitSharedProduct).not.toHaveBeenCalled();
		expect(mocks.notifySmoothieListsChanged).not.toHaveBeenCalled();
	});

	it("submits only after the user explicitly enables sharing", async () => {
		const useIngredient = vi.fn().mockResolvedValue(true);
		const result = await saveManualEntryCustomFood({
			food,
			name: food.description,
			normalizedBarcode: food.barcode ?? null,
			shareWithCatalog: true,
			photos,
			reviewFlags: [],
			useIngredient,
		});

		expect(result).toEqual({
			status: "complete",
			catalogMessage: "Submitted",
			resetForm: true,
		});
		expect(mocks.saveCustomFood).toHaveBeenCalledOnce();
		expect(useIngredient).toHaveBeenCalledOnce();
		expect(mocks.submitSharedProduct).toHaveBeenCalledOnce();
		expect(mocks.submitSharedProduct).toHaveBeenCalledWith(food, photos, {
			reviewFlags: [],
			intent: "catalog_share",
		});
		expect(mocks.notifySmoothieListsChanged).toHaveBeenCalledOnce();
	});

	it("does not submit when destination placement is cancelled", async () => {
		const useIngredient = vi.fn().mockResolvedValue(false);
		const result = await saveManualEntryCustomFood({
			food,
			name: food.description,
			normalizedBarcode: food.barcode ?? null,
			shareWithCatalog: true,
			photos,
			reviewFlags: [],
			useIngredient,
		});

		expect(result).toEqual({ status: "cancelled" });
		expect(mocks.saveCustomFood).toHaveBeenCalledOnce();
		expect(useIngredient).toHaveBeenCalledOnce();
		expect(mocks.submitSharedProduct).not.toHaveBeenCalled();
		expect(mocks.notifySmoothieListsChanged).not.toHaveBeenCalled();
	});
});
