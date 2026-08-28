import type { FoodItem } from "$lib/utils/food/types";

export const FOOD_SAFETY_FILTER_VALUES = {
	all: "all",
	warnings: "warnings",
	activeRecalls: "active-recalls",
} as const;

export type FoodSafetyFilter =
	(typeof FOOD_SAFETY_FILTER_VALUES)[keyof typeof FOOD_SAFETY_FILTER_VALUES];

export const FOOD_SAFETY_FILTER_OPTIONS = [
	{ value: FOOD_SAFETY_FILTER_VALUES.all, label: "All items" },
	{ value: FOOD_SAFETY_FILTER_VALUES.warnings, label: "Warnings" },
	{
		value: FOOD_SAFETY_FILTER_VALUES.activeRecalls,
		label: "Active recalls",
	},
] as const;

export const isFoodSafetyFilter = (value: string): value is FoodSafetyFilter =>
	Object.values(FOOD_SAFETY_FILTER_VALUES).some(
		(filterValue) => filterValue === value,
	);

export const foodHasActiveRecall = (food: FoodItem) =>
	(food.safetyAlerts ?? []).some((alert) => alert.alertType === "recall");

export const foodHasNonRecallWarning = (food: FoodItem) =>
	(food.preferenceWarnings?.length ?? 0) > 0 ||
	(food.safetyAlerts ?? []).some((alert) => alert.alertType !== "recall");

export const foodMatchesSafetyFilter = (
	food: FoodItem,
	filter: FoodSafetyFilter,
) => {
	if (filter === FOOD_SAFETY_FILTER_VALUES.warnings) {
		return foodHasNonRecallWarning(food);
	}
	if (filter === FOOD_SAFETY_FILTER_VALUES.activeRecalls) {
		return foodHasActiveRecall(food);
	}
	return true;
};

export const filterFoodsBySafety = (
	foods: FoodItem[],
	filter: FoodSafetyFilter,
) => foods.filter((food) => foodMatchesSafetyFilter(food, filter));
