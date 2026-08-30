import { describe, expect, it } from "vitest";
import {
	createNutrientValueMapFromFood,
	validateNutrientRelationshipRules,
	type NutrientRelationshipRule,
} from "$lib/utils/food/nutrients/nutrientRelationshipRules";
import { NUTRIENT_IDS, type FoodItem } from "$lib/utils/food/types";

const rules: NutrientRelationshipRule[] = [
	{
		id: "total-sugars-lte-carbs",
		parentNutrientId: NUTRIENT_IDS.CARBS,
		childNutrientId: NUTRIENT_IDS.SUGAR,
		parentLabel: "Total Carbohydrates",
		childLabel: "Total Sugars",
		relationship: "child_must_not_exceed_parent",
		severity: "error",
		issueCode: "NUTRIENT_CHILD_EXCEEDS_PARENT",
		requiresParent: true,
		tolerance: 0,
	},
	{
		id: "fiber-lte-carbs",
		parentNutrientId: NUTRIENT_IDS.CARBS,
		childNutrientId: NUTRIENT_IDS.FIBER,
		parentLabel: "Total Carbohydrates",
		childLabel: "Dietary Fiber",
		relationship: "child_must_not_exceed_parent",
		severity: "error",
		issueCode: "NUTRIENT_CHILD_EXCEEDS_PARENT",
		requiresParent: true,
		tolerance: 0,
	},
];

const food: FoodItem = {
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

		expect(values.get(NUTRIENT_IDS.CARBS)).toEqual({
			value: 10,
			basisKey: "mass",
		});
		expect(values.get(NUTRIENT_IDS.SUGAR)).toEqual({
			value: 12,
			basisKey: "mass",
		});
	});

	it("reports DB-backed child nutrients that exceed parent nutrients", () => {
		expect(
			validateNutrientRelationshipRules(
				createNutrientValueMapFromFood(food),
				rules,
			),
		).toEqual([
			expect.objectContaining({
				ruleId: "total-sugars-lte-carbs",
				code: "NUTRIENT_CHILD_EXCEEDS_PARENT",
				message: "Total sugars cannot exceed total carbohydrates.",
			}),
		]);
	});

	it("requires a parent value when the child value is reported", () => {
		const values = new Map<number, number>([[NUTRIENT_IDS.FIBER, 3]]);

		expect(validateNutrientRelationshipRules(values, rules)).toEqual([
			expect.objectContaining({
				ruleId: "fiber-lte-carbs",
				code: "NUTRIENT_CHILD_EXCEEDS_PARENT",
				message: "Dietary fiber cannot exceed total carbohydrates.",
			}),
		]);
	});

	it("does not compare nutrients reported on different measurement bases", () => {
		const values = createNutrientValueMapFromFood({
			...food,
			foodNutrients: [
				{
					...food.foodNutrients[0],
					measurementBasis: { kind: "mass", quantity: 100, unitKey: "g" },
				},
				{
					...food.foodNutrients[1],
					measurementBasis: {
						kind: "serving",
						quantity: 1,
						unitKey: "serving",
						servingLabel: "1 cookie",
					},
				},
			],
		});

		expect(validateNutrientRelationshipRules(values, rules)).toEqual([]);
	});
});
