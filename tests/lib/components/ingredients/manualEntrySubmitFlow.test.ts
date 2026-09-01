import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	saveCustomFood: vi.fn(),
	findCustomFoodByBarcode: vi.fn(),
	findCustomFoodByName: vi.fn(),
	submitSharedProduct: vi.fn(),
	notifyIngredientListsChanged: vi.fn(),
}));

vi.mock("$lib/utils/food/custom/customFoods", () => ({
	saveCustomFood: mocks.saveCustomFood,
	findCustomFoodByBarcode: mocks.findCustomFoodByBarcode,
	findCustomFoodByName: mocks.findCustomFoodByName,
}));

vi.mock("$lib/utils/products/catalog", () => ({
	submitSharedProduct: mocks.submitSharedProduct,
}));

vi.mock("$lib/utils/storage/client/ingredientLists", () => ({
	notifyIngredientListsChanged: mocks.notifyIngredientListsChanged,
}));

import { saveManualEntryCustomFood } from "$lib/components/ingredients/manual-entry/utils/submitFlow";
import { createUserFacingIssueError } from "$lib/utils/errors/userFacingErrors";
import type { FoodItem } from "$lib/utils/food/types";

const food: FoodItem = {
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
			catalogMessageTone: "success",
			resetForm: true,
		});
		expect(mocks.saveCustomFood).toHaveBeenCalledOnce();
		expect(useIngredient).toHaveBeenCalledOnce();
		expect(useIngredient).toHaveBeenCalledWith(food);
		expect(mocks.submitSharedProduct).not.toHaveBeenCalled();
		expect(mocks.notifyIngredientListsChanged).not.toHaveBeenCalled();
	});

	it("keeps optional image evidence private without explicit sharing", async () => {
		const useIngredient = vi.fn().mockResolvedValue(true);
		const frontPhoto = new File(
			[new Uint8Array([0xff, 0xd8, 0xff])],
			"front.jpg",
			{
				type: "image/jpeg",
			},
		);
		const imageEvidence = { ...photos, frontPhoto };
		const result = await saveManualEntryCustomFood({
			food,
			name: food.description,
			normalizedBarcode: food.barcode ?? null,
			shareWithCatalog: false,
			photos: imageEvidence,
			reviewFlags: ["Review this optional product image."],
			useIngredient,
		});

		expect(result).toEqual({
			status: "complete",
			catalogMessage: "",
			catalogMessageTone: "success",
			resetForm: true,
		});
		expect(mocks.saveCustomFood).toHaveBeenCalledOnce();
		expect(useIngredient).toHaveBeenCalledWith(food);
		expect(mocks.submitSharedProduct).not.toHaveBeenCalled();
		expect(mocks.notifyIngredientListsChanged).not.toHaveBeenCalled();
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
			catalogMessageTone: "success",
			resetForm: true,
		});
		expect(mocks.saveCustomFood).toHaveBeenCalledOnce();
		expect(useIngredient).toHaveBeenCalledOnce();
		expect(mocks.submitSharedProduct).toHaveBeenCalledOnce();
		expect(mocks.submitSharedProduct).toHaveBeenCalledWith(food, photos, {
			consentToShare: true,
			reviewFlags: [],
			intent: "catalog_share",
		});
		expect(mocks.notifyIngredientListsChanged).toHaveBeenCalledOnce();
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
		expect(mocks.notifyIngredientListsChanged).not.toHaveBeenCalled();
	});

	it("keeps a suspended account's ingredient private and explains why sharing stopped", async () => {
		const useIngredient = vi.fn().mockResolvedValue(true);
		mocks.submitSharedProduct.mockRejectedValue(
			createUserFacingIssueError("CATALOG_SUBMISSION_BLOCKED", {
				blockedUntil: "Feb 10, 2027",
			}),
		);

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
			catalogMessage:
				"Product sharing is paused for this account until Feb 10, 2027. You can still save ingredients to your own profile.",
			catalogMessageTone: "warning",
			resetForm: true,
		});
		expect(mocks.saveCustomFood).toHaveBeenCalledOnce();
		expect(useIngredient).toHaveBeenCalledOnce();
		expect(mocks.submitSharedProduct).toHaveBeenCalledOnce();
		expect(mocks.notifyIngredientListsChanged).not.toHaveBeenCalled();
	});
});
