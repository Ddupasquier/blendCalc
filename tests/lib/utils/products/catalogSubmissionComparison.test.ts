import { describe, expect, it } from "vitest";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";
import { compareCatalogSubmissionToExistingProduct } from "$lib/utils/products/catalogSubmissionComparison";

const createFood = (overrides: Partial<FdcFood> = {}): FdcFood => ({
	fdcId: -1,
	description: "Strawberry jelly, strawberry",
	brandOwner: "Safeway, Inc.",
	foodCategory: "Jams",
	customServingWeightGrams: 30,
	foodNutrients: [
		{
			nutrientId: NUTRIENT_IDS.CALORIES,
			nutrientName: "Energy",
			nutrientNumber: "208",
			unitName: "KCAL",
			value: 50,
		},
		{
			nutrientId: NUTRIENT_IDS.FAT,
			nutrientName: "Total lipid (fat)",
			nutrientNumber: "204",
			unitName: "G",
			value: 0,
		},
		{
			nutrientId: NUTRIENT_IDS.CARBS,
			nutrientName: "Carbohydrate, by difference",
			nutrientNumber: "205",
			unitName: "G",
			value: 13,
		},
		{
			nutrientId: NUTRIENT_IDS.PROTEIN,
			nutrientName: "Protein",
			nutrientNumber: "203",
			unitName: "G",
			value: 0,
		},
		{
			nutrientId: NUTRIENT_IDS.SODIUM,
			nutrientName: "Sodium, Na",
			nutrientNumber: "307",
			unitName: "MG",
			value: 0,
		},
	],
	...overrides,
});

describe("catalog submission comparison", () => {
	it("treats unchanged barcode catalog data as already available", () => {
		const comparison = compareCatalogSubmissionToExistingProduct(createFood(), createFood());

		expect(comparison.matchesExisting).toBe(true);
		expect(comparison.shouldAutoDecline).toBe(false);
		expect(comparison.changedFields).toEqual([]);
	});

	it("allows reasonable same-barcode edits to go to moderation", () => {
		const comparison = compareCatalogSubmissionToExistingProduct(
			createFood({
				description: "Strawberry jelly",
				foodNutrients: createFood().foodNutrients.map((nutrient) =>
					nutrient.nutrientId === NUTRIENT_IDS.CARBS
						? { ...nutrient, value: 12 }
						: nutrient
				),
			}),
			createFood(),
		);

		expect(comparison.matchesExisting).toBe(false);
		expect(comparison.shouldAutoDecline).toBe(false);
		expect(comparison.changedFields).toContain("productName");
	});

	it("auto-declines wildly unrelated data for an existing barcode", () => {
		const comparison = compareCatalogSubmissionToExistingProduct(
			createFood({
				description: "Raw chicken breast",
				brandOwner: "Different Poultry Co",
				foodCategory: "Poultry",
				foodNutrients: createFood().foodNutrients.map((nutrient) => {
					if (nutrient.nutrientId === NUTRIENT_IDS.CALORIES) {
						return { ...nutrient, value: 220 };
					}
					if (nutrient.nutrientId === NUTRIENT_IDS.FAT) {
						return { ...nutrient, value: 12 };
					}
					if (nutrient.nutrientId === NUTRIENT_IDS.PROTEIN) {
						return { ...nutrient, value: 26 };
					}
					return nutrient;
				}),
			}),
			createFood(),
		);

		expect(comparison.matchesExisting).toBe(false);
		expect(comparison.shouldAutoDecline).toBe(true);
		expect(comparison.severeDifferences.length).toBeGreaterThan(0);
	});
});
