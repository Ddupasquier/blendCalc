import { describe, expect, it } from "vitest";
import type { FoodItem } from "$lib/utils/food/types";
import { compareCatalogSubmissionToExistingProduct as compareCatalogSubmissionWithPolicy } from "$lib/utils/products/catalogSubmissionComparison";
import {
	createCatalogUpdateSourceCheck,
	createCatalogUpdateSummary,
	formatCatalogChangeValue,
	readCatalogUpdateSummary,
} from "$lib/utils/products/catalogUpdateReview";
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

const createFood = (description: string, calories: number): FoodItem => ({
	fdcId: -1,
	description,
	foodNutrients: [
		{
			nutrientId: 1008,
			nutrientName: "Energy",
			nutrientNumber: "208",
			unitName: "KCAL",
			value: calories,
		},
	],
});

describe("catalog update review", () => {
	it("records whether an exact source supports the current or proposed label", () => {
		const currentFood = createFood("Tomato sauce", 40);
		const submittedFood = createFood("Tomato sauce", 50);
		const sourceCheck = createCatalogUpdateSourceCheck({
			source: "usda",
			status: "exact-match",
			checkedAt: "2026-07-19T20:00:00.000Z",
			sourceReference: "123",
			sourceFood: submittedFood,
			submittedFood,
			currentFood,
			resolutionPolicy: PRODUCT_RESOLUTION_POLICY_FIXTURE,
		});

		expect(sourceCheck.supportsSubmittedValues).toBe(true);
		expect(sourceCheck.supportsCurrentValues).toBe(false);
		expect(sourceCheck.sourceReference).toBe("123");
	});

	it("keeps failed checks explicit instead of treating them as disagreement", () => {
		const food = createFood("Tomato sauce", 40);
		const sourceCheck = createCatalogUpdateSourceCheck({
			source: "open-food-facts",
			status: "error",
			checkedAt: "2026-07-19T20:00:00.000Z",
			submittedFood: food,
			currentFood: food,
			resolutionPolicy: PRODUCT_RESOLUTION_POLICY_FIXTURE,
		});

		expect(sourceCheck.supportsSubmittedValues).toBeNull();
		expect(sourceCheck.supportsCurrentValues).toBeNull();
	});

	it("creates a readable, versioned before-and-after summary", () => {
		const currentFood = createFood("Tomato sauce", 40);
		const submittedFood = createFood("Tomato sauce", 50);
		const comparison = compareCatalogSubmissionToExistingProduct(
			submittedFood,
			currentFood,
		);
		const summary = createCatalogUpdateSummary({
			comparison,
			baseRevisionNumber: 4,
			observedAt: "2026-07-19T20:00:00.000Z",
			sourceChecks: [],
		});

		expect(readCatalogUpdateSummary(summary)).toEqual(summary);
		expect(summary.changes[0]?.previousValue).toEqual({
			value: 40,
			unit: "KCAL",
			basis: "mass",
		});
		expect(
			formatCatalogChangeValue(summary.changes[0]?.submittedValue ?? null),
		).toBe("50 KCAL");
	});
});
