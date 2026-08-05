import {
  getDefaultMixGoals,
	getNutrientCatalog,
} from "$lib/utils/food/reference/appReferenceCatalog";
import { resolveFdcNutrient } from "$lib/utils/food/nutrients/fdcNutrients";
import { NUTRIENT_IDS } from "$lib/utils/food/types";
import { getNutrientTotal } from "$lib/utils/mix/calculations/nutrientTotals";
import type { SavedDrink } from "$lib/utils/storage/client/savedDrinks";
import {
  evaluateMixGoal,
  getWeightedMixGoalScore,
} from "$lib/utils/mix/goals/goalEvaluation";
import type { MixNutrientGoal } from "$lib/utils/mix/goals/types";

export type SavedDrinkGoalTone = "neutral" | "success" | "warning" | "danger";

export type SavedDrinkGoalProgress = {
	nutrientId: number;
	label: string;
	percent: number;
	tone: SavedDrinkGoalTone;
};

export type SavedDrinkOverallGoalScore = {
	percent: number;
	goalCount: number;
};

const hasNutrientEvidence = (drink: SavedDrink, nutrientId: number) =>
	drink.foods.some(
		(food) => resolveFdcNutrient(food, nutrientId).value !== null,
	);

export const getSavedDrinkCalories = (drink: SavedDrink) => {
	if (!hasNutrientEvidence(drink, NUTRIENT_IDS.CALORIES)) return null;

	const calories = getNutrientTotal(
		drink.foods,
		NUTRIENT_IDS.CALORIES,
		drink.servingGrams,
	);
	return Number.isFinite(calories) ? Math.max(0, Math.round(calories)) : null;
};

const getAllSavedDrinkGoalProgress = (
	drink: SavedDrink,
): SavedDrinkGoalProgress[] => {
	const selectedIds = [...new Set(drink.selected.map(Number))].filter(
		Number.isFinite,
	);
	const optionById = new Map(
		drink.options.map((option) => [Number(option.id), option]),
	);
	const nutrientById = new Map(
		getNutrientCatalog().map((nutrient) => [nutrient.id, nutrient]),
	);
  const defaultGoals = getDefaultMixGoals();

	return selectedIds.flatMap((nutrientId) => {
		if (!hasNutrientEvidence(drink, nutrientId)) return [];

    const goal: MixNutrientGoal | undefined =
      drink.nutrientGoals[nutrientId] ?? defaultGoals[nutrientId];
    if (!goal) return [];

		const label =
      optionById.get(nutrientId)?.label ?? nutrientById.get(nutrientId)?.label;
		if (!label) return [];

    const total = getNutrientTotal(drink.foods, nutrientId, drink.servingGrams);
		if (!Number.isFinite(total)) return [];

    const evaluation = evaluateMixGoal(goal, total);
    return [
      {
			nutrientId,
			label: label.replace(/^Total\s+/i, ""),
        percent: Math.max(0, Math.round(evaluation.percent)),
        tone: evaluation.tone,
      },
    ];
	});
};

export const getSavedDrinkGoalProgress = (
	drink: SavedDrink,
	maxGoals?: number,
): SavedDrinkGoalProgress[] => {
	const goals = getAllSavedDrinkGoalProgress(drink);
	return maxGoals === undefined ? goals : goals.slice(0, maxGoals);
};

export const getSavedDrinkOverallGoalScore = (
	drink: SavedDrink,
): SavedDrinkOverallGoalScore | null => {
  const defaultGoals = getDefaultMixGoals();
  const evaluatedGoals = [...new Set(drink.selected.map(Number))].flatMap(
    (nutrientId) => {
      if (
        !Number.isFinite(nutrientId) ||
        !hasNutrientEvidence(drink, nutrientId)
      ) {
        return [];
      }
      const goal = drink.nutrientGoals[nutrientId] ?? defaultGoals[nutrientId];
      if (!goal) return [];
      const actualAmount = getNutrientTotal(
        drink.foods,
        nutrientId,
        drink.servingGrams,
      );
      return Number.isFinite(actualAmount) ? [{ goal, actualAmount }] : [];
    },
	);
  const percent = getWeightedMixGoalScore(evaluatedGoals);
  if (percent === null) return null;

	return {
    percent,
    goalCount: evaluatedGoals.length,
	};
};
