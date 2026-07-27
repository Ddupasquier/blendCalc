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
		[NUTRIENT_IDS.SODIUM, "Sodium, Na", "307", "MG", 5],
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
	sourceKey: "usda",
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
	it("marks complete exact required data", () => {
		expect(getFoodQuality(completeFood)).toMatchObject({
			label: "Complete",
			missingCount: 0,
		});
	});

	it("counts fallback and derived values separately", () => {
		const quality = getFoodQuality(resolvedFood);

		expect(quality.sourceCounts.fallback).toBe(1);
		expect(quality.sourceCounts.derived).toBe(1);
		expect(quality.sourceCounts.missing).toBe(3);
		expect(quality.missingCount).toBe(1);
		expect(quality.recommendedMissingCount).toBe(2);
		expect(quality.needsDetails).toBe(true);
		expect(
			quality.details.filter((detail) => detail.source === "missing"),
		).toEqual([
			expect.objectContaining({ label: "Sodium, Na" }),
			expect.objectContaining({ label: "Dietary Fiber" }),
			expect.objectContaining({ label: "Total Sugars" }),
		]);
		expect(
			quality.details.find((detail) => detail.source === "derived"),
		).toMatchObject({
			label: "Energy",
			sourceLabel: "Derived",
		});
	});

	it("does not call generic food partial when only recommended nutrients are missing", () => {
		const food = {
			...completeFood,
			foodNutrients: completeFood.foodNutrients.filter(
				(nutrient) =>
					nutrient.nutrientId !== NUTRIENT_IDS.FIBER &&
					nutrient.nutrientId !== NUTRIENT_IDS.SUGAR,
			),
		};

		expect(getFoodQuality(food)).toMatchObject({
			label: "Complete",
			missingCount: 0,
			recommendedMissingCount: 2,
			needsDetails: false,
		});
	});

	it("uses the packaged profile when a barcode is present", () => {
		const packagedFood = {
			...completeFood,
			barcode: "00021130462506",
		};

		expect(getFoodQuality(packagedFood)).toMatchObject({
			label: "Partial label",
			profileKey: "us-packaged-label-v1",
			missingCount: 1,
		});
	});

	it("uses the private manual profile for a private custom food with a barcode", () => {
		const privateManualFood = {
			...completeFood,
			barcode: "00021130462506",
			customFood: true,
			trustStatus: "user-private" as const,
		};

		expect(getFoodQuality(privateManualFood)).toMatchObject({
			label: "Complete",
			profileKey: "private-manual-core-v1",
			completeCount: 5,
			missingCount: 0,
			needsDetails: false,
		});
	});

	it("keeps the packaged profile for a custom food submitted for review", () => {
		const pendingFood = {
			...completeFood,
			barcode: "00021130462506",
			customFood: true,
			trustStatus: "pending-review" as const,
		};

		expect(getFoodQuality(pendingFood)).toMatchObject({
			label: "Partial label",
			profileKey: "us-packaged-label-v1",
			missingCount: 1,
		});
	});
});
