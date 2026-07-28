import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import { compactFood, uniqueFoodsById } from "$lib/utils/food/records/foodRecords";
import {
	placeCloudSmoothieListItem,
	readCloudSmoothieListIndex,
	moveCloudSmoothieListItems,
	removeCloudSmoothieListItem,
	renameCloudSmoothieListItem,
	writeCloudSmoothieList,
} from "$lib/utils/storage/supabase";
import type { FdcFood } from "$lib/utils/food/types";
import {
	getFoodIdentityKey,
	uniqueFoodsByIdentity,
} from "$lib/utils/food/records/foodIdentity";

export const SMOOTHIE_LISTS_CHANGED_EVENT = "smoothie-lists-changed";

export type SmoothieListKey =
	| typeof MIX_STORAGE_KEYS.fridge
	| typeof MIX_STORAGE_KEYS.shoppingList;

export type SmoothieListMutationResult =
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

type SmoothieListMutationOptions = {
	notify?: boolean;
};

export const notifySmoothieListsChanged = () => {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(SMOOTHIE_LISTS_CHANGED_EVENT));
};

const getOppositeListKey = (key: SmoothieListKey): SmoothieListKey =>
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

export const addFoodToSmoothieList = async (
	key: SmoothieListKey,
	food: FdcFood,
): Promise<SmoothieListMutationResult> => {
	const foodRecord = compactFood({
		...food,
		listAddedAt: food.listAddedAt ?? Date.now(),
	});
	const placementResult = await placeCloudSmoothieListItem(key, foodRecord);
	if (placementResult !== "added" && placementResult !== "duplicate") {
		return placementResult;
	}
	if (placementResult === "duplicate") return "duplicate";

	notifySmoothieListsChanged();
	return "added";
};

export const moveFoodToSmoothieList = async (
	key: SmoothieListKey,
	food: FdcFood,
	options: SmoothieListMutationOptions = {},
): Promise<SmoothieListMutationResult> => {
	const foodRecord = compactFood({
		...food,
		listAddedAt: Date.now(),
	});
	const placementResult = await placeCloudSmoothieListItem(key, foodRecord, true);
	if (placementResult === "error") return "error";

	if (options.notify !== false) notifySmoothieListsChanged();
	return placementResult === "duplicate" ? "duplicate" : "moved";
};

export const moveFoodsToSmoothieList = async (
	key: SmoothieListKey,
	foods: FdcFood[],
	options: SmoothieListMutationOptions = {},
): Promise<SmoothieListMutationResult> => {
	const foodIds = [...new Set(foods.map((food) => food.fdcId))];
	if (foodIds.length === 0) return "missing";

	const moved = await moveCloudSmoothieListItems(
		getOppositeListKey(key),
		key,
		foodIds,
	);
	if (!moved) return "error";

	if (options.notify !== false) notifySmoothieListsChanged();
	return "moved";
};

export const addFoodsToSmoothieList = async (
	key: SmoothieListKey,
	foods: FdcFood[],
): Promise<SmoothieListMutationResult> => {
	const listIndex = await readCloudSmoothieListIndex();
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

	const saved = await writeCloudSmoothieList(key, additions);
	if (!saved) return "error";

	notifySmoothieListsChanged();
	return "added";
};

export const removeFoodFromSmoothieList = async (
	key: SmoothieListKey,
	foodId: number,
): Promise<SmoothieListMutationResult> => {
	const removed = await removeCloudSmoothieListItem(key, foodId);
	if (!removed) return "error";
	notifySmoothieListsChanged();
	return "removed";
};

export const renameFoodInSmoothieList = async (
	key: SmoothieListKey,
	foodId: number,
	nextDescription: string,
	loadedFood?: FdcFood,
): Promise<SmoothieListMutationResult> => {
	const trimmedDescription = nextDescription.trim().replace(/\s+/g, " ");
	if (!trimmedDescription) return "invalid";
	if (
		loadedFood?.description.trim().toLowerCase() ===
		trimmedDescription.toLowerCase()
	) {
		return "unchanged";
	}

	const result = await renameCloudSmoothieListItem(
		key,
		foodId,
		trimmedDescription,
	);
	if (result !== "renamed") return result;

	notifySmoothieListsChanged();
	return "renamed";
};
