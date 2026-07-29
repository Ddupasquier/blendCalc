import { describe, expect, it } from "vitest";
import {
	getSavedDrinkCalories,
	getSavedDrinkGoalProgress,
} from "$lib/utils/recipes/savedDrinkPresentation";
import { NUTRIENT_IDS } from "$lib/utils/food/types";
import type { SavedDrink } from "$lib/utils/storage/client/savedDrinks";

const drink: SavedDrink = {
	id: "saved-1",
	name: "Goal Mix",
	createdAt: 1,
	foods: [{
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
	}],
	selected: [
		NUTRIENT_IDS.CALORIES,
		NUTRIENT_IDS.PROTEIN,
		NUTRIENT_IDS.FIBER,
	],
	options: [
		{ id: NUTRIENT_IDS.CALORIES, label: "Calories" },
		{ id: NUTRIENT_IDS.PROTEIN, label: "Protein" },
		{ id: NUTRIENT_IDS.FIBER, label: "Dietary Fiber" },
	],
	nutrientGoals: {
		[NUTRIENT_IDS.CALORIES]: 100,
		[NUTRIENT_IDS.PROTEIN]: 10,
		[NUTRIENT_IDS.FIBER]: 5,
	},
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
				percent: 120,
				tone: "warning",
			},
			{
				nutrientId: NUTRIENT_IDS.PROTEIN,
				label: "Protein",
				percent: 80,
				tone: "success",
			},
		]);
	});

	it("does not represent an unreported nutrient as zero percent", () => {
		expect(
			getSavedDrinkGoalProgress(drink).some(
				(goal) => goal.nutrientId === NUTRIENT_IDS.FIBER,
			),
		).toBe(false);
	});
});
