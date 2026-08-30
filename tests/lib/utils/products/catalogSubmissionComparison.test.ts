import { describe, expect, it } from "vitest";
import { NUTRIENT_IDS, type FoodItem } from "$lib/utils/food/types";
import { compareCatalogSubmissionToExistingProduct as compareCatalogSubmissionWithPolicy } from "$lib/utils/products/catalogSubmissionComparison";
import { PRODUCT_RESOLUTION_POLICY_FIXTURE } from "../../../fixtures/productResolutionPolicy";

const compareCatalogSubmissionToExistingProduct = (
	submittedFood: FoodItem,
	existingFood: FoodItem,
) =>
	compareCatalogSubmissionWithPolicy(
		submittedFood,
		existingFood,
		PRODUCT_RESOLUTION_POLICY_FIXTURE,
	);

const createFood = (overrides: Partial<FoodItem> = {}): FoodItem => ({
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

const withCarbohydrates = (value: number) =>
	createFood({
		foodNutrients: createFood().foodNutrients.map((nutrient) =>
			nutrient.nutrientId === NUTRIENT_IDS.CARBS
				? { ...nutrient, value }
				: nutrient,
		),
	});

describe("catalog submission comparison", () => {
	it("treats unchanged barcode catalog data as already available", () => {
		const comparison = compareCatalogSubmissionToExistingProduct(
			createFood(),
			createFood(),
		);

		expect(comparison.matchesExisting).toBe(true);
		expect(comparison.hasBlockingIdentityMismatch).toBe(false);
		expect(comparison.changedFields).toEqual([]);
		expect(comparison.changes).toEqual([]);
	});

	it("allows same-barcode nutrient edits to go to moderation", () => {
		const comparison = compareCatalogSubmissionToExistingProduct(
			createFood({
				foodNutrients: createFood().foodNutrients.map((nutrient) =>
					nutrient.nutrientId === NUTRIENT_IDS.CARBS
						? { ...nutrient, value: 10 }
						: nutrient,
				),
			}),
			createFood(),
		);

		expect(comparison.matchesExisting).toBe(false);
		expect(comparison.hasBlockingIdentityMismatch).toBe(false);
		expect(comparison.changedFields).toContain(
			`nutrient:${NUTRIENT_IDS.CARBS}`,
		);
		expect(comparison.changes).toContainEqual(
			expect.objectContaining({
				field: `nutrient:${NUTRIENT_IDS.CARBS}`,
				previousValue: { value: 13, unit: "G", basis: "mass" },
				submittedValue: { value: 10, unit: "G", basis: "mass" },
			}),
		);
	});

	it.each([
		[9, "low"],
		[6.5, "medium"],
		[2.5, "high"],
	] as const)(
		"applies the reviewed nutrient boundary at %s as %s severity",
		(submittedValue, expectedSeverity) => {
			const comparison = compareCatalogSubmissionToExistingProduct(
				withCarbohydrates(submittedValue),
				withCarbohydrates(10),
			);

			expect(comparison.changes).toContainEqual(
				expect.objectContaining({
					field: `nutrient:${NUTRIENT_IDS.CARBS}`,
					severity: expectedSeverity,
				}),
			);
		},
	);

	it("documents newly reported nutrients and label allergen changes", () => {
		const comparison = compareCatalogSubmissionToExistingProduct(
			createFood({
				allergens: ["Milk"],
				foodNutrients: [
					...createFood().foodNutrients,
					{
						nutrientId: NUTRIENT_IDS.CALCIUM,
						nutrientName: "Calcium, Ca",
						nutrientNumber: "301",
						unitName: "MG",
						value: 15,
					},
				],
			}),
			createFood(),
		);

		expect(comparison.changes).toContainEqual(
			expect.objectContaining({
				field: "allergens",
				changeType: "added",
				submittedValue: "milk",
			}),
		);
		expect(comparison.changes).toContainEqual(
			expect.objectContaining({
				field: `nutrient:${NUTRIENT_IDS.CALCIUM}`,
				changeType: "added",
				previousValue: null,
				submittedValue: { value: 15, unit: "MG", basis: "mass" },
			}),
		);
	});

	it("does not treat equivalent values on different mass quantities as changes", () => {
		const submitted = createFood({
			foodNutrients: createFood().foodNutrients.map((nutrient) => ({
				...nutrient,
				value: nutrient.value / 2,
				measurementBasis: { kind: "mass", quantity: 50, unitKey: "g" },
			})),
		});
		const comparison = compareCatalogSubmissionToExistingProduct(
			submitted,
			createFood(),
		);

		expect(
			comparison.changedFields.filter((field) => field.startsWith("nutrient:")),
		).toEqual([]);
	});

	it("never interprets count or volume serving quantities as gram weights", () => {
		const existing = createFood({
			customServingWeightGrams: undefined,
			servingSize: 30,
			servingSizeUnit: "ml",
			foodServings: [
				{
					label: "2 tbsp",
					milliliterVolume: 30,
					amount: 2,
					unitKey: "tbsp",
					isPrimary: true,
				},
			],
			householdServingFullText: "2 tbsp",
		});
		const submitted = createFood({
			customServingWeightGrams: undefined,
			servingSize: 1,
			servingSizeUnit: "item",
			foodServings: [
				{
					label: "1 cookie",
					amount: 1,
					unitKey: "item",
					isPrimary: true,
				},
			],
			householdServingFullText: "1 cookie",
		});

		const comparison = compareCatalogSubmissionToExistingProduct(
			submitted,
			existing,
		);

		expect(comparison.changedFields).not.toContain("servingWeightGrams");
		expect(comparison.changes).toContainEqual(
			expect.objectContaining({ field: "householdServing" }),
		);
	});

	it("does not treat an unreported submitted nutrient as a removal", () => {
		const existingFood = createFood({
			foodNutrients: [
				...createFood().foodNutrients,
				{
					nutrientId: NUTRIENT_IDS.CALCIUM,
					nutrientName: "Calcium, Ca",
					nutrientNumber: "301",
					unitName: "MG",
					value: 15,
				},
			],
		});
		const comparison = compareCatalogSubmissionToExistingProduct(
			createFood(),
			existingFood,
		);

		expect(comparison.changedFields).not.toContain(
			`nutrient:${NUTRIENT_IDS.CALCIUM}`,
		);
	});

	it("blocks a related but non-matching product name", () => {
		const comparison = compareCatalogSubmissionToExistingProduct(
			createFood({ description: "Strawberry jelly updated" }),
			createFood(),
		);

		expect(comparison.matchesExisting).toBe(false);
		expect(comparison.hasBlockingIdentityMismatch).toBe(true);
		expect(comparison.changedFields).toContain("productName");
	});

	it("retains wildly different same-barcode data for evidence-backed correction review", () => {
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
		expect(comparison.hasBlockingIdentityMismatch).toBe(true);
		expect(comparison.severeDifferences.length).toBeGreaterThan(0);
	});

	it("blocks an unrelated product name even when the other values match", () => {
		const comparison = compareCatalogSubmissionToExistingProduct(
			createFood({ description: "Motor oil" }),
			createFood(),
		);

		expect(comparison.matchesExisting).toBe(false);
		expect(comparison.hasBlockingIdentityMismatch).toBe(true);
		expect(comparison.changedFields).toContain("productName");
	});
});
