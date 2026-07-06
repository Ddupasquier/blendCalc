import { describe, expect, it } from "vitest";
import {
	createNutrientValueMapFromFood,
	validateNutrientRelationshipRules,
	type NutrientRelationshipRule,
} from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";

const rules: NutrientRelationshipRule[] = [
	{
		id: "total-sugars-lte-carbs",
		parentNutrientId: NUTRIENT_IDS.CARBS,
		childNutrientId: NUTRIENT_IDS.SUGAR,
		relationship: "child_must_not_exceed_parent",
		severity: "error",
		message: "Total sugars cannot exceed total carbohydrates.",
		requiresParent: true,
		tolerance: 0,
	},
	{
		id: "fiber-lte-carbs",
		parentNutrientId: NUTRIENT_IDS.CARBS,
		childNutrientId: NUTRIENT_IDS.FIBER,
		relationship: "child_must_not_exceed_parent",
		severity: "error",
		message: "Dietary fiber cannot exceed total carbohydrates.",
		requiresParent: true,
		tolerance: 0,
	},
];

const food: FdcFood = {
	fdcId: 1,
	description: "Test food",
	foodNutrients: [
		{
			nutrientId: NUTRIENT_IDS.CARBS,
			nutrientName: "Total Carbohydrate",
			nutrientNumber: "205",
			unitName: "G",
			value: 10,
		},
		{
			nutrientId: NUTRIENT_IDS.SUGAR,
			nutrientName: "Total Sugars",
			nutrientNumber: "269",
			unitName: "G",
			value: 12,
		},
	],
};

describe("nutrient relationship rules", () => {
	it("builds nutrient value maps from foods", () => {
		const values = createNutrientValueMapFromFood(food);

		expect(values.get(NUTRIENT_IDS.CARBS)).toBe(10);
		expect(values.get(NUTRIENT_IDS.SUGAR)).toBe(12);
	});

	it("reports DB-backed child nutrients that exceed parent nutrients", () => {
		expect(validateNutrientRelationshipRules(
			createNutrientValueMapFromFood(food),
			rules,
		)).toEqual([
			expect.objectContaining({
				ruleId: "total-sugars-lte-carbs",
				message: "Total sugars cannot exceed total carbohydrates.",
			}),
		]);
	});

	it("requires a parent value when the child value is reported", () => {
		const values = new Map<number, number>([[NUTRIENT_IDS.FIBER, 3]]);

		expect(validateNutrientRelationshipRules(values, rules)).toEqual([
			expect.objectContaining({
				ruleId: "fiber-lte-carbs",
				message: "Dietary fiber cannot exceed total carbohydrates.",
			}),
		]);
	});
});
