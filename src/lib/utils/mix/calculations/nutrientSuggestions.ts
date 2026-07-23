import { getFdcNutrientValue } from "$lib/utils/food/nutrients/fdcNutrients";
import { getMixRuntimeConfiguration } from "$lib/utils/food/reference/appReferenceCatalog";
import type { FdcFood } from "$lib/utils/food/types";
import type {
	NutrientFoodSuggestion,
	NutrientFoodSuggestionConflict,
	NutrientMeta,
	NutrientReductionSuggestion,
	NutrientReductionSuggestionConflict,
} from "./nutrientTypes";
import { getDefaultNutrientGoal } from "./nutrientTotals";

const createFoodNutrientLookup = () => {
	const valuesByFood = new Map<number, Map<number, number | null>>();
	return (food: FdcFood, nutrientId: number) => {
		const foodValues = valuesByFood.get(food.fdcId) ?? new Map();
		if (!valuesByFood.has(food.fdcId)) {
			valuesByFood.set(food.fdcId, foodValues);
		}
		if (!foodValues.has(nutrientId)) {
			foodValues.set(nutrientId, getFdcNutrientValue(food, nutrientId));
		}
		return foodValues.get(nutrientId) ?? null;
	};
};

const createFoodNutrientAmountLookup = (defaultServingGrams: number) => {
	const getNutrientValue = createFoodNutrientLookup();
	return (
		food: FdcFood,
		nutrientId: number,
		grams: Record<number, number>,
	) => {
		const value = getNutrientValue(food, nutrientId);
		if (value === null) return 0;
		return (
			value * (grams[food.fdcId] ?? defaultServingGrams)
		) / defaultServingGrams;
	};
};

const takeBestSuggestionPerFood = <Suggestion extends { food: FdcFood }>(
	suggestions: Suggestion[],
	maxSuggestions: number,
) => {
	const bestSuggestionByFood = new Map<number, Suggestion>();
	for (const suggestion of suggestions) {
		if (!bestSuggestionByFood.has(suggestion.food.fdcId)) {
			bestSuggestionByFood.set(suggestion.food.fdcId, suggestion);
		}
	}
	return [...bestSuggestionByFood.values()].slice(0, maxSuggestions);
};

export const getNutrientFoodSuggestions = ({
	nutrients,
	availableFoods,
	selectedFoodIds,
	nutrientGoals,
	servingGrams,
	sourceLabelForFood,
	maxSuggestions = 3,
}: {
	nutrients: NutrientMeta[];
	availableFoods: FdcFood[];
	selectedFoodIds: number[];
	nutrientGoals: Record<number, number>;
	servingGrams: Record<number, number>;
	sourceLabelForFood: (food: FdcFood) => string;
	maxSuggestions?: number;
}) => {
	const { defaultServingGrams, pointGoalTolerance } = getMixRuntimeConfiguration();
	const getNutrientValue = createFoodNutrientLookup();
	const getNutrientAmount =
		createFoodNutrientAmountLookup(defaultServingGrams);
	const selectedFoods = availableFoods.filter((food) =>
		selectedFoodIds.includes(food.fdcId),
	);
	const nutrientStates = nutrients.map((nutrient) => {
		const nutrientId = Number(nutrient.id);
		const goal = nutrientGoals[nutrientId] ?? getDefaultNutrientGoal(nutrient);
		const total = selectedFoods.reduce(
			(sum, food) =>
				sum + getNutrientAmount(food, nutrientId, servingGrams),
			0,
		);

		return {
			nutrientId,
			label: nutrient.label ?? String(nutrient.id),
			unit: nutrient.unit ?? "",
			goal,
			total,
			remainingAmount: goal - total,
		};
	});

	const suggestions = nutrientStates
		.flatMap((targetNutrient) => {
			const { nutrientId, goal, remainingAmount } = targetNutrient;

			if (goal <= 0 || remainingAmount <= goal * 0.1) return [];

			return availableFoods.flatMap((food) => {
				const amountPer100g = getNutrientValue(food, nutrientId);
				if (!amountPer100g || amountPer100g <= 0) return [];

				const currentServingGrams = selectedFoodIds.includes(food.fdcId)
					? (servingGrams[food.fdcId] ?? defaultServingGrams)
					: 0;
				const servingGramsToTarget = remainingAmount / (amountPer100g / 100);
				if (!Number.isFinite(servingGramsToTarget) || servingGramsToTarget <= 0) {
					return [];
				}
				const nextServingGrams = currentServingGrams + servingGramsToTarget;

				const conflicts: NutrientFoodSuggestionConflict[] =
					nutrientStates.flatMap(
						(nutrientState): NutrientFoodSuggestionConflict[] => {
							const nutrientAmountPer100g = getNutrientValue(
								food,
								nutrientState.nutrientId,
							);
							if (nutrientAmountPer100g === null) return [];
							const amountAdded =
								(nutrientAmountPer100g * servingGramsToTarget) /
								defaultServingGrams;
							const nextTotal = nutrientState.total + amountAdded;
							const safeGoal =
								nutrientState.goal > 0 ? nutrientState.goal : 1;
							const overGoalLimit =
								safeGoal * (1 + pointGoalTolerance);

							if (amountAdded <= Math.max(safeGoal * 0.01, 0.05)) {
								return [];
							}

							if (nutrientState.nutrientId === nutrientId) return [];

							if (nutrientState.total > overGoalLimit) {
								return [
									{
										nutrientId: nutrientState.nutrientId,
										label: nutrientState.label,
										unit: nutrientState.unit,
										amountAdded,
										nextTotal,
										goal: nutrientState.goal,
										reason: "already-over" as const,
									},
								];
							}

							if (nextTotal > overGoalLimit) {
								return [
									{
										nutrientId: nutrientState.nutrientId,
										label: nutrientState.label,
										unit: nutrientState.unit,
										amountAdded,
										nextTotal,
										goal: nutrientState.goal,
										reason: "would-exceed" as const,
									},
								];
							}

							return [];
						},
					);

				return [
					{
						food,
						action: (currentServingGrams > 0 ? "increase" : "add") as
							| "increase"
							| "add",
						nutrientId,
						nutrientLabel: targetNutrient.label,
						unit: targetNutrient.unit,
						amountPer100g,
						remainingAmount,
						servingGramsToTarget,
						currentServingGrams,
						nextServingGrams,
						targetAddedAmount: remainingAmount,
						conflicts,
						sourceLabel: sourceLabelForFood(food),
					},
				];
			});
		})
		.sort((a, b) => {
			const conflictDifference = a.conflicts.length - b.conflicts.length;
			if (conflictDifference !== 0) return conflictDifference;
			const servingDifference = a.servingGramsToTarget - b.servingGramsToTarget;
			if (Math.abs(servingDifference) > 0.01) return servingDifference;
			return b.amountPer100g - a.amountPer100g;
		});

	return takeBestSuggestionPerFood<NutrientFoodSuggestion>(
		suggestions,
		maxSuggestions,
	);
};

export const getNutrientReductionSuggestions = ({
	nutrients,
	selectedFoods,
	nutrientGoals,
	servingGrams,
	sourceLabelForFood,
	maxSuggestions = 3,
}: {
	nutrients: NutrientMeta[];
	selectedFoods: FdcFood[];
	nutrientGoals: Record<number, number>;
	servingGrams: Record<number, number>;
	sourceLabelForFood: (food: FdcFood) => string;
	maxSuggestions?: number;
}) => {
	const { defaultServingGrams, pointGoalTolerance } = getMixRuntimeConfiguration();
	const getNutrientAmount =
		createFoodNutrientAmountLookup(defaultServingGrams);
	const nutrientStates = nutrients.map((nutrient) => {
		const nutrientId = Number(nutrient.id);
		const goal = nutrientGoals[nutrientId] ?? getDefaultNutrientGoal(nutrient);
		const total = selectedFoods.reduce(
			(sum, food) =>
				sum + getNutrientAmount(food, nutrientId, servingGrams),
			0,
		);

		return {
			nutrientId,
			label: nutrient.label ?? String(nutrient.id),
			unit: nutrient.unit ?? "",
			goal,
			total,
			overageAmount: total - goal,
		};
	});

	const suggestions = nutrientStates
		.flatMap((targetNutrient) => {
			const { nutrientId, goal, total, overageAmount } = targetNutrient;
			if (goal <= 0 || total <= goal || overageAmount <= 0) return [];

			return selectedFoods.flatMap((food) => {
				const currentServingGrams =
					servingGrams[food.fdcId] ?? defaultServingGrams;
				const targetAmount = getNutrientAmount(
					food,
					nutrientId,
					servingGrams,
				);

				if (currentServingGrams <= 0 || targetAmount === null || targetAmount <= 0) return [];

				const targetReducedAmount = Math.min(overageAmount, targetAmount);
				const percentOfOverageResolved =
					(targetReducedAmount / overageAmount) * 100;
				const reduceByGrams =
					targetReducedAmount / (targetAmount / currentServingGrams);
				const nextServingGrams = Math.max(
					0,
					currentServingGrams - reduceByGrams,
				);
				const minimumUsefulReductionAmount = Math.max(goal * 0.02, 0.25);

				if (
					!Number.isFinite(reduceByGrams) ||
					reduceByGrams < 2 ||
					targetReducedAmount < minimumUsefulReductionAmount ||
					percentOfOverageResolved < 10
				) {
					return [];
				}

				const conflicts: NutrientReductionSuggestionConflict[] =
					nutrientStates.flatMap(
						(nutrientState): NutrientReductionSuggestionConflict[] => {
							if (nutrientState.nutrientId === nutrientId) return [];
							if (nutrientState.goal <= 0) return [];

							const currentFoodAmount = getNutrientAmount(
								food,
								nutrientState.nutrientId,
								servingGrams,
							);
							if (currentFoodAmount === null) return [];
							const amountRemoved =
								(currentFoodAmount * reduceByGrams) / currentServingGrams;
							const nextTotal = nutrientState.total - amountRemoved;
							const underGoalLimit =
								nutrientState.goal * (1 - pointGoalTolerance);

							if (
								amountRemoved <=
								Math.max(nutrientState.goal * 0.01, 0.05)
							) {
								return [];
							}

							if (nutrientState.total < underGoalLimit) {
								return [
									{
										nutrientId: nutrientState.nutrientId,
										label: nutrientState.label,
										unit: nutrientState.unit,
										amountRemoved,
										nextTotal,
										goal: nutrientState.goal,
										reason: "already-under" as const,
									},
								];
							}

							if (nextTotal < underGoalLimit) {
								return [
									{
										nutrientId: nutrientState.nutrientId,
										label: nutrientState.label,
										unit: nutrientState.unit,
										amountRemoved,
										nextTotal,
										goal: nutrientState.goal,
										reason: "would-drop-below" as const,
									},
								];
							}

							return [];
						},
					);

				return [
					{
						food,
						nutrientId,
						nutrientLabel: targetNutrient.label,
						unit: targetNutrient.unit,
						currentServingGrams,
						nextServingGrams,
						reduceByGrams,
						targetReducedAmount,
						overageAmount,
						percentOfOverageResolved,
						conflicts,
						sourceLabel: sourceLabelForFood(food),
					},
				];
			});
		})
		.sort((a, b) => {
			const conflictDifference = a.conflicts.length - b.conflicts.length;
			if (conflictDifference !== 0) return conflictDifference;
			const resolvedDifference =
				b.percentOfOverageResolved - a.percentOfOverageResolved;
			if (Math.abs(resolvedDifference) > 0.01) return resolvedDifference;
			return a.reduceByGrams - b.reduceByGrams;
		});

	return takeBestSuggestionPerFood<NutrientReductionSuggestion>(
		suggestions,
		maxSuggestions,
	);
};
