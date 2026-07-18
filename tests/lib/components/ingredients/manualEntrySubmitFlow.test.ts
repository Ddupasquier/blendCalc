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
	description: "Imported test product",
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
		await saveManualEntryCustomFood({
			food,
			name: food.description,
			normalizedBarcode: "00021130462506",
			shareWithCatalog: false,
			photos,
			reviewFlags: [],
			useIngredient: vi.fn().mockResolvedValue(true),
		});

		expect(mocks.submitSharedProduct).not.toHaveBeenCalled();
		expect(mocks.notifySmoothieListsChanged).not.toHaveBeenCalled();
	});

	it("submits only after the user explicitly enables sharing", async () => {
		await saveManualEntryCustomFood({
			food,
			name: food.description,
			normalizedBarcode: "00021130462506",
			shareWithCatalog: true,
			photos,
			reviewFlags: [],
			useIngredient: vi.fn().mockResolvedValue(true),
		});

		expect(mocks.submitSharedProduct).toHaveBeenCalledOnce();
		expect(mocks.notifySmoothieListsChanged).toHaveBeenCalledOnce();
	});
});
