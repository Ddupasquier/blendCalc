import { describe, expect, it } from "vitest";
import {
	parseNutritionLabelText,
	type NutritionLabelOcrMapping,
} from "$lib/utils/food/ocr/nutritionLabelOcr";

const mapping = (
	alias: string,
	sourceUnitName: string,
	nutrientId: number,
	nutrientName: string,
	targetUnitName = sourceUnitName,
	conversionMultiplier: number | null = null,
): NutritionLabelOcrMapping => ({
	alias,
	sourceUnitName,
	nutrientId,
	nutrientName,
	targetUnitName,
	priority: 10,
	conversionMultiplier,
});

const mappings = [
	mapping("calories", "KCAL", 1008, "Calories"),
	mapping("total fat", "G", 1004, "Total Fat"),
	mapping("sodium", "MG", 1093, "Sodium"),
	mapping("total carbohydrate", "G", 1005, "Total Carbohydrate"),
	mapping("dietary fiber", "G", 1079, "Dietary Fiber"),
	mapping("total sugars", "G", 2000, "Total Sugars"),
	mapping("added sugars", "G", 1235, "Added Sugars"),
	mapping("protein", "G", 1003, "Protein"),
	mapping("vitamin d", "IU", 1114, "Vitamin D", "UG", 0.025),
];

describe("nutrition label OCR parser", () => {
	it("extracts per-serving label values without treating daily values as amounts", () => {
		const result = parseNutritionLabelText({
			mappings,
			text: `Nutrition Facts
Serving size 2/3 cup (55g)
Calories 230
Total Fat 8g 10%
Sodium 160mg 7%
Total Carbohydrate 37g 13%
Dietary Fiber 4g 14%
Total Sugars 12g Includes 10g Added Sugars 20%
Protein 3g`,
		});

		expect(result.serving).toEqual({ label: "2/3 cup", gramWeight: 55 });
		expect(
			Object.fromEntries(
				result.candidates.map((candidate) => [
					candidate.nutrientId,
					candidate.value,
				]),
			),
		).toMatchObject({
			1008: 230,
			1004: 8,
			1093: 160,
			1005: 37,
			1079: 4,
			2000: 12,
			1235: 10,
			1003: 3,
		});
	});

	it("uses only nutrient-specific conversions", () => {
		const result = parseNutritionLabelText({
			mappings,
			text: "Vitamin D 400 IU",
		});
		expect(result.candidates).toEqual([
			expect.objectContaining({ nutrientId: 1114, value: 10, unitName: "UG" }),
		]);
	});

	it("does not invent values when a safe unit mapping is unavailable", () => {
		const result = parseNutritionLabelText({
			mappings,
			text: "Sodium 2g",
		});
		expect(result.candidates).toEqual([]);
	});

	it("preserves less-than and not-significant-source statements without inventing zeroes", () => {
		const result = parseNutritionLabelText({
			mappings,
			text: `Nutrition Facts
Serving size 1 Tbsp (14g)
Total Carbohydrate 0g
Dietary Fiber <1g
Not a significant source of total sugars or added sugars.`,
		});

		expect(result.candidates).toEqual([
			expect.objectContaining({ nutrientId: 1005, value: 0 }),
		]);
		expect(result.qualitativeFacts).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					nutrientId: 1079,
					status: "below-reporting-threshold",
					maximumAmount: 1,
				}),
				expect.objectContaining({
					nutrientId: 2000,
					status: "below-reporting-threshold",
				}),
				expect.objectContaining({
					nutrientId: 1235,
					status: "below-reporting-threshold",
				}),
			]),
		);
	});
});
