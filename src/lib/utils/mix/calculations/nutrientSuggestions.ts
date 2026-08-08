import { resolveFoodNutrient } from "$lib/utils/food/nutrients/foodNutrients";
import { NUTRIENT_DATA_BASIS_GRAMS } from "$lib/utils/food/nutrients/nutritionDisplay";
import { getMixRuntimeConfiguration } from "$lib/utils/food/reference/appReferenceCatalog";
import { getPrimaryFoodServing } from "$lib/utils/food/servings/foodServings";
import type { FoodItem, FoodNutrient } from "$lib/utils/food/types";
import type {
	NutrientAdjustmentImpact,
	NutrientAdjustmentSuggestion,
	NutrientMeta,
} from "./nutrientTypes";
import type { MixGoalMap, MixNutrientGoal } from "$lib/utils/mix/goals/types";
import { evaluateMixGoal } from "$lib/utils/mix/goals/goalEvaluation";
import { formatMixQuantity } from "$lib/utils/mix/formatting/mixQuantity";

type NutrientGoalState = {
	nutrientId: number;
	label: string;
	unit: string;
	goal: MixNutrientGoal;
	total: number;
};

type PracticalIncrement = {
	grams: number;
	label: string;
	source: NutrientAdjustmentSuggestion["incrementSource"];
};

const NUMERIC_EPSILON = 1e-9;

const isBlockedNutrient = (nutrient: FoodNutrient) =>
	nutrient.valueStatus === "derived" ||
	nutrient.valueStatus === "estimated" ||
	nutrient.valueStatus === "trace" ||
	nutrient.valueStatus === "present-unquantified" ||
	nutrient.valueStatus === "missing" ||
	nutrient.valueStatus === "invalid" ||
	nutrient.valueStatus === "unknown" ||
	nutrient.valueOrigin === "derived" ||
	nutrient.valueOrigin === "estimated" ||
	nutrient.mappingStatus === "unmapped" ||
	nutrient.mappingStatus === "excluded" ||
	nutrient.mappingStatus === "unknown";

const getRecommendationNutrientValue = (food: FoodItem, nutrientId: number) => {
	const resolved = resolveFoodNutrient(food, nutrientId);
	if (
		resolved.nutrient === null ||
		resolved.value === null ||
		!Number.isFinite(resolved.value) ||
		resolved.value < 0 ||
		isBlockedNutrient(resolved.nutrient)
	) {
		return null;
	}

	return resolved.value;
};

const hasRecommendationSafetyBlocker = (food: FoodItem) =>
	(food.preferenceWarnings?.length ?? 0) > 0 ||
	food.compatibilityEvaluation?.status === "conflict";

const hasRecommendationDataBlocker = (food: FoodItem) =>
	food.sourceMetadata?.obsolete === true ||
	(food.sourceMetadata?.qualityErrorTags?.some((tag) => tag.trim()) ?? false);

const getGoalDistance = (total: number, goal: MixNutrientGoal) =>
	1 - evaluateMixGoal(goal, total).score;

const getPracticalIncrement = (
	food: FoodItem,
	defaultServingGrams: number,
): PracticalIncrement => {
	const sourceServing = getPrimaryFoodServing(food);
	if (
		sourceServing &&
		Number.isFinite(sourceServing.gramWeight) &&
		sourceServing.gramWeight > 0 &&
		(sourceServing.gramWeightMethod === "source-reported" ||
			sourceServing.gramWeightMethod === "exact-unit-conversion" ||
			sourceServing.gramWeightMethod === "user-reported")
	) {
		return {
			grams: sourceServing.gramWeight,
			label: sourceServing.label,
			source: "source-serving",
		};
	}

	return {
		grams: defaultServingGrams,
		label: formatMixQuantity(defaultServingGrams, { unit: "g" }),
		source: "configured-default",
	};
};

const buildGoalStates = (
	nutrients: NutrientMeta[],
	selectedFoods: FoodItem[],
	nutrientGoals: MixGoalMap,
	servingGrams: Record<number, number>,
	defaultServingGrams: number,
): NutrientGoalState[] | null => {
	const states = nutrients.flatMap((nutrient): NutrientGoalState[] => {
		const nutrientId = Number(nutrient.id);
		const goal = nutrientGoals[nutrientId];
		if (!Number.isFinite(nutrientId) || !goal) {
			return [];
		}

		let total = 0;
		for (const food of selectedFoods) {
			const value = getRecommendationNutrientValue(food, nutrientId);
			if (value === null) return [];
			const grams = servingGrams[food.fdcId] ?? defaultServingGrams;
			if (!Number.isFinite(grams) || grams < 0) return [];
			total += (value * grams) / NUTRIENT_DATA_BASIS_GRAMS;
		}

		return [
			{
				nutrientId,
				label: nutrient.label ?? String(nutrient.id),
				unit: nutrient.unit ?? "",
				goal,
				total,
			},
		];
	});

	const explicitGoalCount = nutrients.filter((nutrient) => {
		return nutrientGoals[Number(nutrient.id)] !== undefined;
	}).length;

	return states.length === explicitGoalCount ? states : null;
};

const buildCandidate = ({
	food,
	direction,
	currentServingGrams,
	increment,
	goalStates,
}: {
	food: FoodItem;
	direction: NutrientAdjustmentSuggestion["direction"];
	currentServingGrams: number;
	increment: PracticalIncrement;
	goalStates: NutrientGoalState[];
}): NutrientAdjustmentSuggestion | null => {
	const signedChange =
		direction === "increase"
			? increment.grams
			: -Math.min(increment.grams, currentServingGrams);
	if (
		!Number.isFinite(signedChange) ||
		Math.abs(signedChange) <= NUMERIC_EPSILON
	) {
		return null;
	}

	const nextServingGrams = Math.max(0, currentServingGrams + signedChange);
	const impacts: NutrientAdjustmentImpact[] = [];
	let currentDistance = 0;
	let nextDistance = 0;

	for (const state of goalStates) {
		const value = getRecommendationNutrientValue(food, state.nutrientId);
		if (value === null) return null;

		const amountChange = (value * signedChange) / NUTRIENT_DATA_BASIS_GRAMS;
		const candidateTotal = Math.max(0, state.total + amountChange);
		const before = getGoalDistance(state.total, state.goal);
		const after = getGoalDistance(candidateTotal, state.goal);

		if (after > before + NUMERIC_EPSILON) return null;

		currentDistance += before * state.goal.importanceWeight;
		nextDistance += after * state.goal.importanceWeight;
		const distanceImprovement = before - after;
		if (distanceImprovement > NUMERIC_EPSILON) {
			impacts.push({
				nutrientId: state.nutrientId,
				label: state.label,
				unit: state.unit,
				amountChange,
				currentTotal: state.total,
				nextTotal: candidateTotal,
				goal: state.goal.targetAmount,
				distanceImprovement,
				weightedDistanceImprovement:
					distanceImprovement * state.goal.importanceWeight,
			});
		}
	}

	const goalDistanceImprovement = currentDistance - nextDistance;
	if (goalDistanceImprovement <= NUMERIC_EPSILON || impacts.length === 0) {
		return null;
	}

	impacts.sort(
		(left, right) =>
			right.weightedDistanceImprovement - left.weightedDistanceImprovement ||
			left.label.localeCompare(right.label),
	);

	return {
		food,
		direction,
		currentServingGrams,
		nextServingGrams,
		changeGrams: Math.abs(signedChange),
		incrementLabel: increment.label,
		incrementSource: increment.source,
		primaryImpact: impacts[0],
		impacts,
		goalDistanceImprovement,
	};
};

export const getNutrientAdjustmentSuggestions = ({
	nutrients,
	selectedFoods,
	nutrientGoals,
	servingGrams,
	maxSuggestions = 3,
}: {
	nutrients: NutrientMeta[];
	selectedFoods: FoodItem[];
	nutrientGoals: MixGoalMap;
	servingGrams: Record<number, number>;
	maxSuggestions?: number;
}): NutrientAdjustmentSuggestion[] => {
	if (
		selectedFoods.length === 0 ||
		selectedFoods.some(hasRecommendationDataBlocker)
	) {
		return [];
	}

	const { defaultServingGrams } = getMixRuntimeConfiguration();
	const goalStates = buildGoalStates(
		nutrients,
		selectedFoods,
		nutrientGoals,
		servingGrams,
		defaultServingGrams,
	);
	if (!goalStates || goalStates.length === 0) return [];

	return selectedFoods
		.flatMap((food): NutrientAdjustmentSuggestion[] => {
			if (hasRecommendationSafetyBlocker(food)) return [];

			const currentServingGrams =
				servingGrams[food.fdcId] ?? defaultServingGrams;
			if (!Number.isFinite(currentServingGrams) || currentServingGrams <= 0) {
				return [];
			}

			const increment = getPracticalIncrement(food, defaultServingGrams);
			const candidates = (["increase", "decrease"] as const).flatMap(
				(direction): NutrientAdjustmentSuggestion[] => {
					const candidate = buildCandidate({
						food,
						direction,
						currentServingGrams,
						increment,
						goalStates,
					});
					return candidate ? [candidate] : [];
				},
			);

			return candidates
				.sort(
					(left, right) =>
						right.goalDistanceImprovement - left.goalDistanceImprovement,
				)
				.slice(0, 1);
		})
		.sort(
			(left, right) =>
				right.goalDistanceImprovement - left.goalDistanceImprovement ||
				right.impacts.length - left.impacts.length ||
				Number(right.incrementSource === "source-serving") -
					Number(left.incrementSource === "source-serving") ||
				left.food.description.localeCompare(right.food.description),
		)
		.slice(0, Math.max(0, maxSuggestions));
};
