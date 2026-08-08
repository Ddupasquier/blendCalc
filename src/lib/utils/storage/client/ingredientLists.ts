import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import { compactFood, uniqueFoodsById } from "$lib/utils/food/records/foodRecords";
import {
	placeCloudIngredientListItem,
	readCloudIngredientListIndex,
	moveCloudIngredientListItems,
	removeCloudIngredientListItem,
	renameCloudIngredientListItem,
	writeCloudIngredientList,
} from "$lib/utils/storage/supabase";
import type { FdcFood } from "$lib/utils/food/types";
import {
	getFoodIdentityKey,
	uniqueFoodsByIdentity,
} from "$lib/utils/food/records/foodIdentity";

export const INGREDIENT_LISTS_CHANGED_EVENT = "blendcalc-ingredient-lists-changed";

export type IngredientListKey =
	| typeof MIX_STORAGE_KEYS.fridge
	| typeof MIX_STORAGE_KEYS.shoppingList;

export type IngredientListMutationResult =
	| "added"
	| "duplicate"
	| "moved"
	| "move-required:fridge"
	| "move-required:shopping"
	| "removed"
	| "missing"
	| "renamed"
	| "unchanged"
	| "invalid"
	| "error";

type IngredientListMutationOptions = {
	notify?: boolean;
};

export const notifyIngredientListsChanged = () => {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(INGREDIENT_LISTS_CHANGED_EVENT));
};

const getOppositeListKey = (key: IngredientListKey): IngredientListKey =>
	key === MIX_STORAGE_KEYS.fridge
		? MIX_STORAGE_KEYS.shoppingList
		: MIX_STORAGE_KEYS.fridge;

export const preserveSelectedListItems = (
	syncedList: FdcFood[],
	loadedList: FdcFood[],
	selectedFoodIds: number[],
) => {
	const selectedFoodIdSet = new Set(selectedFoodIds);
	const selectedLoadedFoods = loadedList.filter((food) =>
		selectedFoodIdSet.has(food.fdcId),
	);

	return uniqueFoodsByIdentity(uniqueFoodsById([...syncedList, ...selectedLoadedFoods]));
};

export const addFoodToIngredientList = async (
	key: IngredientListKey,
	food: FdcFood,
	options: IngredientListMutationOptions = {},
): Promise<IngredientListMutationResult> => {
	const foodRecord = compactFood({
		...food,
		listAddedAt: food.listAddedAt ?? Date.now(),
	});
	const placementResult = await placeCloudIngredientListItem(key, foodRecord);
	if (placementResult !== "added" && placementResult !== "duplicate") {
		return placementResult;
	}
	if (placementResult === "duplicate") return "duplicate";

	if (options.notify !== false) notifyIngredientListsChanged();
	return "added";
};

export const moveFoodToIngredientList = async (
	key: IngredientListKey,
	food: FdcFood,
	options: IngredientListMutationOptions = {},
): Promise<IngredientListMutationResult> => {
	const foodRecord = compactFood({
		...food,
		listAddedAt: Date.now(),
	});
	const placementResult = await placeCloudIngredientListItem(key, foodRecord, true);
	if (placementResult === "error") return "error";

	if (options.notify !== false) notifyIngredientListsChanged();
	return placementResult === "duplicate" ? "duplicate" : "moved";
};

export const moveFoodsToIngredientList = async (
	key: IngredientListKey,
	foods: FdcFood[],
	options: IngredientListMutationOptions = {},
): Promise<IngredientListMutationResult> => {
	const foodIds = [...new Set(foods.map((food) => food.fdcId))];
	if (foodIds.length === 0) return "missing";

	const moved = await moveCloudIngredientListItems(
		getOppositeListKey(key),
		key,
		foodIds,
	);
	if (!moved) return "error";

	if (options.notify !== false) notifyIngredientListsChanged();
	return "moved";
};

export const addFoodsToIngredientList = async (
	key: IngredientListKey,
	foods: FdcFood[],
): Promise<IngredientListMutationResult> => {
	const listIndex = await readCloudIngredientListIndex();
	if (!listIndex) return "error";
	const currentList = listIndex[key];
	const oppositeList = listIndex[getOppositeListKey(key)];
	const oppositeIdentityKeys = new Set(oppositeList.foodIdentityKeys);
	const existingIds = new Set(currentList.foodIds);
	const existingIdentityKeys = new Set(currentList.foodIdentityKeys);
	const addedAt = Date.now();
	const additions = uniqueFoodsById(foods)
		.filter(
			(food) =>
				!existingIds.has(food.fdcId) &&
				!existingIdentityKeys.has(getFoodIdentityKey(food)) &&
				!oppositeIdentityKeys.has(getFoodIdentityKey(food)),
		)
		.filter(
			(food, index, items) =>
				items.findIndex(
					(candidate) => getFoodIdentityKey(candidate) === getFoodIdentityKey(food),
				) === index,
		)
		.map((food) =>
			compactFood({
				...food,
				listAddedAt: food.listAddedAt ?? addedAt,
			}),
		);

	if (additions.length === 0) return "duplicate";

	const saved = await writeCloudIngredientList(key, additions);
	if (!saved) return "error";

	notifyIngredientListsChanged();
	return "added";
};

export const removeFoodFromIngredientList = async (
	key: IngredientListKey,
	foodId: number,
	options: IngredientListMutationOptions = {},
): Promise<IngredientListMutationResult> => {
	const removed = await removeCloudIngredientListItem(key, foodId);
	if (!removed) return "error";
	if (options.notify !== false) notifyIngredientListsChanged();
	return "removed";
};

export const renameFoodInIngredientList = async (
	key: IngredientListKey,
	foodId: number,
	nextDescription: string,
	loadedFood?: FdcFood,
	options: IngredientListMutationOptions = {},
): Promise<IngredientListMutationResult> => {
	const trimmedDescription = nextDescription.trim().replace(/\s+/g, " ");
	if (!trimmedDescription) return "invalid";
	if (
		loadedFood?.description.trim().toLowerCase() ===
		trimmedDescription.toLowerCase()
	) {
		return "unchanged";
	}

	const result = await renameCloudIngredientListItem(
		key,
		foodId,
		trimmedDescription,
	);
	if (result !== "renamed") return result;

	if (options.notify !== false) notifyIngredientListsChanged();
	return "renamed";
};
