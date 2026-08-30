import {
	getDefaultMixGoals,
	getNutrientCatalog,
} from "$lib/utils/food/reference/appReferenceCatalog";
import { resolveFoodNutrient } from "$lib/utils/food/nutrients/foodNutrients";
import { NUTRIENT_IDS } from "$lib/utils/food/types";
import { getNutrientTotal } from "$lib/utils/mix/calculations/nutrientTotals";
import type { SavedRecipe } from "$lib/utils/storage/client/savedRecipes";
import {
	evaluateMixGoal,
	getWeightedMixGoalScore,
} from "$lib/utils/mix/goals/goalEvaluation";
import type { MixNutrientGoal } from "$lib/utils/mix/goals/types";
import { getServingConversions } from "$lib/utils/mix/state/mixState";

export type SavedRecipeGoalTone = "neutral" | "success" | "warning" | "danger";

export type SavedRecipeGoalProgress = {
	nutrientId: number;
	label: string;
	percent: number;
	tone: SavedRecipeGoalTone;
};

export type SavedRecipeOverallGoalScore = {
	percent: number;
	goalCount: number;
};

const hasNutrientEvidence = (recipe: SavedRecipe, nutrientId: number) =>
	recipe.foods.some(
		(food) => resolveFoodNutrient(food, nutrientId).value !== null,
	);

export const getSavedRecipeCalories = (recipe: SavedRecipe) => {
	if (!hasNutrientEvidence(recipe, NUTRIENT_IDS.CALORIES)) return null;
	const servingConversions = getServingConversions(
		recipe.foods,
		recipe.servingQuantities,
		recipe.servingUnits,
	);

	const calories = getNutrientTotal(
		recipe.foods,
		NUTRIENT_IDS.CALORIES,
		recipe.servingGrams,
		servingConversions,
	);
	return Number.isFinite(calories) ? Math.max(0, Math.round(calories)) : null;
};

const getAllSavedRecipeGoalProgress = (
	recipe: SavedRecipe,
): SavedRecipeGoalProgress[] => {
	const servingConversions = getServingConversions(
		recipe.foods,
		recipe.servingQuantities,
		recipe.servingUnits,
	);
	const selectedIds = [...new Set(recipe.selected.map(Number))].filter(
		Number.isFinite,
	);
	const optionById = new Map(
		recipe.options.map((option) => [Number(option.id), option]),
	);
	const nutrientById = new Map(
		getNutrientCatalog().map((nutrient) => [nutrient.id, nutrient]),
	);
	const defaultGoals = getDefaultMixGoals();

	return selectedIds.flatMap((nutrientId) => {
		if (!hasNutrientEvidence(recipe, nutrientId)) return [];

		const goal: MixNutrientGoal | undefined =
			recipe.nutrientGoals[nutrientId] ?? defaultGoals[nutrientId];
		if (!goal) return [];

		const label =
			optionById.get(nutrientId)?.label ?? nutrientById.get(nutrientId)?.label;
		if (!label) return [];

		const total = getNutrientTotal(
			recipe.foods,
			nutrientId,
			recipe.servingGrams,
			servingConversions,
		);
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

export const getSavedRecipeGoalProgress = (
	recipe: SavedRecipe,
	maxGoals?: number,
): SavedRecipeGoalProgress[] => {
	const goals = getAllSavedRecipeGoalProgress(recipe);
	return maxGoals === undefined ? goals : goals.slice(0, maxGoals);
};

export const getSavedRecipeOverallGoalScore = (
	recipe: SavedRecipe,
): SavedRecipeOverallGoalScore | null => {
	const servingConversions = getServingConversions(
		recipe.foods,
		recipe.servingQuantities,
		recipe.servingUnits,
	);
	const defaultGoals = getDefaultMixGoals();
	const evaluatedGoals = [...new Set(recipe.selected.map(Number))].flatMap(
		(nutrientId) => {
			if (
				!Number.isFinite(nutrientId) ||
				!hasNutrientEvidence(recipe, nutrientId)
			) {
				return [];
			}
			const goal = recipe.nutrientGoals[nutrientId] ?? defaultGoals[nutrientId];
			if (!goal) return [];
			const actualAmount = getNutrientTotal(
				recipe.foods,
				nutrientId,
				recipe.servingGrams,
				servingConversions,
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
