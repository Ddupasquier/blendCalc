import {
	DEFAULT_GOAL_BY_UNIT,
	DEFAULT_NUTRIENT_GOALS,
	DEFAULT_SERVING_GRAMS,
} from "../../../../defaults/mixDefaults";
import { getFdcNutrientValue } from "$lib/utils/food/nutrients/fdcNutrients";
import type { FdcFood } from "$lib/utils/food/types";
import type {
	NutrientContributionBreakdown,
	NutrientMeta,
} from "./nutrientTypes";

export const getDefaultNutrientGoal = (nutrient: NutrientMeta) => {
	const id = Number(nutrient.id);
	if (DEFAULT_NUTRIENT_GOALS[id]) return DEFAULT_NUTRIENT_GOALS[id];
	if (nutrient.unit === "g") return DEFAULT_GOAL_BY_UNIT.grams;
	if (nutrient.unit === "kcal") return DEFAULT_GOAL_BY_UNIT.calories;
	return DEFAULT_GOAL_BY_UNIT.fallback;
};

export const getFoodNutrientAmount = (
	food: FdcFood,
	nutrientId: number,
	servingGrams: Record<number, number>,
) => {
	const nutrientValue = getFdcNutrientValue(food, nutrientId);
	if (!nutrientValue) return 0;

	const grams = servingGrams[food.fdcId] ?? DEFAULT_SERVING_GRAMS;
	return (nutrientValue * grams) / DEFAULT_SERVING_GRAMS;
};

export const getNutrientTotal = (
	foods: FdcFood[],
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
	foods: FdcFood[],
	nutrientId: number,
	servingGrams: Record<number, number>,
) => {
	return foods
		.map((food) => ({
			label: food.description,
			amount: getFoodNutrientAmount(food, nutrientId, servingGrams),
			grams: servingGrams[food.fdcId] ?? DEFAULT_SERVING_GRAMS,
		}))
		.filter((contributor) => contributor.amount > 0)
		.sort((a, b) => b.amount - a.amount);
};

export const getNutrientContributionBreakdowns = (
	nutrients: NutrientMeta[],
	foods: FdcFood[],
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
	foods: FdcFood[],
	nutrientGoals: Record<number, number>,
	servingGrams: Record<number, number>,
) => {
	return nutrients.map((nutrient) => {
		const goal =
			nutrientGoals[Number(nutrient.id)] ?? getDefaultNutrientGoal(nutrient);
		if (goal <= 0) return 0;
		return getNutrientTotal(foods, Number(nutrient.id), servingGrams) / goal;
	});
};
