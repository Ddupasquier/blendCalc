import { MIX_STORAGE_KEYS } from "../../../defaults/mixDefaults";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";
import { getFdcNutrientValue } from "$lib/utils/food/nutrients/fdcNutrients";
import { getFoodPreferenceWarnings } from "$lib/utils/profile/foodPreferenceWarnings";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";

export type IngredientActionItem = {
	key: SmoothieListKey;
	food: FdcFood;
};

export type IngredientListMembership = {
	inFridge: boolean;
	inShoppingList: boolean;
};

export const getIngredientActionKey = (key: SmoothieListKey, foodId: number) =>
	`${key}:${foodId}`;

export const getOppositeIngredientListKey = (key: SmoothieListKey) =>
	key === MIX_STORAGE_KEYS.fridge
		? MIX_STORAGE_KEYS.shoppingList
		: MIX_STORAGE_KEYS.fridge;

export const getIngredientListLabel = (key: SmoothieListKey) =>
	key === MIX_STORAGE_KEYS.fridge ? "Fridge" : "Shopping List";

export const getIngredientMembershipLabel = (
	membership: IngredientListMembership,
) => {
	if (membership.inFridge && membership.inShoppingList) {
		return "Already in Fridge and Shopping List";
	}
	if (membership.inFridge) return "Already in Fridge";
	if (membership.inShoppingList) return "Already in Shopping List";
	return "";
};

export const getIngredientMoveLabel = (key: SmoothieListKey) =>
	key === MIX_STORAGE_KEYS.fridge ? "Move to Shopping List" : "Move to Fridge";

export const areFoodIdsEqual = (left: number[], right: number[]) =>
	left.length === right.length && left.every((id, index) => id === right[index]);

export const getFoodCalories = (food: FdcFood) => {
	const calories = getFdcNutrientValue(food, NUTRIENT_IDS.CALORIES);
	if (!calories) return null;
	return Math.round(calories);
};

export const getFoodDisplayCategory = (food: FdcFood) => {
	if (food.foodCategory) return food.foodCategory;
	if (food.brandOwner) return food.brandOwner;
	return food.customFood ? "Custom ingredient" : "Ingredient";
};

export const getPrimaryFoodWarning = (
	food: FdcFood,
	preferenceProfile: FoodPreferenceProfile | null,
) => {
	const warnings =
		food.preferenceWarnings ?? getFoodPreferenceWarnings(food, preferenceProfile);
	if (warnings.length === 0) return null;
	const warning = warnings.find((item) => item.level === "warning") ?? warnings[0];
	return warning.reason.split(":").at(0) ?? warning.label;
};
