import { describe, expect, it } from "vitest";
import { mergeExactSourceFood } from "$lib/utils/food/records/sourceFoodEnrichment";
import type { FoodItem } from "$lib/utils/food/types";

const current: FoodItem = {
	fdcId: 171032,
	description: "Oil, Apricot Kernel",
	nameProvenance: "source",
	foodCategory: "Fats and Oils",
	categoryOptionId: "fats-and-oils",
	foodNutrients: [{
		nutrientId: 1008,
		nutrientName: "Energy",
		nutrientNumber: "208",
		unitName: "kcal",
		value: 884,
		source: "usda",
	}],
	reportedNutrientIds: [1008],
	sourceKey: "usda",
	listAddedAt: 123,
};

describe("exact source food enrichment", () => {
	it("adds detail nutrients and servings without losing list or canonical category state", () => {
		const result = mergeExactSourceFood(current, {
			...current,
			description: "Oil, apricot kernel",
			foodCategory: "Oil",
			foodNutrients: [
				{
					...current.foodNutrients[0],
					value: 900,
				},
				{
					nutrientId: 1004,
					nutrientName: "Total lipid (fat)",
					nutrientNumber: "204",
					unitName: "g",
					value: 100,
					source: "usda",
				},
			],
			reportedNutrientIds: [1008, 1004],
			foodServings: [{
				label: "1 tablespoon",
				gramWeight: 13.6,
				isPrimary: true,
				source: "usda",
			}],
			hasSourceServing: true,
		});

		expect(result.foodCategory).toBe("Fats and Oils");
		expect(result.categoryOptionId).toBe("fats-and-oils");
		expect(result.listAddedAt).toBe(123);
		expect(result.foodNutrients).toEqual([
			expect.objectContaining({ nutrientId: 1008, value: 900 }),
			expect.objectContaining({ nutrientId: 1004, value: 100 }),
		]);
		expect(result.foodServings?.[0]).toMatchObject({
			label: "1 tablespoon",
			gramWeight: 13.6,
		});
	});

	it("never overwrites a user-owned display name", () => {
		const result = mergeExactSourceFood(
			{ ...current, description: "My Cooking Oil", nameProvenance: "user" },
			{ ...current, description: "Oil, Apricot Kernel" },
		);

		expect(result.description).toBe("My Cooking Oil");
		expect(result.nameProvenance).toBe("user");
	});
});
