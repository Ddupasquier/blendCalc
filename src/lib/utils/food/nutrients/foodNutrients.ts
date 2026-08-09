import type { FoodItem, FoodNutrient } from "$lib/utils/food/types";
import { getConfiguredAppReferenceCatalog } from "$lib/utils/food/reference/appReferenceCatalog";

export type NutrientResolutionMethod = "exact" | "mapped" | "derived" | "missing";

export type ResolvedFoodNutrient = {
	nutrient: FoodNutrient | null;
	value: number | null;
	source: NutrientResolutionMethod;
};

export const findFoodNutrient = (food: FoodItem, nutrientId: number) => {
	return food.foodNutrients.find((nutrient) =>
		isMatchingFoodNutrient(nutrient, nutrientId, food.sourceKey),
	);
};

export const getFoodNutrientValue = (food: FoodItem, nutrientId: number) => {
	return resolveFoodNutrient(food, nutrientId).value;
};

export const resolveFoodNutrient = (
	food: FoodItem,
	nutrientId: number,
): ResolvedFoodNutrient => {
	const exact = food.foodNutrients.find(
		(nutrient) => Number(nutrient.nutrientId) === nutrientId,
	);

	if (exact) {
		return { nutrient: exact, value: exact.value, source: "exact" };
	}

	const mappedNutrient = food.foodNutrients.find((nutrient) =>
		matchesEquivalentNutrient(nutrient, nutrientId, food.sourceKey),
	);

	if (mappedNutrient) {
		return {
			nutrient: mappedNutrient,
			value: mappedNutrient.value,
			source: "mapped",
		};
	}

	return { nutrient: null, value: null, source: "missing" };
};

export const isMatchingFoodNutrient = (
	nutrient: FoodNutrient,
	nutrientId: number,
	foodSourceKey?: string,
) => {
	if (Number(nutrient.nutrientId) === nutrientId) return true;

	return matchesEquivalentNutrient(nutrient, nutrientId, foodSourceKey);
};

const matchesEquivalentNutrient = (
	nutrient: FoodNutrient,
	nutrientId: number,
	foodSourceKey?: string,
) => {
	const sourceKey = nutrient.source ?? foodSourceKey ?? "unknown";
	return getConfiguredAppReferenceCatalog().nutrientEquivalences.some(
		(equivalence) =>
			equivalence.canonicalNutrientId === nutrientId &&
			equivalence.sourceKey === sourceKey &&
			((equivalence.sourceNutrientId !== null &&
				Number(nutrient.nutrientId) === equivalence.sourceNutrientId) ||
				(equivalence.sourceNutrientNumber !== null &&
					String(nutrient.nutrientNumber) ===
						equivalence.sourceNutrientNumber)),
	);
};
