import { getFoodNutrientValue } from "$lib/utils/food/nutrients/foodNutrients";
import { NUTRIENT_DATA_BASIS_GRAMS } from "$lib/utils/food/nutrients/nutritionDisplay";
import {
	getDefaultMixGoals,
	getMixRuntimeConfiguration,
} from "$lib/utils/food/reference/appReferenceCatalog";
import type { FoodItem } from "$lib/utils/food/types";
import type {
	NutrientContributionBreakdown,
	NutrientMeta,
} from "./nutrientTypes";
import type {
	MixGoalMap,
	MixNutrientGoal,
} from "$lib/utils/mix/goals/types";
import { evaluateMixGoal } from "$lib/utils/mix/goals/goalEvaluation";

export const getDefaultNutrientGoal = (
	nutrient: NutrientMeta,
): MixNutrientGoal | null => {
	const id = Number(nutrient.id);
	return getDefaultMixGoals()[id] ?? null;
};

export const getEffectiveNutrientGoal = (
	nutrient: NutrientMeta,
	nutrientGoals: MixGoalMap,
) => nutrientGoals[Number(nutrient.id)] ?? null;

export const getFoodNutrientAmount = (
	food: FoodItem,
	nutrientId: number,
	servingGrams: Record<number, number>,
) => {
	const nutrientValue = getFoodNutrientValue(food, nutrientId);
	if (nutrientValue === null) return 0;

	const defaultServingGrams = getMixRuntimeConfiguration().defaultServingGrams;
	const grams = servingGrams[food.fdcId] ?? defaultServingGrams;
	return (nutrientValue * grams) / NUTRIENT_DATA_BASIS_GRAMS;
};

export const getNutrientTotal = (
	foods: FoodItem[],
	nutrientId: number,
	servingGrams: Record<number, number>,
) => {
	return foods.reduce(
		(total, food) =>
			total + getFoodNutrientAmount(food, nutrientId, servingGrams),
		0,
	);
};

export const getNutrientContributors = (
	foods: FoodItem[],
	nutrientId: number,
	servingGrams: Record<number, number>,
) => {
	const defaultServingGrams = getMixRuntimeConfiguration().defaultServingGrams;
	return foods
		.flatMap((food) => {
			const amount = getFoodNutrientAmount(food, nutrientId, servingGrams);
			return [
				{
					label: food.description,
					amount,
					grams: servingGrams[food.fdcId] ?? defaultServingGrams,
				},
			];
		})
		.filter((contributor) => contributor.amount > 0)
		.sort((a, b) => b.amount - a.amount);
};

export const getNutrientContributionBreakdowns = (
	nutrients: NutrientMeta[],
	foods: FoodItem[],
	servingGrams: Record<number, number>,
	maxContributors = 2,
): NutrientContributionBreakdown[] => {
	return nutrients.flatMap((nutrient) => {
		const nutrientId = Number(nutrient.id);
		const contributors = getNutrientContributors(
			foods,
			nutrientId,
			servingGrams,
		);
		const total = contributors.reduce(
			(sum, contributor) => sum + contributor.amount,
			0,
		);

		if (total <= 0) return [];

		return [
			{
				nutrientId,
				label: nutrient.label ?? String(nutrient.id),
				unit: nutrient.unit ?? "",
				total,
				contributors: contributors
					.slice(0, maxContributors)
					.map((contributor) => ({
						...contributor,
						percentOfTotal: (contributor.amount / total) * 100,
					})),
			},
		];
	});
};

export const getNutrientProgress = (
	nutrients: NutrientMeta[],
	foods: FoodItem[],
	nutrientGoals: MixGoalMap,
	servingGrams: Record<number, number>,
) => {
	return nutrients.flatMap((nutrient) => {
		const goal = getEffectiveNutrientGoal(nutrient, nutrientGoals);
		if (!goal) return [];
		if (goal.targetAmount <= 0) return [0];
		return [
			getNutrientTotal(foods, Number(nutrient.id), servingGrams) /
				goal.targetAmount,
		];
	});
};

export const getNutrientGoalEvaluations = (
	nutrients: NutrientMeta[],
	foods: FoodItem[],
	nutrientGoals: MixGoalMap,
	servingGrams: Record<number, number>,
) =>
	nutrients.flatMap((nutrient) => {
		const goal = getEffectiveNutrientGoal(nutrient, nutrientGoals);
		if (!goal) return [];
		return [
			evaluateMixGoal(
				goal,
				getNutrientTotal(foods, Number(nutrient.id), servingGrams),
			),
		];
	});
