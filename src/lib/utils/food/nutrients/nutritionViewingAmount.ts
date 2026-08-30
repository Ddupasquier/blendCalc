import type { FoodItem, FoodServing } from "$lib/utils/food/types";
import {
	convertFoodServingMultiplier,
	getDensityConversion,
	type ServingConversion,
} from "$lib/utils/serving/servingAmount";
import {
	getFoodNutrientExactMassBasisGrams,
	getNutrientAmountForServingConversion,
} from "$lib/utils/food/nutrients/foodNutrients";
import {
	DEFAULT_NUTRITION_VIEWING_GRAMS,
	formatViewingGrams,
	stepNutritionViewingGrams,
} from "$lib/utils/food/nutrients/nutritionDisplay";
import {
	getFoodServings,
	prioritizeFoodServingsForUserDisplay,
} from "$lib/utils/food/servings/foodServings";
import { formatNutritionServingSize } from "$lib/utils/food/servings/servingDisplay";

export type NutritionViewingSelection =
	| { kind: "mass"; grams: number }
	| { kind: "serving"; servingIndex: number; multiplier: number };

export const DEFAULT_NUTRITION_VIEWING_CONVERSION: ServingConversion = {
	grams: DEFAULT_NUTRITION_VIEWING_GRAMS,
	milliliters: null,
	servings: null,
	servingLabel: null,
	dimension: "weight",
	density: null,
	available: true,
	warning: null,
	method: "exact-unit-conversion",
	basis: "100g",
};

export const canViewFoodNutritionByMass = (food: FoodItem) => {
	return food.foodNutrients.every(
		(nutrient) => getFoodNutrientExactMassBasisGrams(food, nutrient) !== null,
	);
};

export const getInitialNutritionViewingSelection = (
	food: FoodItem,
): NutritionViewingSelection => {
	const servings = getFoodServings(food);
	const prioritizedServings = prioritizeFoodServingsForUserDisplay(servings);
	const preferredServing = prioritizedServings.find((serving) => {
		const conversion = convertFoodServingMultiplier(serving, 1);
		return food.foodNutrients.every(
			(nutrient) =>
				getNutrientAmountForServingConversion(nutrient, conversion, food) !==
				null,
		);
	});
	const preferredServingIndex = preferredServing
		? servings.indexOf(preferredServing)
		: -1;
	if (preferredServingIndex >= 0) {
		return {
			kind: "serving",
			servingIndex: preferredServingIndex,
			multiplier: 1,
		};
	}
	if (canViewFoodNutritionByMass(food)) {
		return { kind: "mass", grams: DEFAULT_NUTRITION_VIEWING_GRAMS };
	}
	const fallbackServing = prioritizedServings[0];
	return fallbackServing
		? {
				kind: "serving",
				servingIndex: servings.indexOf(fallbackServing),
				multiplier: 1,
			}
		: { kind: "mass", grams: DEFAULT_NUTRITION_VIEWING_GRAMS };
};

export const getNutritionViewingServing = (
	food: FoodItem,
	selection: NutritionViewingSelection,
): FoodServing | null =>
	selection.kind === "serving"
		? (getFoodServings(food)[selection.servingIndex] ?? null)
		: null;

export const getNutritionViewingConversion = (
	food: FoodItem,
	selection: NutritionViewingSelection,
): ServingConversion => {
	if (selection.kind === "mass") {
		const density = getDensityConversion(food);
		return {
			...DEFAULT_NUTRITION_VIEWING_CONVERSION,
			grams: selection.grams,
			milliliters: density
				? selection.grams / density.gramsPerMilliliter
				: null,
			density,
			basis: `${selection.grams}g`,
		};
	}

	const serving = getNutritionViewingServing(food, selection);
	return serving
		? convertFoodServingMultiplier(serving, selection.multiplier)
		: getNutritionViewingConversion(food, {
				kind: "mass",
				grams: DEFAULT_NUTRITION_VIEWING_GRAMS,
			});
};

export const formatNutritionViewingSelection = (
	food: FoodItem,
	selection: NutritionViewingSelection,
) => {
	if (selection.kind === "mass") return formatViewingGrams(selection.grams);
	const serving = getNutritionViewingServing(food, selection);
	if (!serving) return "Serving unavailable";
	const servingLabel = formatNutritionServingSize(serving);
	return selection.multiplier === 1
		? servingLabel
		: `${selection.multiplier} × ${servingLabel}`;
};

export const stepNutritionViewingSelection = (
	selection: NutritionViewingSelection,
	direction: "increase" | "decrease",
	step: number,
): NutritionViewingSelection => {
	if (selection.kind === "mass") {
		return {
			kind: "mass",
			grams: stepNutritionViewingGrams(selection.grams, direction, step),
		};
	}

	return {
		...selection,
		multiplier: Math.max(
			1,
			selection.multiplier + (direction === "increase" ? 1 : -1),
		),
	};
};
