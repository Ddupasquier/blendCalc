import {
	MIX_STORAGE_KEYS,
} from "$lib/utils/storage/storageKeys";
import { getMixRuntimeConfiguration } from "$lib/utils/food/reference/appReferenceCatalog";
import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import {
	addFoodsToSmoothieList,
} from "$lib/utils/storage/client/smoothieLists";
import { compactFood } from "$lib/utils/food/records/foodRecords";
import {
	deleteCloudSavedDrink,
	readCloudSavedDrinkById,
	readCloudSmoothieList,
	saveCloudSavedDrinkWithResult,
	saveCloudMixPreferences,
} from "$lib/utils/storage/supabase";
import type { FdcFood } from "$lib/utils/food/types";
import { getScopedStorageKey } from "$lib/utils/storage/client/storageScope";
import { writeStoredMixState } from "$lib/utils/mix/state/mixState";
import {
	hasLegacySodiumOption,
	migrateLegacyNutrientGoals,
	migrateLegacyNutrientIds,
	migrateLegacyNutrientOptions,
} from "$lib/utils/mix/nutrients/nutrientMappings";

export const SAVED_DRINKS_CHANGED_EVENT = "smoothie-saved-drinks-changed";
export const LOADED_SAVED_DRINK_STORAGE_KEY = "smoothie-loaded-saved-drink";

export type SavedDrinkNutrientOption = {
	id: string | number;
	label: string;
};

export type SavedDrink = {
	id: string;
	name: string;
	createdAt: number;
	foods: FdcFood[];
	selected: (string | number)[];
	options: SavedDrinkNutrientOption[];
	nutrientGoals: Record<number, number>;
	servingGrams: Record<number, number>;
	servingQuantities: Record<number, number>;
	servingUnits: Record<number, ServingMeasureUnit>;
};

export type SavedDrinkInput = Omit<SavedDrink, "id" | "createdAt">;

export type SavedDrinkMutationResult =
	| { ok: true; drink: SavedDrink }
	| { ok: false; reason: "duplicate" | "missing" | "unavailable" };

export type LoadedSavedDrink = {
	id: string;
	name: string;
	isDirty: boolean;
};

const dispatchSavedDrinksChanged = () => {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(SAVED_DRINKS_CHANGED_EVENT));
};

export const normalizeSavedDrink = (value: SavedDrink): SavedDrink => {
	const rawOptions = Array.isArray(value.options) ? value.options : [];
	const shouldMigrateLegacySodium = hasLegacySodiumOption(rawOptions);

	return {
		...value,
		foods: (value.foods ?? []).map(compactFood),
		selected: migrateLegacyNutrientIds(
			Array.isArray(value.selected) ? value.selected : [],
			shouldMigrateLegacySodium,
		),
		options: migrateLegacyNutrientOptions(rawOptions),
		nutrientGoals: migrateLegacyNutrientGoals(
			value.nutrientGoals ?? {},
			shouldMigrateLegacySodium,
		),
		servingGrams: value.servingGrams ?? {},
		servingQuantities: value.servingQuantities ?? {},
		servingUnits: value.servingUnits ?? {},
	};
};

export const readLoadedSavedDrink = (): LoadedSavedDrink | null => {
	try {
		const raw = sessionStorage.getItem(
			getScopedStorageKey(LOADED_SAVED_DRINK_STORAGE_KEY),
		);
		if (!raw) return null;

		const value = JSON.parse(raw) as Partial<LoadedSavedDrink>;
		if (typeof value.id !== "string" || typeof value.name !== "string") {
			return null;
		}

		return {
			id: value.id,
			name: value.name,
			isDirty: value.isDirty === true,
		};
	} catch {
		return null;
	}
};

export const writeLoadedSavedDrink = (drink: LoadedSavedDrink) => {
	sessionStorage.setItem(
		getScopedStorageKey(LOADED_SAVED_DRINK_STORAGE_KEY),
		JSON.stringify(drink),
	);
};

export const clearLoadedSavedDrink = () => {
	sessionStorage.removeItem(getScopedStorageKey(LOADED_SAVED_DRINK_STORAGE_KEY));
};

const createSavedDrink = (input: SavedDrinkInput): SavedDrink => {
	return {
		...input,
		id: crypto.randomUUID(),
		name: input.name.trim() || "Untitled smoothie",
		createdAt: Date.now(),
		foods: input.foods.map(compactFood),
	};
};

const createUpdatedSavedDrink = (
	existingDrink: SavedDrink,
	input: SavedDrinkInput,
): SavedDrink => {
	return normalizeSavedDrink({
		...input,
		id: existingDrink.id,
		name: input.name.trim() || existingDrink.name,
		createdAt: existingDrink.createdAt,
		foods: input.foods.map(compactFood),
	});
};

export const saveNewSavedDrink = async (
	input: SavedDrinkInput,
): Promise<SavedDrinkMutationResult> => {
	const drink = createSavedDrink(input);
	const cloudResult = await saveCloudSavedDrinkWithResult(drink);
	if (cloudResult === "duplicate") return { ok: false, reason: "duplicate" };
	if (cloudResult !== "saved") return { ok: false, reason: "unavailable" };

	dispatchSavedDrinksChanged();
	return { ok: true, drink };
};

export const saveExistingSavedDrink = async (
	id: string,
	input: SavedDrinkInput,
): Promise<SavedDrinkMutationResult> => {
	const cloudDrink = await readCloudSavedDrinkById(id);
	const existingDrink = cloudDrink ? normalizeSavedDrink(cloudDrink) : null;
	if (!existingDrink) return { ok: false, reason: "missing" };

	const updatedDrink = createUpdatedSavedDrink(existingDrink, input);
	const cloudResult = await saveCloudSavedDrinkWithResult(updatedDrink);
	if (cloudResult === "duplicate") return { ok: false, reason: "duplicate" };
	if (cloudResult !== "saved") return { ok: false, reason: "unavailable" };

	dispatchSavedDrinksChanged();
	return { ok: true, drink: updatedDrink };
};

export const deleteSavedDrink = async (id: string) => {
	const deleted = await deleteCloudSavedDrink(id);
	if (!deleted) return false;

	dispatchSavedDrinksChanged();
	if (readLoadedSavedDrink()?.id === id) clearLoadedSavedDrink();
	return true;
};

export const restoreSavedDrinkToMix = async (drink: SavedDrink) => {
	const normalizedDrink = normalizeSavedDrink(drink);
	const [fridge, shopping] = await Promise.all([
		readCloudSmoothieList(MIX_STORAGE_KEYS.fridge),
		readCloudSmoothieList(MIX_STORAGE_KEYS.shoppingList),
	]);
	if (!fridge || !shopping) return false;

	const fridgeIds = new Set(fridge.map((food) => food.fdcId));
	const shoppingIds = new Set(shopping.map((food) => food.fdcId));
	const foodsMissingFromBothLists = normalizedDrink.foods.filter(
		(food) =>
			!fridgeIds.has(food.fdcId) && !shoppingIds.has(food.fdcId),
	);

	if (foodsMissingFromBothLists.length > 0) {
		const result = await addFoodsToSmoothieList(
			MIX_STORAGE_KEYS.shoppingList,
			foodsMissingFromBothLists,
		);
		if (result === "error") return false;
	}

	const mixState = {
		selected: normalizedDrink.selected,
		options: normalizedDrink.options,
		selectedFoodIds: normalizedDrink.foods.map((food) => food.fdcId),
		servingGrams: normalizedDrink.servingGrams,
		servingQuantities: Object.fromEntries(
			normalizedDrink.foods.map((food) => [
				food.fdcId,
				normalizedDrink.servingQuantities[food.fdcId] ??
					normalizedDrink.servingGrams[food.fdcId] ??
					getMixRuntimeConfiguration().defaultServingGrams,
			]),
		),
		servingUnits: Object.fromEntries(
			normalizedDrink.foods.map((food) => [
				food.fdcId,
				normalizedDrink.servingUnits[food.fdcId] ?? "g",
			]),
		),
	};

	localStorage.setItem(
		getScopedStorageKey(MIX_STORAGE_KEYS.nutrientGoals),
		JSON.stringify(normalizedDrink.nutrientGoals),
	);
	const persistedMixState = writeStoredMixState(mixState);
	writeLoadedSavedDrink({
		id: normalizedDrink.id,
		name: normalizedDrink.name,
		isDirty: false,
	});
	void saveCloudMixPreferences({
		nutrientGoals: normalizedDrink.nutrientGoals,
		mixState: persistedMixState,
	});
	return true;
};
