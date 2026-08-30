import {
	getFoodNutrientAmountForServingConversion,
	getFoodNutrientMeasurementBasis,
	getFoodNutrientValue,
	resolveFoodNutrient,
} from "$lib/utils/food/nutrients/foodNutrients";
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
import type { MixGoalMap, MixNutrientGoal } from "$lib/utils/mix/goals/types";
import { evaluateMixGoal } from "$lib/utils/mix/goals/goalEvaluation";
import type { ServingConversion } from "$lib/utils/serving/servingAmount";
import { formatMixQuantity } from "$lib/utils/mix/formatting/mixQuantity";

export type MixServingConversionMap = Record<number, ServingConversion>;

const getServingAmountLabel = (
	food: FoodItem,
	servingGrams: Record<number, number>,
	servingConversions?: MixServingConversionMap,
) => {
	const conversion = servingConversions?.[food.fdcId];
	if (conversion?.basis) return conversion.basis;
	const grams =
		servingGrams[food.fdcId] ??
		getMixRuntimeConfiguration().defaultServingGrams;
	return formatMixQuantity(grams, { unit: "g" });
};

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
	servingConversions?: MixServingConversionMap,
) =>
	getFoodNutrientAmountForMixServing(
		food,
		nutrientId,
		servingGrams,
		servingConversions,
	);

export const getFoodNutrientAmountForMixServing = (
	food: FoodItem,
	nutrientId: number,
	servingGrams: Record<number, number>,
	servingConversions?: MixServingConversionMap,
) => {
	const exactConversion = servingConversions?.[food.fdcId];
	if (exactConversion) {
		const exactAmount = getFoodNutrientAmountForServingConversion(
			food,
			nutrientId,
			exactConversion,
		);
		if (exactAmount !== null) return exactAmount;
		const nutrient = resolveFoodNutrient(food, nutrientId).nutrient;
		if (
			!nutrient ||
			getFoodNutrientMeasurementBasis(nutrient).kind !== "mass"
		) {
			return 0;
		}
	}
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
	servingConversions?: MixServingConversionMap,
) => {
	return foods.reduce(
		(total, food) =>
			total +
			getFoodNutrientAmountForMixServing(
				food,
				nutrientId,
				servingGrams,
				servingConversions,
			),
		0,
	);
};

export const getNutrientContributors = (
	foods: FoodItem[],
	nutrientId: number,
	servingGrams: Record<number, number>,
	servingConversions?: MixServingConversionMap,
) => {
	return foods
		.flatMap((food) => {
			const amount = getFoodNutrientAmountForMixServing(
				food,
				nutrientId,
				servingGrams,
				servingConversions,
			);
			return [
				{
					label: food.description,
					amount,
					grams:
						servingConversions?.[food.fdcId]?.grams ?? servingGrams[food.fdcId],
					servingAmountLabel: getServingAmountLabel(
						food,
						servingGrams,
						servingConversions,
					),
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
	servingConversions?: MixServingConversionMap,
): NutrientContributionBreakdown[] => {
	return nutrients.flatMap((nutrient) => {
		const nutrientId = Number(nutrient.id);
		const contributors = getNutrientContributors(
			foods,
			nutrientId,
			servingGrams,
			servingConversions,
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
	servingConversions?: MixServingConversionMap,
) => {
	return nutrients.flatMap((nutrient) => {
		const goal = getEffectiveNutrientGoal(nutrient, nutrientGoals);
		if (!goal) return [];
		if (goal.targetAmount <= 0) return [0];
		return [
			getNutrientTotal(
				foods,
				Number(nutrient.id),
				servingGrams,
				servingConversions,
			) / goal.targetAmount,
		];
	});
};

export const getNutrientGoalEvaluations = (
	nutrients: NutrientMeta[],
	foods: FoodItem[],
	nutrientGoals: MixGoalMap,
	servingGrams: Record<number, number>,
	servingConversions?: MixServingConversionMap,
) =>
	nutrients.flatMap((nutrient) => {
		const goal = getEffectiveNutrientGoal(nutrient, nutrientGoals);
		if (!goal) return [];
		return [
			evaluateMixGoal(
				goal,
				getNutrientTotal(
					foods,
					Number(nutrient.id),
					servingGrams,
					servingConversions,
				),
			),
		];
	});
