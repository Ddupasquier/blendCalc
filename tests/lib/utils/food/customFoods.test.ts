import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudData = vi.hoisted(() => ({
	saveCloudCustomFood: vi.fn(),
	writeCloudCustomFoods: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudData);

import {
	CUSTOM_FOODS_STORAGE_KEY,
	buildCustomServingLabel,
	createCustomFood,
	findCustomFoodByBarcode,
	findCustomFoodByName,
	readCustomFoods,
	saveCustomFood,
	searchCustomFoods,
} from "$lib/utils/food/custom/customFoods";
import { NUTRIENT_IDS, type FdcNutrient } from "$lib/utils/food/types";
import { getFdcNutrientValue } from "$lib/utils/food/nutrients/fdcNutrients";

type TestNutrition = {
	calories: number;
	fat: number;
	carbs: number;
	fiber: number;
	sugar: number;
	protein: number;
};

const makeTestNutrients = (
	nutrition: TestNutrition,
	additionalNutrients: FdcNutrient[] = [],
): FdcNutrient[] => [
	{
		nutrientId: NUTRIENT_IDS.CALORIES,
		nutrientName: "Energy",
		nutrientNumber: "208",
		unitName: "KCAL",
		value: nutrition.calories,
	},
	{
		nutrientId: NUTRIENT_IDS.FAT,
		nutrientName: "Total lipid (fat)",
		nutrientNumber: "204",
		unitName: "G",
		value: nutrition.fat,
	},
	{
		nutrientId: NUTRIENT_IDS.CARBS,
		nutrientName: "Carbohydrate, by difference",
		nutrientNumber: "205",
		unitName: "G",
		value: nutrition.carbs,
	},
	{
		nutrientId: NUTRIENT_IDS.FIBER,
		nutrientName: "Fiber, total dietary",
		nutrientNumber: "291",
		unitName: "G",
		value: nutrition.fiber,
	},
	{
		nutrientId: NUTRIENT_IDS.SUGAR,
		nutrientName: "Total Sugars",
		nutrientNumber: "269",
		unitName: "G",
		value: nutrition.sugar,
	},
	{
		nutrientId: NUTRIENT_IDS.PROTEIN,
		nutrientName: "Protein",
		nutrientNumber: "203",
		unitName: "G",
		value: nutrition.protein,
	},
	...additionalNutrients,
];

describe("custom foods", () => {
	beforeEach(() => {
		localStorage.removeItem(CUSTOM_FOODS_STORAGE_KEY);
		vi.clearAllMocks();
		cloudData.saveCloudCustomFood.mockResolvedValue("saved");
	});

	it("formats names entered with a valid barcode", () => {
		const food = createCustomFood({
			name: "STRAWBERRY JELLY, STRAWBERRY",
			barcode: "00021130462506",
			servingWeightGrams: 20,
			nutrients: makeTestNutrients({
				calories: 50,
				fat: 0,
				carbs: 13,
				fiber: 0,
				sugar: 9,
				protein: 0,
			}),
		});

		expect(food.description).toBe("Strawberry Jelly, Strawberry");
		expect(food.nameProvenance).toBe("barcode");
	});

	it("preserves safe GS1 product identifier provenance", () => {
		const food = createCustomFood({
			name: "GS1 Test Product",
			barcode: "09506000151519",
			barcodeProvenance: {
				captureMethod: "gs1-digital-link",
				sourceReference: "https://id.gs1.org/01/09506000151519",
				format: "QR_CODE",
			},
			servingWeightGrams: 100,
			nutrients: makeTestNutrients({
				calories: 0,
				fat: 0,
				carbs: 0,
				fiber: 0,
				sugar: 0,
				protein: 0,
			}),
		});

		expect(food.barcodeProvenance).toEqual({
			captureMethod: "gs1-digital-link",
			sourceReference: "https://id.gs1.org/01/09506000151519",
			format: "QR_CODE",
		});
	});

	it("preserves capitalization for a fully manual private item", () => {
		const food = createCustomFood({
			name: "MY PRIVATE TEST FOOD",
			servingWeightGrams: 100,
			nutrients: makeTestNutrients({
				calories: 0,
				fat: 0,
				carbs: 0,
				fiber: 0,
				sugar: 0,
				protein: 0,
			}),
		});

		expect(food.description).toBe("MY PRIVATE TEST FOOD");
		expect(food.nameProvenance).toBe("user");
	});

	it("converts nutrition facts per serving into per-100g nutrients", () => {
		const food = createCustomFood({
			name: "Oreos",
			servingLabel: "3 cookies",
			servingWeightGrams: 34,
			hasSourceServing: true,
			nutrients: makeTestNutrients({
				calories: 160,
				fat: 7,
				carbs: 25,
				fiber: 1,
				sugar: 14,
				protein: 1,
			}, [
				{
					nutrientId: NUTRIENT_IDS.SODIUM,
					nutrientName: "Sodium, Na",
					nutrientNumber: "307",
					unitName: "MG",
					value: 135,
				},
			]),
		});

		expect(food.customFood).toBe(true);
		expect(food.servingSize).toBe(34);
		expect(food.servingSizeUnit).toBe("g");
		expect(food.foodServings).toEqual([
			expect.objectContaining({
				label: "3 cookies",
				gramWeight: 34,
				isPrimary: true,
				source: "user-label",
			}),
		]);
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
			hasSourceServing: true,
			volumeQuantity: 1,
			volumeUnit: "cup",
			nutrients: makeTestNutrients({
				calories: 140,
				fat: 4,
				carbs: 8,
				fiber: 0,
				sugar: 7,
				protein: 18,
			}),
		});

		expect(food.customDensityGramsPerMilliliter).toBeCloseTo(1.0356);
		expect(food.customDensityConfidence).toBe("known");
		expect(food.customServingLabel).toBe("1 cup");
		expect(food.foodServings?.[0]).toMatchObject({
			amount: 1,
			unitKey: "cup",
			gramWeight: 245,
		});
	});

	it("does not claim a source serving unless the caller explicitly supplies one", () => {
		const food = createCustomFood({
			name: "No source serving",
			servingWeightGrams: 100,
			nutrients: makeTestNutrients({
				calories: 10,
				fat: 0,
				carbs: 2,
				fiber: 0,
				sugar: 1,
				protein: 0,
			}),
		});

		expect(food.hasSourceServing).toBe(false);
		expect(food.foodServings).toEqual([]);
	});

	it("rejects an invalid serving weight instead of replacing it", () => {
		expect(() => createCustomFood({
			name: "Invalid serving",
			servingWeightGrams: Number.NaN,
			nutrients: [],
		})).toThrow("Serving weight must be a number greater than zero.");
	});

	it("drops invalid nutrients instead of converting them to zero", () => {
		const food = createCustomFood({
			name: "Invalid nutrient",
			servingWeightGrams: 100,
			nutrients: [{
				nutrientId: NUTRIENT_IDS.PROTEIN,
				nutrientName: "Protein",
				nutrientNumber: "203",
				unitName: "G",
				value: null as unknown as number,
			}],
		});

		expect(food.foodNutrients).toEqual([]);
		expect(food.reportedNutrientIds).toEqual([]);
	});

	it("preserves the selected canonical category identity", () => {
		const food = createCustomFood({
			name: "Category test food",
			servingWeightGrams: 100,
			categories: ["Fruit"],
			categoryOptionId: "fruit",
			nutrients: makeTestNutrients({
				calories: 50,
				fat: 0,
				carbs: 12,
				fiber: 2,
				sugar: 8,
				protein: 1,
			}),
		});

		expect(food.categoryOptionId).toBe("fruit");
		expect(food.foodCategory).toBe("Fruit");
	});

	it("generates a serving label when the user leaves it blank", () => {
		expect(
			buildCustomServingLabel({
				servingWeightGrams: 34,
			}),
		).toBe("34g serving");
		expect(
			buildCustomServingLabel({
				servingLabel: "  3 cookies  ",
				servingWeightGrams: 34,
			}),
		).toBe("3 cookies");
		expect(
			buildCustomServingLabel({
				servingWeightGrams: 245,
				volumeQuantity: 1.5,
				volumeUnit: "cup",
			}),
		).toBe("1.5 cup");
	});

	it("persists and searches custom foods", async () => {
		const food = createCustomFood({
			name: "Homemade protein crunch",
			servingWeightGrams: 50,
			nutrients: makeTestNutrients({
				calories: 200,
				fat: 4,
				carbs: 18,
				fiber: 3,
				sugar: 6,
				protein: 20,
			}),
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
			nutrients: makeTestNutrients({
				calories: 100,
				fat: 1,
				carbs: 20,
				fiber: 2,
				sugar: 6,
				protein: 4,
			}),
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
			nutrients: makeTestNutrients({ calories: 160, fat: 4, carbs: 28, fiber: 3, sugar: 8, protein: 5 }),
		});
		const duplicateFood = createCustomFood({
			name: "  homemade   GRANOLA ",
			servingWeightGrams: 50,
			nutrients: makeTestNutrients({ calories: 190, fat: 5, carbs: 30, fiber: 4, sugar: 9, protein: 6 }),
		});

		expect(await saveCustomFood(firstFood)).toBe("saved");
		expect(await saveCustomFood(duplicateFood)).toBe("duplicate-name");
		expect(readCustomFoods()).toHaveLength(1);
		expect(cloudData.saveCloudCustomFood).toHaveBeenCalledTimes(1);
	});

	it("finds existing custom foods by normalized name", async () => {
		const food = createCustomFood({
			name: "Honey Greek Yogurt",
			servingWeightGrams: 170,
			nutrients: makeTestNutrients({ calories: 140, fat: 2, carbs: 18, fiber: 0, sugar: 14, protein: 15 }),
		});

		await saveCustomFood(food);

		expect(findCustomFoodByName("  honey   greek   yogurt ")?.fdcId).toBe(
			food.fdcId,
		);
	});

	it("rejects duplicate packaged-food barcodes before another cloud write", async () => {
		const firstFood = createCustomFood({
			name: "First scanned food",
			servingWeightGrams: 30,
			barcode: "00400638133393",
			barcodeSource: "open-food-facts",
			nutrients: makeTestNutrients({ calories: 100, fat: 2, carbs: 18, fiber: 1, sugar: 6, protein: 3 }),
		});
		const duplicateFood = createCustomFood({
			name: "Same package, different name",
			servingWeightGrams: 30,
			barcode: "00400638133393",
			barcodeSource: "manual",
			nutrients: makeTestNutrients({ calories: 100, fat: 2, carbs: 18, fiber: 1, sugar: 6, protein: 3 }),
		});

		expect(await saveCustomFood(firstFood)).toBe("saved");
		expect(await saveCustomFood(duplicateFood)).toBe("duplicate-barcode");
		expect(findCustomFoodByBarcode("400638133393")?.description).toBe(
			"First scanned food",
		);
		expect(cloudData.saveCloudCustomFood).toHaveBeenCalledTimes(1);
	});

	it("does not cache a custom ingredient when the database write fails", async () => {
		cloudData.saveCloudCustomFood.mockResolvedValue("error");
		const food = createCustomFood({
			name: "Unavailable custom food",
			servingWeightGrams: 30,
			nutrients: makeTestNutrients({ calories: 80, fat: 1, carbs: 15, fiber: 1, sugar: 4, protein: 3 }),
		});

		expect(await saveCustomFood(food)).toBe("error");
		expect(readCustomFoods()).toEqual([]);
	});
});
