import { MIX_STORAGE_KEYS } from "../../../defaults/mixDefaults";
import { compactFood, uniqueFoodsById } from "$lib/utils/food/foodRecords";
import { cleanBarcode, normalizeBarcode } from "$lib/utils/barcode/barcode";
import {
	removeCloudSmoothieListItem,
	upsertCloudSmoothieListItem,
	writeCloudSmoothieList,
} from "$lib/utils/storage/supabaseData";
import type { FdcFood } from "$lib/utils/food/types";
import { cacheClearAll } from "$lib/cache";
import { getScopedStorageKey } from "$lib/utils/storage/storageScope";

export const SMOOTHIE_LISTS_CHANGED_EVENT = "smoothie-lists-changed";

export type SmoothieListKey =
	| typeof MIX_STORAGE_KEYS.fridge
	| typeof MIX_STORAGE_KEYS.shoppingList;

export type SmoothieListMutationResult =
	| "added"
	| "duplicate"
	| "removed"
	| "missing"
	| "renamed"
	| "unchanged"
	| "invalid"
	| "error";

const dispatchListsChanged = () => {
	window.dispatchEvent(new CustomEvent(SMOOTHIE_LISTS_CHANGED_EVENT));
};

const isQuotaExceededError = (error: unknown) => {
	return (
		error instanceof DOMException &&
		(error.name === "QuotaExceededError" ||
			error.name === "NS_ERROR_DOM_QUOTA_REACHED")
	);
};

const getFoodIdentityKey = (food: FdcFood) => {
	const barcode = food.barcode ?? food.gtinUpc;
	if (barcode) {
		const digits = cleanBarcode(barcode);
		if (digits) {
			return `barcode:${normalizeBarcode(digits) ?? digits.padStart(14, "0")}`;
		}
	}
	return `fdc:${food.fdcId}`;
};

const uniqueFoodsByListIdentity = (foods: FdcFood[]) => {
	const seen = new Set<string>();
	return foods.filter((food) => {
		const identityKey = getFoodIdentityKey(food);
		if (seen.has(identityKey)) return false;
		seen.add(identityKey);
		return true;
	});
};

export const readSmoothieList = (key: SmoothieListKey) => {
	try {
		const raw = localStorage.getItem(getScopedStorageKey(key));
		const list = raw ? (JSON.parse(raw) as FdcFood[]) : [];
		return list.map(compactFood);
	} catch {
		return [];
	}
};

export const cacheSmoothieListLocally = (key: SmoothieListKey, list: FdcFood[]) => {
	try {
		localStorage.setItem(
			getScopedStorageKey(key),
			JSON.stringify(uniqueFoodsByListIdentity(uniqueFoodsById(list)).map(compactFood)),
		);
	} catch {
		// ignore cache write failures; localStorage is only a fallback cache here
	}
};

export const preserveSelectedListItems = (
	syncedList: FdcFood[],
	cachedList: FdcFood[],
	selectedFoodIds: number[],
) => {
	const selectedFoodIdSet = new Set(selectedFoodIds);
	const selectedCachedFoods = cachedList.filter((food) =>
		selectedFoodIdSet.has(food.fdcId),
	);

	return uniqueFoodsByListIdentity(uniqueFoodsById([...syncedList, ...selectedCachedFoods]));
};

export const writeSmoothieList = (key: SmoothieListKey, list: FdcFood[]) => {
	const compactList = uniqueFoodsByListIdentity(uniqueFoodsById(list)).map(compactFood);

	try {
		localStorage.setItem(getScopedStorageKey(key), JSON.stringify(compactList));
		void writeCloudSmoothieList(key, compactList);
		dispatchListsChanged();
		return true;
	} catch (error) {
		if (!isQuotaExceededError(error)) {
			return false;
		}

		cacheClearAll();

		try {
			localStorage.setItem(getScopedStorageKey(key), JSON.stringify(compactList));
			void writeCloudSmoothieList(key, compactList);
			dispatchListsChanged();
			return true;
		} catch {
			return false;
		}
	}
};

export const addFoodToSmoothieList = async (
	key: SmoothieListKey,
	food: FdcFood,
): Promise<SmoothieListMutationResult> => {
	const list = readSmoothieList(key);
	const foodIdentityKey = getFoodIdentityKey(food);
	if (list.some((item) => getFoodIdentityKey(item) === foodIdentityKey)) {
		return "duplicate";
	}

	const foodRecord = compactFood({
		...food,
		listAddedAt: food.listAddedAt ?? Date.now(),
	});
	const saved = await upsertCloudSmoothieListItem(key, foodRecord);
	if (!saved) return "error";

	const nextList = [...list, foodRecord];

	cacheSmoothieListLocally(key, nextList);
	dispatchListsChanged();
	return "added";
};

export const addFoodsToSmoothieList = async (
	key: SmoothieListKey,
	foods: FdcFood[],
): Promise<SmoothieListMutationResult> => {
	const list = readSmoothieList(key);
	const existingIds = new Set(list.map((item) => item.fdcId));
	const existingIdentityKeys = new Set(list.map(getFoodIdentityKey));
	const addedAt = Date.now();
	const additions = uniqueFoodsById(foods)
		.filter(
			(food) =>
				!existingIds.has(food.fdcId) &&
				!existingIdentityKeys.has(getFoodIdentityKey(food)),
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

	cacheSmoothieListLocally(key, [...list, ...additions]);
	dispatchListsChanged();
	return "added";
};

export const removeFoodFromSmoothieList = async (
	key: SmoothieListKey,
	foodId: number,
): Promise<SmoothieListMutationResult> => {
	const currentList = readSmoothieList(key);
	if (!currentList.some((item) => item.fdcId === foodId)) return "missing";

	const removed = await removeCloudSmoothieListItem(key, foodId);
	if (!removed) return "error";

	const list = currentList.filter((item) => item.fdcId !== foodId);

	cacheSmoothieListLocally(key, list);
	dispatchListsChanged();
	return "removed";
};

export const renameFoodInSmoothieList = async (
	key: SmoothieListKey,
	foodId: number,
	nextDescription: string,
): Promise<SmoothieListMutationResult> => {
	const trimmedDescription = nextDescription.trim().replace(/\s+/g, " ");
	if (!trimmedDescription) return "invalid";

	const currentList = readSmoothieList(key);
	const itemIndex = currentList.findIndex((item) => item.fdcId === foodId);
	if (itemIndex === -1) return "missing";

	const currentItem = currentList[itemIndex];
	if (
		currentItem.description.trim().toLowerCase() ===
		trimmedDescription.toLowerCase()
	) {
		return "unchanged";
	}

	if (
		currentList.some(
			(item) =>
				item.fdcId !== foodId &&
				item.description.trim().toLowerCase() ===
					trimmedDescription.toLowerCase(),
		)
	) {
		return "duplicate";
	}

	const renamedFood = compactFood({
		...currentItem,
		description: trimmedDescription,
	});
	const saved = await upsertCloudSmoothieListItem(key, renamedFood);
	if (!saved) return "error";

	const nextList = currentList.map((item, index) =>
		index === itemIndex ? renamedFood : item,
	);

	cacheSmoothieListLocally(key, nextList);
	dispatchListsChanged();
	return "renamed";
};
