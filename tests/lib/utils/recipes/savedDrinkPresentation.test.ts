import { describe, expect, it } from "vitest";
import {
	getSavedDrinkCalories,
	getSavedDrinkGoalProgress,
	getSavedDrinkOverallGoalScore,
} from "$lib/utils/recipes/savedDrinkPresentation";
import { NUTRIENT_IDS } from "$lib/utils/food/types";
import type { SavedDrink } from "$lib/utils/storage/client/savedDrinks";

const goal = (
  nutrientId: number,
  targetAmount: number,
  goalType: "exact" | "minimum" | "maximum" = "exact",
  sortOrder = 1,
) => ({
  nutrientId,
  goalType,
  targetAmount,
  upperAmount: null,
  toleranceRatio: 0.1,
  importanceWeight: 1,
  sortOrder,
});

const drink: SavedDrink = {
	id: "saved-1",
	name: "Goal Mix",
	createdAt: 1,
  foods: [
    {
		fdcId: 1,
		description: "Banana",
		foodNutrients: [
			{
				nutrientId: NUTRIENT_IDS.CALORIES,
				nutrientName: "Energy",
				nutrientNumber: "208",
				unitName: "KCAL",
				value: 120,
			},
			{
				nutrientId: NUTRIENT_IDS.PROTEIN,
				nutrientName: "Protein",
				nutrientNumber: "203",
				unitName: "G",
				value: 8,
			},
		],
    },
	],
  selected: [NUTRIENT_IDS.CALORIES, NUTRIENT_IDS.PROTEIN, NUTRIENT_IDS.FIBER],
	options: [
		{ id: NUTRIENT_IDS.CALORIES, label: "Calories" },
		{ id: NUTRIENT_IDS.PROTEIN, label: "Protein" },
		{ id: NUTRIENT_IDS.FIBER, label: "Dietary Fiber" },
	],
	nutrientGoals: {
    [NUTRIENT_IDS.CALORIES]: goal(NUTRIENT_IDS.CALORIES, 100),
    [NUTRIENT_IDS.PROTEIN]: goal(NUTRIENT_IDS.PROTEIN, 10, "minimum", 2),
    [NUTRIENT_IDS.FIBER]: goal(NUTRIENT_IDS.FIBER, 5, "minimum", 3),
	},
  goalBasis: "per_mix",
	servingGrams: { 1: 100 },
	servingQuantities: { 1: 100 },
	servingUnits: { 1: "g" },
};

describe("saved drink presentation", () => {
	it("calculates calories and goal progress from saved nutrient evidence", () => {
		expect(getSavedDrinkCalories(drink)).toBe(120);
		expect(getSavedDrinkGoalProgress(drink)).toEqual([
			{
				nutrientId: NUTRIENT_IDS.CALORIES,
				label: "Calories",
        percent: 80,
        tone: "danger",
			},
			{
				nutrientId: NUTRIENT_IDS.PROTEIN,
				label: "Protein",
				percent: 80,
        tone: "warning",
			},
		]);
		expect(getSavedDrinkOverallGoalScore(drink)).toEqual({
			percent: 80,
			goalCount: 2,
		});
	});

	it("does not represent an unreported nutrient as zero percent", () => {
		expect(
			getSavedDrinkGoalProgress(drink).some(
				(goal) => goal.nutrientId === NUTRIENT_IDS.FIBER,
			),
		).toBe(false);
	});

	it("measures proximity to every reported goal without letting overages cancel deficits", () => {
		const mixedGoalDrink = {
			...drink,
      foods: [
        {
				...drink.foods[0],
				foodNutrients: drink.foods[0].foodNutrients.map((nutrient) => {
					if (nutrient.nutrientId === NUTRIENT_IDS.CALORIES) {
						return { ...nutrient, value: 150 };
					}
					return { ...nutrient, value: 5 };
				}),
        },
      ],
		};

		expect(getSavedDrinkOverallGoalScore(mixedGoalDrink)).toEqual({
			percent: 50,
			goalCount: 2,
		});
	});

	it("returns every supported individual goal unless a caller requests a limit", () => {
		const nutrientIds = [
			NUTRIENT_IDS.CALORIES,
			NUTRIENT_IDS.PROTEIN,
			NUTRIENT_IDS.FAT,
			NUTRIENT_IDS.CARBS,
			NUTRIENT_IDS.FIBER,
		];
		const allGoalsDrink = {
			...drink,
			selected: nutrientIds,
			options: nutrientIds.map((id) => ({ id, label: `Goal ${id}` })),
      nutrientGoals: Object.fromEntries(
        nutrientIds.map((id, index) => [id, goal(id, 10, "exact", index + 1)]),
      ),
      foods: [
        {
				...drink.foods[0],
				foodNutrients: nutrientIds.map((nutrientId) => ({
					nutrientId,
					nutrientName: `Nutrient ${nutrientId}`,
					nutrientNumber: String(nutrientId),
					unitName: "G",
					value: 10,
				})),
        },
      ],
		};

		expect(getSavedDrinkGoalProgress(allGoalsDrink)).toHaveLength(5);
		expect(getSavedDrinkGoalProgress(allGoalsDrink, 4)).toHaveLength(4);
		expect(getSavedDrinkOverallGoalScore(allGoalsDrink)).toEqual({
			percent: 100,
			goalCount: 5,
		});
	});
});
