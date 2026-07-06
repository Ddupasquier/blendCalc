import { describe, expect, it } from "vitest";
import { getFoodQuality } from "$lib/utils/food/quality/foodQuality";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";

const completeFood = {
	fdcId: 1,
	description: "Complete food",
	foodNutrients: [
		[NUTRIENT_IDS.CALORIES, "Energy", "208", "KCAL", 100],
		[NUTRIENT_IDS.FAT, "Total lipid (fat)", "204", "G", 1],
		[NUTRIENT_IDS.CARBS, "Carbohydrate", "205", "G", 10],
		[NUTRIENT_IDS.FIBER, "Fiber", "291", "G", 2],
		[NUTRIENT_IDS.SUGAR, "Sugars", "269", "G", 5],
		[NUTRIENT_IDS.PROTEIN, "Protein", "203", "G", 3],
	].map(([nutrientId, nutrientName, nutrientNumber, unitName, value]) => ({
		nutrientId: Number(nutrientId),
		nutrientName: String(nutrientName),
		nutrientNumber: String(nutrientNumber),
		unitName: String(unitName),
		value: Number(value),
	})),
} satisfies FdcFood;

const resolvedFood = {
	fdcId: 2,
	description: "Oil",
	foodNutrients: [
		{
			nutrientId: 1085,
			nutrientName: "Total fat (NLEA)",
			nutrientNumber: "298",
			unitName: "G",
			value: 93.2,
		},
		{
			nutrientId: NUTRIENT_IDS.CARBS,
			nutrientName: "Carbohydrate",
			nutrientNumber: "205",
			unitName: "G",
			value: 0,
		},
		{
			nutrientId: NUTRIENT_IDS.PROTEIN,
			nutrientName: "Protein",
			nutrientNumber: "203",
			unitName: "G",
			value: 0,
		},
	],
} satisfies FdcFood;

describe("food quality", () => {
	it("marks complete exact vital data", () => {
		expect(getFoodQuality(completeFood)).toMatchObject({
			label: "Complete",
			symbol: "✅",
			missingCount: 0,
		});
	});

	it("counts fallback and derived values separately", () => {
		const quality = getFoodQuality(resolvedFood);

		expect(quality.sourceCounts.fallback).toBe(1);
		expect(quality.sourceCounts.derived).toBe(1);
		expect(quality.sourceCounts.missing).toBe(2);
		expect(quality.symbol).toBe("⚠️");
		expect(quality.needsDetails).toBe(true);
		expect(
			quality.details.filter((detail) => detail.source === "missing"),
		).toEqual([
			expect.objectContaining({ label: "Dietary Fiber" }),
			expect.objectContaining({ label: "Total Sugars" }),
		]);
		expect(
			quality.details.find((detail) => detail.source === "derived"),
		).toMatchObject({
			label: "Calories",
			sourceLabel: "Derived",
		});
	});
});
