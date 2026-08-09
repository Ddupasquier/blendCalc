import { describe, expect, it } from "vitest";
import {
	getSavedRecipeCalories,
	getSavedRecipeGoalProgress,
	getSavedRecipeOverallGoalScore,
} from "$lib/utils/recipes/savedRecipePresentation";
import { NUTRIENT_IDS } from "$lib/utils/food/types";
import type { SavedRecipe } from "$lib/utils/storage/client/savedRecipes";

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

const recipe: SavedRecipe = {
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

describe("saved recipe presentation", () => {
	it("calculates calories and goal progress from saved nutrient evidence", () => {
		expect(getSavedRecipeCalories(recipe)).toBe(120);
		expect(getSavedRecipeGoalProgress(recipe)).toEqual([
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
		expect(getSavedRecipeOverallGoalScore(recipe)).toEqual({
			percent: 80,
			goalCount: 2,
		});
	});

	it("does not represent an unreported nutrient as zero percent", () => {
		expect(
			getSavedRecipeGoalProgress(recipe).some(
				(goal) => goal.nutrientId === NUTRIENT_IDS.FIBER,
			),
		).toBe(false);
	});

	it("measures proximity to every reported goal without letting overages cancel deficits", () => {
		const mixedGoalRecipe = {
			...recipe,
      foods: [
        {
				...recipe.foods[0],
				foodNutrients: recipe.foods[0].foodNutrients.map((nutrient) => {
					if (nutrient.nutrientId === NUTRIENT_IDS.CALORIES) {
						return { ...nutrient, value: 150 };
					}
					return { ...nutrient, value: 5 };
				}),
        },
      ],
		};

		expect(getSavedRecipeOverallGoalScore(mixedGoalRecipe)).toEqual({
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
		const allGoalsRecipe = {
			...recipe,
			selected: nutrientIds,
			options: nutrientIds.map((id) => ({ id, label: `Goal ${id}` })),
      nutrientGoals: Object.fromEntries(
        nutrientIds.map((id, index) => [id, goal(id, 10, "exact", index + 1)]),
      ),
      foods: [
        {
				...recipe.foods[0],
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

		expect(getSavedRecipeGoalProgress(allGoalsRecipe)).toHaveLength(5);
		expect(getSavedRecipeGoalProgress(allGoalsRecipe, 4)).toHaveLength(4);
		expect(getSavedRecipeOverallGoalScore(allGoalsRecipe)).toEqual({
			percent: 100,
			goalCount: 5,
		});
	});
});
