import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudData = vi.hoisted(() => ({
	readCloudCustomFoodByBarcode: vi.fn(),
	readCloudCustomFoodByNameKey: vi.fn(),
	saveCloudCustomFood: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudData);

import {
	buildCustomServingLabel,
	createCustomFood,
	findCustomFoodByBarcode,
	findCustomFoodByName,
	saveCustomFood,
} from "$lib/utils/food/custom/customFoods";
import { NUTRIENT_IDS, type FoodNutrient } from "$lib/utils/food/types";
import {
	getFoodNutrientAmountForServingConversion,
	getFoodNutrientValue,
} from "$lib/utils/food/nutrients/foodNutrients";
import { convertServingAmount } from "$lib/utils/serving/servingAmount";

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
	additionalNutrients: FoodNutrient[] = [],
): FoodNutrient[] => [
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
		vi.clearAllMocks();
		cloudData.readCloudCustomFoodByBarcode.mockResolvedValue(null);
		cloudData.readCloudCustomFoodByNameKey.mockResolvedValue(null);
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
			nutrients: makeTestNutrients(
				{
					calories: 160,
					fat: 7,
					carbs: 25,
					fiber: 1,
					sugar: 14,
					protein: 1,
				},
				[
					{
						nutrientId: NUTRIENT_IDS.SODIUM,
						nutrientName: "Sodium, Na",
						nutrientNumber: "307",
						unitName: "MG",
						value: 135,
					},
				],
			),
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
		expect(getFoodNutrientValue(food, NUTRIENT_IDS.CALORIES)).toBeCloseTo(
			470.59,
		);
		expect(getFoodNutrientValue(food, NUTRIENT_IDS.SUGAR)).toBeCloseTo(41.18);
		expect(getFoodNutrientValue(food, NUTRIENT_IDS.SODIUM)).toBeCloseTo(397.06);
	});

	it("preserves volume-label nutrition without inventing grams", () => {
		const food = createCustomFood({
			name: "Volume-only sauce",
			servingLabel: "1 tbsp",
			servingMeasureQuantity: 1,
			servingMeasureUnit: "tbsp",
			nutrients: makeTestNutrients({
				calories: 40,
				fat: 0,
				carbs: 8,
				fiber: 1,
				sugar: 5,
				protein: 1,
			}),
		});

		expect(food.customServingWeightGrams).toBeUndefined();
		expect(food.foodServings?.[0]).toMatchObject({
			label: "1 tbsp",
			amount: 1,
			unitKey: "tbsp",
		});
		expect(food.foodNutrients[0].measurementBasis).toEqual({
			kind: "volume",
			quantity: 1,
			unitKey: "tbsp",
		});
		expect(
			getFoodNutrientAmountForServingConversion(
				food,
				NUTRIENT_IDS.CALORIES,
				convertServingAmount(0.5, "tbsp", food),
			),
		).toBeCloseTo(20);
	});

	it("preserves count-label nutrition and scales individual items", () => {
		const food = createCustomFood({
			name: "Two-cookie serving",
			servingLabel: "2 cookies",
			servingMeasureQuantity: 2,
			servingMeasureUnit: "item",
			nutrients: makeTestNutrients({
				calories: 160,
				fat: 7,
				carbs: 25,
				fiber: 1,
				sugar: 14,
				protein: 1,
			}),
		});

		expect(food.customServingWeightGrams).toBeUndefined();
		expect(food.foodServings?.[0]).toMatchObject({
			label: "2 cookies",
			amount: 2,
			unitKey: "item",
		});
		expect(food.foodNutrients[0].measurementBasis).toEqual({
			kind: "serving",
			quantity: 1,
			unitKey: "serving",
			servingLabel: "2 cookies",
		});
		expect(
			getFoodNutrientAmountForServingConversion(
				food,
				NUTRIENT_IDS.CALORIES,
				convertServingAmount(1, "item", food),
			),
		).toBeCloseTo(80);
	});

	it("accepts a provider count serving without requiring duplicate form fields", () => {
		const food = createCustomFood({
			name: "Provider cookie",
			barcode: "00012345678905",
			barcodeSource: "open-food-facts",
			serving: {
				label: "1 cookie",
				amount: 1,
				unitKey: "item",
				isPrimary: true,
				origin: "package-label",
				source: "open-food-facts",
				confidence: "imported",
			},
			hasSourceServing: true,
			nutrients: makeTestNutrients({
				calories: 80,
				fat: 3,
				carbs: 12,
				fiber: 1,
				sugar: 6,
				protein: 1,
			}),
		});

		expect(food.foodServings?.[0]).toMatchObject({
			label: "1 cookie",
			amount: 1,
			unitKey: "item",
			gramWeight: undefined,
		});
		expect(food.foodNutrients[0]).toMatchObject({
			value: 80,
			measurementBasis: {
				kind: "serving",
				quantity: 1,
				unitKey: "serving",
				servingLabel: "1 cookie",
			},
		});
	});

	it("preserves source-backed personal records without marking them custom", () => {
		const food = createCustomFood({
			name: "Source product",
			servingWeightGrams: 30,
			sourceKey: "usda",
			sourceDataType: "Branded",
			barcode: "00012345678905",
			barcodeSource: "usda",
			customFood: false,
			nutrients: makeTestNutrients({
				calories: 100,
				fat: 1,
				carbs: 20,
				fiber: 2,
				sugar: 5,
				protein: 3,
			}),
		});

		expect(food.customFood).toBe(false);
		expect(food.dataType).toBe("Branded");
		expect(food.sourceKey).toBe("usda");
	});

	it("stores custom density when a volume equivalent is provided", () => {
		const food = createCustomFood({
			name: "Custom yogurt",
			servingWeightGrams: 245,
			hasSourceServing: true,
			servingMeasureQuantity: 1,
			servingMeasureUnit: "cup",
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
		expect(() =>
			createCustomFood({
				name: "Invalid serving",
				servingWeightGrams: Number.NaN,
				nutrients: [],
			}),
		).toThrow("Serving weight must be a number greater than zero.");
	});

	it("drops invalid nutrients instead of converting them to zero", () => {
		const food = createCustomFood({
			name: "Invalid nutrient",
			servingWeightGrams: 100,
			nutrients: [
				{
					nutrientId: NUTRIENT_IDS.PROTEIN,
					nutrientName: "Protein",
					nutrientNumber: "203",
					unitName: "G",
					value: null as unknown as number,
				},
			],
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
				servingMeasureQuantity: 1.5,
				servingMeasureUnit: "cup",
			}),
		).toBe("1.5 cup");
	});

	it("retains unmapped source nutrients as review evidence instead of nutrition math", () => {
		const food = createCustomFood({
			name: "Provider review example",
			servingWeightGrams: 50,
			nutrients: makeTestNutrients({
				calories: 100,
				fat: 1,
				carbs: 20,
				fiber: 2,
				sugar: 6,
				protein: 4,
			}),
			nutrientSourceReview: [
				{
					nutrientName: "Future nutrient",
					unitName: "mg",
					amount: 4,
					measurementBasis: { kind: "mass", quantity: 100, unitKey: "g" },
					amountPer100g: 4,
					valueStatus: "reported",
					mappingStatus: "unmapped",
					source: "open-food-facts",
					sourceNutrientKey: "future-nutrient",
				},
			],
		});

		expect(food.nutrientSourceReview).toMatchObject([
			{
				sourceNutrientKey: "future-nutrient",
				amount: 4,
				mappingStatus: "unmapped",
			},
		]);
		expect(food.foodNutrients).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ sourceNutrientKey: "future-nutrient" }),
			]),
		);
	});

	it("reads custom food matches from the database", async () => {
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

		cloudData.readCloudCustomFoodByNameKey.mockImplementation(
			async (nameKey: string) =>
				nameKey === "homemade protein crunch" ? food : null,
		);

		await expect(findCustomFoodByName("protein crunch")).resolves.toBeNull();
		await expect(
			findCustomFoodByName("homemade protein crunch"),
		).resolves.toMatchObject({ fdcId: food.fdcId });
		expect(cloudData.readCloudCustomFoodByNameKey).toHaveBeenCalledWith(
			"homemade protein crunch",
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
	});

	it("preserves duplicate-name results from the database", async () => {
		const firstFood = createCustomFood({
			name: "Homemade granola",
			servingWeightGrams: 40,
			nutrients: makeTestNutrients({
				calories: 160,
				fat: 4,
				carbs: 28,
				fiber: 3,
				sugar: 8,
				protein: 5,
			}),
		});
		const duplicateFood = createCustomFood({
			name: "  homemade   GRANOLA ",
			servingWeightGrams: 50,
			nutrients: makeTestNutrients({
				calories: 190,
				fat: 5,
				carbs: 30,
				fiber: 4,
				sugar: 9,
				protein: 6,
			}),
		});

		cloudData.saveCloudCustomFood
			.mockResolvedValueOnce("saved")
			.mockResolvedValueOnce("duplicate-name");
		expect(await saveCustomFood(firstFood)).toBe("saved");
		expect(await saveCustomFood(duplicateFood)).toBe("duplicate-name");
		expect(cloudData.saveCloudCustomFood).toHaveBeenCalledTimes(2);
	});

	it("finds existing custom foods by normalized name", async () => {
		const food = createCustomFood({
			name: "Honey Greek Yogurt",
			servingWeightGrams: 170,
			nutrients: makeTestNutrients({
				calories: 140,
				fat: 2,
				carbs: 18,
				fiber: 0,
				sugar: 14,
				protein: 15,
			}),
		});

		cloudData.readCloudCustomFoodByNameKey.mockResolvedValue(food);

		await expect(
			findCustomFoodByName("  honey   greek   yogurt "),
		).resolves.toMatchObject({ fdcId: food.fdcId });
		expect(cloudData.readCloudCustomFoodByNameKey).toHaveBeenCalledWith(
			"honey greek yogurt",
		);
	});

	it("preserves duplicate-barcode results from the database", async () => {
		const firstFood = createCustomFood({
			name: "First scanned food",
			servingWeightGrams: 30,
			barcode: "4006381333931",
			barcodeSource: "open-food-facts",
			nutrients: makeTestNutrients({
				calories: 100,
				fat: 2,
				carbs: 18,
				fiber: 1,
				sugar: 6,
				protein: 3,
			}),
		});
		const duplicateFood = createCustomFood({
			name: "Same package, different name",
			servingWeightGrams: 30,
			barcode: "4006381333931",
			barcodeSource: "manual",
			nutrients: makeTestNutrients({
				calories: 100,
				fat: 2,
				carbs: 18,
				fiber: 1,
				sugar: 6,
				protein: 3,
			}),
		});

		cloudData.saveCloudCustomFood
			.mockResolvedValueOnce("saved")
			.mockResolvedValueOnce("duplicate-barcode");
		expect(await saveCustomFood(firstFood)).toBe("saved");
		expect(await saveCustomFood(duplicateFood)).toBe("duplicate-barcode");
		cloudData.readCloudCustomFoodByBarcode.mockResolvedValue(firstFood);
		await expect(
			findCustomFoodByBarcode("4006381333931"),
		).resolves.toMatchObject({ description: "First Scanned Food" });
		expect(cloudData.readCloudCustomFoodByBarcode).toHaveBeenCalledWith(
			"04006381333931",
		);
		expect(cloudData.saveCloudCustomFood).toHaveBeenCalledTimes(2);
	});

	it("returns an error when the database write fails", async () => {
		cloudData.saveCloudCustomFood.mockResolvedValue("error");
		const food = createCustomFood({
			name: "Unavailable custom food",
			servingWeightGrams: 30,
			nutrients: makeTestNutrients({
				calories: 80,
				fat: 1,
				carbs: 15,
				fiber: 1,
				sugar: 4,
				protein: 3,
			}),
		});

		expect(await saveCustomFood(food)).toBe("error");
	});
});
