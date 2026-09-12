import { describe, expect, it } from "vitest";
import type { FoodItem, FoodNutrient } from "$lib/utils/food/types";
import {
	comparePrivilegedLookupProducts,
	type PrivilegedProductLookupResult,
} from "$lib/utils/moderation/privilegedProductLookup";

const nutrient = (
	nutrientId: number,
	nutrientName: string,
	value: number,
	unitName = "G",
): FoodNutrient => ({
	nutrientId,
	nutrientName,
	nutrientNumber: String(nutrientId),
	unitName,
	value,
	measurementBasis: { kind: "mass", quantity: 100, unitKey: "g" },
});

const food = (overrides: Partial<FoodItem> = {}): FoodItem => ({
	fdcId: 1,
	description: "Test product",
	brandOwner: "Test brand",
	barcode: "00076808006568",
	foodNutrients: [nutrient(1003, "Protein", 10)],
	foodServings: [
		{
			label: "1 bar",
			gramWeight: 50,
			isPrimary: true,
			gramWeightMethod: "source-reported",
		},
	],
	...overrides,
});

const result = (
	id: string,
	product: FoodItem,
): PrivilegedProductLookupResult => ({
	id,
	scope: "stored",
	providerKey: "shared-catalog",
	providerLabel: "Stored in blendCalc",
	food: product,
});

describe("privileged product comparison", () => {
	it("marks matching identity and normalized nutrients as matches", () => {
		const comparison = comparePrivilegedLookupProducts(
			result("left", food()),
			result("right", food({ fdcId: 2 })),
		);

		expect(comparison.differenceCount).toBe(0);
		expect(comparison.rows).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: "name", status: "match" }),
				expect.objectContaining({
					key: "nutrient:1003",
					status: "match",
					leftValue: "10 g",
				}),
			]),
		);
	});

	it("highlights changed and missing fields", () => {
		const comparison = comparePrivilegedLookupProducts(
			result("left", food()),
			result(
				"right",
				food({
					fdcId: 2,
					brandOwner: "Another brand",
					foodNutrients: [
						nutrient(1003, "Protein", 12),
						nutrient(1079, "Fiber", 3),
					],
				}),
			),
		);

		expect(comparison.rows).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: "brand", status: "different" }),
				expect.objectContaining({
					key: "nutrient:1003",
					status: "different",
				}),
				expect.objectContaining({
					key: "nutrient:1079",
					status: "missing",
				}),
			]),
		);
	});

	it("does not invent a 100 g comparison without an exact serving weight", () => {
		const servingNutrient: FoodNutrient = {
			...nutrient(1003, "Protein", 10),
			measurementBasis: {
				kind: "serving",
				quantity: 1,
				unitKey: "serving",
				servingLabel: "1 scoop",
			},
		};
		const comparison = comparePrivilegedLookupProducts(
			result(
				"left",
				food({ foodNutrients: [servingNutrient], foodServings: [] }),
			),
			result("right", food({ fdcId: 2 })),
		);

		expect(comparison.rows).toContainEqual(
			expect.objectContaining({
				key: "nutrient:1003",
				status: "not-comparable",
			}),
		);
	});
});
