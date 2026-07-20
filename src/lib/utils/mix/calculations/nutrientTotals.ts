import { getFdcNutrientValue } from "$lib/utils/food/nutrients/fdcNutrients";
import {
	getDefaultMixGoals,
	getMixRuntimeConfiguration,
} from "$lib/utils/food/reference/appReferenceCatalog";
import type { FdcFood } from "$lib/utils/food/types";
import type {
	NutrientContributionBreakdown,
	NutrientMeta,
	NutrientTotalResult,
} from "./nutrientTypes";

export const getDefaultNutrientGoal = (nutrient: NutrientMeta) => {
	const id = Number(nutrient.id);
	const configuredGoal = getDefaultMixGoals()[id];
	if (configuredGoal !== undefined) return configuredGoal;
	const goalsByUnit = getMixRuntimeConfiguration().defaultGoalByUnit;
	return goalsByUnit[nutrient.unit ?? ""] ?? goalsByUnit.fallback;
};

export const getFoodNutrientAmount = (
	food: FdcFood,
	nutrientId: number,
	servingGrams: Record<number, number>,
) => {
	const nutrientValue = getFdcNutrientValue(food, nutrientId);
	if (nutrientValue === null) return null;

	const defaultServingGrams = getMixRuntimeConfiguration().defaultServingGrams;
	const grams = servingGrams[food.fdcId] ?? defaultServingGrams;
	return (nutrientValue * grams) / defaultServingGrams;
};

export const getNutrientTotalResult = (
	foods: FdcFood[],
	nutrientId: number,
	servingGrams: Record<number, number>,
): NutrientTotalResult => foods.reduce<NutrientTotalResult>(
	(result, food) => {
		const amount = getFoodNutrientAmount(food, nutrientId, servingGrams);
		if (amount === null) {
			result.missingFoodIds.push(food.fdcId);
			return result;
		}
		result.total += amount;
		return result;
	},
	{ total: 0, missingFoodIds: [] },
);

export const getNutrientTotal = (
	foods: FdcFood[],
	nutrientId: number,
	servingGrams: Record<number, number>,
) => {
	return getNutrientTotalResult(foods, nutrientId, servingGrams).total;
};

export const getNutrientContributors = (
	foods: FdcFood[],
	nutrientId: number,
	servingGrams: Record<number, number>,
) => {
	const defaultServingGrams = getMixRuntimeConfiguration().defaultServingGrams;
	return foods.flatMap((food) => {
		const amount = getFoodNutrientAmount(food, nutrientId, servingGrams);
		return amount === null ? [] : [{
			label: food.description,
			amount,
			grams: servingGrams[food.fdcId] ?? defaultServingGrams,
		}];
	})
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
