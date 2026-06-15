import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudData = vi.hoisted(() => ({
	saveCloudCustomFood: vi.fn(),
	writeCloudCustomFoods: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabaseData", () => cloudData);

import {
	CUSTOM_FOODS_STORAGE_KEY,
	createCustomFood,
	readCustomFoods,
	saveCustomFood,
	searchCustomFoods,
} from "$lib/utils/food/customFoods";
import { NUTRIENT_IDS } from "$lib/utils/food/types";
import { getFdcNutrientValue } from "$lib/utils/food/fdcNutrients";

describe("custom foods", () => {
	beforeEach(() => {
		localStorage.removeItem(CUSTOM_FOODS_STORAGE_KEY);
		vi.clearAllMocks();
		cloudData.saveCloudCustomFood.mockResolvedValue("saved");
	});

	it("converts nutrition facts per serving into per-100g nutrients", () => {
		const food = createCustomFood({
			name: "Oreos",
			servingLabel: "3 cookies",
			servingWeightGrams: 34,
			nutrition: {
				calories: 160,
				fat: 7,
				carbs: 25,
				fiber: 1,
				sugar: 14,
				protein: 1,
			},
			additionalNutrients: [
				{
					nutrientId: NUTRIENT_IDS.SODIUM,
					nutrientName: "Sodium, Na",
					nutrientNumber: "307",
					unitName: "MG",
					value: 135,
				},
			],
		});

		expect(food.customFood).toBe(true);
		expect(food.servingSize).toBe(34);
		expect(food.servingSizeUnit).toBe("g");
		expect(getFdcNutrientValue(food, NUTRIENT_IDS.CALORIES)).toBeCloseTo(
			470.59,
		);
		expect(getFdcNutrientValue(food, NUTRIENT_IDS.SUGAR)).toBeCloseTo(41.18);
		expect(getFdcNutrientValue(food, NUTRIENT_IDS.SODIUM)).toBeCloseTo(397.06);
	});

	it("stores custom density when a volume equivalent is provided", () => {
		const food = createCustomFood({
			name: "Custom yogurt",
			servingWeightGrams: 245,
			volumeQuantity: 1,
			volumeUnit: "cup",
			nutrition: {
				calories: 140,
				fat: 4,
				carbs: 8,
				fiber: 0,
				sugar: 7,
				protein: 18,
			},
		});

		expect(food.customDensityGramsPerMilliliter).toBeCloseTo(1.0208);
		expect(food.customDensityConfidence).toBe("known");
	});

	it("persists and searches custom foods", async () => {
		const food = createCustomFood({
			name: "Homemade protein crunch",
			servingWeightGrams: 50,
			nutrition: {
				calories: 200,
				fat: 4,
				carbs: 18,
				fiber: 3,
				sugar: 6,
				protein: 20,
			},
		});

		await saveCustomFood(food);

		expect(readCustomFoods()).toHaveLength(1);
		expect(searchCustomFoods("protein crunch")[0]?.description).toBe(
			"Homemade protein crunch",
		);
	});

	it("saves one custom food without rewriting the whole cloud list", async () => {
		const food = createCustomFood({
			name: "Single row custom food",
			servingWeightGrams: 40,
			nutrition: {
				calories: 100,
				fat: 1,
				carbs: 20,
				fiber: 2,
				sugar: 6,
				protein: 4,
			},
		});

		expect(await saveCustomFood(food)).toBe("saved");

		expect(cloudData.saveCloudCustomFood).toHaveBeenCalledWith(
			expect.objectContaining({ fdcId: food.fdcId }),
		);
		expect(cloudData.writeCloudCustomFoods).not.toHaveBeenCalled();
	});

	it("rejects duplicate custom ingredient names before another cloud write", async () => {
		const firstFood = createCustomFood({
			name: "Homemade granola",
			servingWeightGrams: 40,
			nutrition: { calories: 160, fat: 4, carbs: 28, fiber: 3, sugar: 8, protein: 5 },
		});
		const duplicateFood = createCustomFood({
			name: "  homemade   GRANOLA ",
			servingWeightGrams: 50,
			nutrition: { calories: 190, fat: 5, carbs: 30, fiber: 4, sugar: 9, protein: 6 },
		});

		expect(await saveCustomFood(firstFood)).toBe("saved");
		expect(await saveCustomFood(duplicateFood)).toBe("duplicate-name");
		expect(readCustomFoods()).toHaveLength(1);
		expect(cloudData.saveCloudCustomFood).toHaveBeenCalledTimes(1);
	});

	it("rejects duplicate packaged-food barcodes before another cloud write", async () => {
		const firstFood = createCustomFood({
			name: "First scanned food",
			servingWeightGrams: 30,
			barcode: "00400638133393",
			barcodeSource: "open-food-facts",
			nutrition: { calories: 100, fat: 2, carbs: 18, fiber: 1, sugar: 6, protein: 3 },
		});
		const duplicateFood = createCustomFood({
			name: "Same package, different name",
			servingWeightGrams: 30,
			barcode: "00400638133393",
			barcodeSource: "manual",
			nutrition: { calories: 100, fat: 2, carbs: 18, fiber: 1, sugar: 6, protein: 3 },
		});

		expect(await saveCustomFood(firstFood)).toBe("saved");
		expect(await saveCustomFood(duplicateFood)).toBe("duplicate-barcode");
		expect(cloudData.saveCloudCustomFood).toHaveBeenCalledTimes(1);
	});

	it("does not cache a custom ingredient when the database write fails", async () => {
		cloudData.saveCloudCustomFood.mockResolvedValue("error");
		const food = createCustomFood({
			name: "Unavailable custom food",
			servingWeightGrams: 30,
			nutrition: { calories: 80, fat: 1, carbs: 15, fiber: 1, sugar: 4, protein: 3 },
		});

		expect(await saveCustomFood(food)).toBe("error");
		expect(readCustomFoods()).toEqual([]);
	});
});
