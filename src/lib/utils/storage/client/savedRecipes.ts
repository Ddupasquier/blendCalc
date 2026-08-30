import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import { getMixRuntimeConfiguration } from "$lib/utils/food/reference/appReferenceCatalog";
import type { ServingMeasureUnit } from "$lib/utils/serving/servingMeasureCatalog";
import { addFoodsToIngredientList } from "$lib/utils/storage/client/ingredientLists";
import { normalizeFoodForStorage } from "$lib/utils/food/records/foodRecords";
import {
	deleteCloudSavedRecipe,
	readCloudIngredientListIndex,
	readCloudSavedRecipeById,
	saveCloudSavedRecipeWithResult,
	saveCloudMixGoalConfiguration,
	saveCloudMixPreferences,
} from "$lib/utils/storage/supabase";
import { NUTRIENT_IDS, type FoodItem } from "$lib/utils/food/types";
import { getScopedStorageKey } from "$lib/utils/storage/client/storageScope";
import { writeStoredMixState } from "$lib/utils/mix/state/mixState";
import { getDefaultServingAmount } from "$lib/utils/mix/ui/mixUi";
import {
	hasLegacySodiumOption,
	LEGACY_SODIUM_NUTRIENT_ID,
	migrateLegacyNutrientIds,
	migrateLegacyNutrientOptions,
} from "$lib/utils/mix/nutrients/nutrientMappings";
import {
	isMixGoalBasis,
	normalizeMixGoalMap,
	type MixGoalBasis,
	type MixGoalMap,
} from "$lib/utils/mix/goals/types";

export const SAVED_RECIPES_CHANGED_EVENT = "blendcalc-saved-recipes-changed";
export const LOADED_SAVED_RECIPE_STORAGE_KEY = "blendcalc-loaded-saved-recipe";

export type SavedRecipeNutrientOption = {
	id: string | number;
	label: string;
};

export type SavedRecipe = {
	id: string;
	name: string;
	createdAt: number;
	foods: FoodItem[];
	selected: (string | number)[];
	options: SavedRecipeNutrientOption[];
	nutrientGoals: MixGoalMap;
	goalBasis: MixGoalBasis;
	servingGrams: Record<number, number>;
	servingQuantities: Record<number, number>;
	servingUnits: Record<number, ServingMeasureUnit>;
};

export type SavedRecipeInput = Omit<SavedRecipe, "id" | "createdAt">;

export type SavedRecipeMutationResult =
	| { ok: true; recipe: SavedRecipe }
	| { ok: false; reason: "duplicate" | "missing" | "unavailable" };

export type SavedRecipeMutationOptions = {
	notify?: boolean;
};

export type LoadedSavedRecipe = {
	id: string;
	name: string;
	isDirty: boolean;
};

const dispatchSavedRecipesChanged = () => {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(SAVED_RECIPES_CHANGED_EVENT));
};

export const normalizeSavedRecipe = (value: SavedRecipe): SavedRecipe => {
	const rawOptions = Array.isArray(value.options) ? value.options : [];
	const shouldMigrateLegacySodium = hasLegacySodiumOption(rawOptions);
	const normalizedGoals = normalizeMixGoalMap(
		value.nutrientGoals,
		getMixRuntimeConfiguration().pointGoalTolerance,
	);
	if (
		shouldMigrateLegacySodium &&
		normalizedGoals[LEGACY_SODIUM_NUTRIENT_ID] &&
		!normalizedGoals[NUTRIENT_IDS.SODIUM]
	) {
		normalizedGoals[NUTRIENT_IDS.SODIUM] = {
			...normalizedGoals[LEGACY_SODIUM_NUTRIENT_ID],
			nutrientId: NUTRIENT_IDS.SODIUM,
		};
		delete normalizedGoals[LEGACY_SODIUM_NUTRIENT_ID];
	}
	const goalIds = new Set(Object.keys(normalizedGoals).map(Number));
	const normalizedSelected = migrateLegacyNutrientIds(
		Array.isArray(value.selected) ? value.selected : [],
		shouldMigrateLegacySodium,
	).filter((nutrientId) => goalIds.has(Number(nutrientId)));

	return {
		...value,
		foods: (value.foods ?? []).map(normalizeFoodForStorage),
		selected: normalizedSelected,
		options: migrateLegacyNutrientOptions(rawOptions).filter((option) =>
			goalIds.has(Number(option.id)),
		),
		nutrientGoals: normalizedGoals,
		goalBasis: isMixGoalBasis(value.goalBasis) ? value.goalBasis : "per_mix",
		servingGrams: value.servingGrams ?? {},
		servingQuantities: value.servingQuantities ?? {},
		servingUnits: value.servingUnits ?? {},
	};
};

export const readLoadedSavedRecipe = (): LoadedSavedRecipe | null => {
	try {
		const raw = sessionStorage.getItem(
			getScopedStorageKey(LOADED_SAVED_RECIPE_STORAGE_KEY),
		);
		if (!raw) return null;

		const value = JSON.parse(raw) as Partial<LoadedSavedRecipe>;
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

export const writeLoadedSavedRecipe = (recipe: LoadedSavedRecipe) => {
	sessionStorage.setItem(
		getScopedStorageKey(LOADED_SAVED_RECIPE_STORAGE_KEY),
		JSON.stringify(recipe),
	);
};

export const clearLoadedSavedRecipe = () => {
	sessionStorage.removeItem(
		getScopedStorageKey(LOADED_SAVED_RECIPE_STORAGE_KEY),
	);
};

const createSavedRecipe = (input: SavedRecipeInput): SavedRecipe => {
	return {
		...input,
		id: crypto.randomUUID(),
		name: input.name.trim() || "Untitled recipe",
		createdAt: Date.now(),
		foods: input.foods.map(normalizeFoodForStorage),
	};
};

const createUpdatedSavedRecipe = (
	existingRecipe: SavedRecipe,
	input: SavedRecipeInput,
): SavedRecipe => {
	return normalizeSavedRecipe({
		...input,
		id: existingRecipe.id,
		name: input.name.trim() || existingRecipe.name,
		createdAt: existingRecipe.createdAt,
		foods: input.foods.map(normalizeFoodForStorage),
	});
};

export const saveNewSavedRecipe = async (
	input: SavedRecipeInput,
): Promise<SavedRecipeMutationResult> => {
	const recipe = createSavedRecipe(input);
	const cloudResult = await saveCloudSavedRecipeWithResult(recipe);
	if (cloudResult === "duplicate") return { ok: false, reason: "duplicate" };
	if (cloudResult !== "saved") return { ok: false, reason: "unavailable" };

	dispatchSavedRecipesChanged();
	return { ok: true, recipe };
};

export const saveExistingSavedRecipe = async (
	id: string,
	input: SavedRecipeInput,
): Promise<SavedRecipeMutationResult> => {
	const cloudRecipe = await readCloudSavedRecipeById(id);
	const existingRecipe = cloudRecipe ? normalizeSavedRecipe(cloudRecipe) : null;
	if (!existingRecipe) return { ok: false, reason: "missing" };

	const updatedRecipe = createUpdatedSavedRecipe(existingRecipe, input);
	const cloudResult = await saveCloudSavedRecipeWithResult(updatedRecipe);
	if (cloudResult === "duplicate") return { ok: false, reason: "duplicate" };
	if (cloudResult !== "saved") return { ok: false, reason: "unavailable" };

	dispatchSavedRecipesChanged();
	return { ok: true, recipe: updatedRecipe };
};

export const deleteSavedRecipe = async (
	id: string,
	{ notify = true }: SavedRecipeMutationOptions = {},
) => {
	const deleted = await deleteCloudSavedRecipe(id);
	if (!deleted) return false;

	if (notify) dispatchSavedRecipesChanged();
	if (readLoadedSavedRecipe()?.id === id) clearLoadedSavedRecipe();
	return true;
};

export const restoreSavedRecipeToMix = async (recipe: SavedRecipe) => {
	const normalizedRecipe = normalizeSavedRecipe(recipe);
	const listIndex = await readCloudIngredientListIndex();
	if (!listIndex) return false;

	const fridgeIds = new Set(listIndex[MIX_STORAGE_KEYS.fridge].foodIds);
	const shoppingIds = new Set(listIndex[MIX_STORAGE_KEYS.shoppingList].foodIds);
	const foodsMissingFromBothLists = normalizedRecipe.foods.filter(
		(food) => !fridgeIds.has(food.fdcId) && !shoppingIds.has(food.fdcId),
	);

	if (foodsMissingFromBothLists.length > 0) {
		const result = await addFoodsToIngredientList(
			MIX_STORAGE_KEYS.shoppingList,
			foodsMissingFromBothLists,
		);
		if (result === "error") return false;
	}

	const servingAmounts = normalizedRecipe.foods.map((food) => {
		const defaultServing = getDefaultServingAmount(food);
		return {
			foodId: food.fdcId,
			quantity:
				normalizedRecipe.servingQuantities[food.fdcId] ??
				normalizedRecipe.servingGrams[food.fdcId] ??
				defaultServing.quantity,
			unit:
				normalizedRecipe.servingUnits[food.fdcId] ??
				(normalizedRecipe.servingGrams[food.fdcId] !== undefined
					? "g"
					: defaultServing.unit),
		};
	});
	const mixState = {
		selected: normalizedRecipe.selected,
		options: normalizedRecipe.options,
		selectedFoodIds: normalizedRecipe.foods.map((food) => food.fdcId),
		servingGrams: normalizedRecipe.servingGrams,
		servingQuantities: Object.fromEntries(
			servingAmounts.map(({ foodId, quantity }) => [foodId, quantity]),
		),
		servingUnits: Object.fromEntries(
			servingAmounts.map(({ foodId, unit }) => [foodId, unit]),
		),
	};

	const persistedMixState = writeStoredMixState(mixState);
	const [mixSaved, goalsSaved] = await Promise.all([
		saveCloudMixPreferences({ mixState: persistedMixState }),
		saveCloudMixGoalConfiguration({
			goals: normalizedRecipe.nutrientGoals,
			goalBasis: normalizedRecipe.goalBasis,
			sourceTemplateVersionId: null,
			sourceUserTemplateId: null,
			templateCustomized: true,
		}),
	]);
	if (!mixSaved || !goalsSaved) return false;
	writeLoadedSavedRecipe({
		id: normalizedRecipe.id,
		name: normalizedRecipe.name,
		isDirty: false,
	});
	return true;
};
