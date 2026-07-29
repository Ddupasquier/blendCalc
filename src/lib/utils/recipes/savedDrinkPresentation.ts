import {
	getDefaultMixFields,
	getMixRuntimeConfiguration,
	getNutrientCatalog,
} from "$lib/utils/food/reference/appReferenceCatalog";
import { resolveFdcNutrient } from "$lib/utils/food/nutrients/fdcNutrients";
import { NUTRIENT_IDS } from "$lib/utils/food/types";
import { getNutrientTotal } from "$lib/utils/mix/calculations/nutrientTotals";
import type { SavedDrink } from "$lib/utils/storage/client/savedDrinks";

export type SavedDrinkGoalTone =
	| "neutral"
	| "success"
	| "warning"
	| "danger";

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

const hasNutrientEvidence = (
	drink: SavedDrink,
	nutrientId: number,
) =>
	drink.foods.some(
		(food) => resolveFdcNutrient(food, nutrientId).value !== null,
	);

const getGoalTone = (ratio: number): SavedDrinkGoalTone => {
	if (ratio <= 0) return "neutral";
	if (ratio <= 1) return "success";

	const { midwayOver } =
		getMixRuntimeConfiguration().progressThresholds;
	if (ratio <= midwayOver) return "warning";
	return "danger";
};

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
	const defaultGoalById = new Map(
		getDefaultMixFields().flatMap((field) =>
			field.defaultGoal === null ? [] : [[field.id, field.defaultGoal]],
		),
	);

	return selectedIds.flatMap((nutrientId) => {
		if (!hasNutrientEvidence(drink, nutrientId)) return [];

		const goal =
			drink.nutrientGoals[nutrientId] ?? defaultGoalById.get(nutrientId);
		if (!Number.isFinite(goal) || !goal || goal <= 0) return [];

		const label =
			optionById.get(nutrientId)?.label ??
			nutrientById.get(nutrientId)?.label;
		if (!label) return [];

		const total = getNutrientTotal(
			drink.foods,
			nutrientId,
			drink.servingGrams,
		);
		if (!Number.isFinite(total)) return [];

		const ratio = total / goal;
		return [{
			nutrientId,
			label: label.replace(/^Total\s+/i, ""),
			percent: Math.max(0, Math.round(ratio * 100)),
			tone: getGoalTone(ratio),
		}];
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
	const goals = getAllSavedDrinkGoalProgress(drink);
	if (goals.length === 0) return null;

	const totalCloseness = goals.reduce(
		(sum, goal) => sum + Math.max(0, 100 - Math.abs(100 - goal.percent)),
		0,
	);

	return {
		percent: Math.round(totalCloseness / goals.length),
		goalCount: goals.length,
	};
};
