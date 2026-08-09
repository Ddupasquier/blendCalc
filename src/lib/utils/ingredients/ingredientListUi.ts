import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import { NUTRIENT_IDS, type FoodItem } from "$lib/utils/food/types";
import { getFoodNutrientValue } from "$lib/utils/food/nutrients/foodNutrients";
import {
	getFoodPreferenceWarningMessage,
} from "$lib/utils/profile/foodPreferenceWarnings";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

export type IngredientActionItem = {
	key: IngredientListKey;
	food: FoodItem;
};

export type IngredientListMembership = {
	inFridge: boolean;
	inShoppingList: boolean;
};

export const getIngredientActionKey = (key: IngredientListKey, foodId: number) =>
	`${key}:${foodId}`;

export const getOppositeIngredientListKey = (key: IngredientListKey) =>
	key === MIX_STORAGE_KEYS.fridge
		? MIX_STORAGE_KEYS.shoppingList
		: MIX_STORAGE_KEYS.fridge;

export const getIngredientListLabel = (key: IngredientListKey) =>
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

export const getIngredientMoveLabel = (key: IngredientListKey) =>
	key === MIX_STORAGE_KEYS.fridge ? "Move to Shopping List" : "Move to Fridge";

export const areFoodIdsEqual = (left: number[], right: number[]) =>
	left.length === right.length && left.every((id, index) => id === right[index]);

export const getFoodCalories = (food: FoodItem) => {
	const calories = getFoodNutrientValue(food, NUTRIENT_IDS.CALORIES);
	if (calories === null) return null;
	return Math.round(calories);
};

export const getFoodDisplayCategory = (food: FoodItem) => {
	const storedCategory = food.foodCategory?.trim();
	if (storedCategory?.toLowerCase() !== "custom ingredient") {
		if (storedCategory) return storedCategory;
	}
	const canonicalCategory = food.categories
		?.map((category) => category.trim())
		.find((category) =>
			Boolean(category) && category.toLowerCase() !== "custom ingredient"
		);
	if (canonicalCategory) return canonicalCategory;
	return "Category unavailable";
};

export const getPrimaryFoodWarning = (food: FoodItem) => {
	const warnings = food.preferenceWarnings ?? [];
	if (warnings.length === 0) return null;
	const warning = warnings.find((item) => item.level === "warning") ?? warnings[0];
	return getFoodPreferenceWarningMessage(warning);
};
