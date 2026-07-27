import { LIST_PAGE_SIZES } from "$lib/config/listPagination";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type {
	IngredientPageInitialData,
	MixPageInitialData,
	SavedPageInitialData,
} from "$lib/types/userData";
import { readIngredientProvenanceOptions } from "$lib/utils/ingredients/ingredientProvenance";
import type { SmoothieListKey } from "$lib/utils/storage/client/smoothieLists";
import {
	readCloudCustomFoods,
	readCloudMixPreferences,
	readCloudSavedDrinks,
	readCloudSmoothieListIndex,
	type CloudDataContext,
	type CloudSmoothieListIndex,
} from "$lib/utils/storage/supabase";
import {
	readCloudSmoothieList,
	readCloudSmoothieListPage,
} from "$lib/server/user-data/foodLists.server";
import {
	annotateFoodsWithFoodSafety,
	type FoodSafetyEvaluationContext,
} from "$lib/server/food-safety/foodSafetyEvaluation.server";
import { getUserFoodSafetyContext } from "$lib/server/food-safety/userFoodSafety.server";

const emptyListIndex = (): CloudSmoothieListIndex => ({
	[MIX_STORAGE_KEYS.fridge]: { foodIds: [], foodIdentityKeys: [] },
	[MIX_STORAGE_KEYS.shoppingList]: { foodIds: [], foodIdentityKeys: [] },
});

const annotateListPage = (
	page: NonNullable<Awaited<ReturnType<typeof readCloudSmoothieListPage>>>,
	context: FoodSafetyEvaluationContext,
) => ({
	...page,
	foods: annotateFoodsWithFoodSafety(page.foods, context),
});

const readInitialListPage = (
	context: CloudDataContext,
	key: SmoothieListKey,
) =>
	readCloudSmoothieListPage(
		key,
		{
			limit: LIST_PAGE_SIZES.ingredientPills,
			offset: 0,
			sort: "recent",
			sourceFilter: "all",
			trustFilter: "any",
		},
		context,
	);

export const loadIngredientPageData = async (
	context: CloudDataContext,
): Promise<IngredientPageInitialData> => {
	try {
		const [
			fridge,
			shoppingList,
			customFoods,
			listIndex,
			provenanceOptions,
			foodSafetyContext,
		] =
			await Promise.all([
				readInitialListPage(context, MIX_STORAGE_KEYS.fridge),
				readInitialListPage(context, MIX_STORAGE_KEYS.shoppingList),
				readCloudCustomFoods(context),
				readCloudSmoothieListIndex(context),
				readIngredientProvenanceOptions(context.supabase),
				getUserFoodSafetyContext(context.supabase, context.userId),
			]);

		if (!fridge || !shoppingList || !customFoods || !listIndex) {
			throw new Error("Authenticated ingredient data was unavailable.");
		}

		return {
			fridge: annotateListPage(fridge, foodSafetyContext),
			shoppingList: annotateListPage(shoppingList, foodSafetyContext),
			customFoods: annotateFoodsWithFoodSafety(
				customFoods,
				foodSafetyContext,
			),
			listIndex,
			provenanceOptions: provenanceOptions ?? [],
			loadError: "",
			provenanceError: provenanceOptions?.length
				? ""
				: "Ingredient source and review filters could not load. Try again after refreshing.",
		};
	} catch (error) {
		console.error("[user-data] Ingredient page data could not load.", error);
		return {
			fridge: { foods: [], totalCount: 0 },
			shoppingList: { foods: [], totalCount: 0 },
			customFoods: [],
			listIndex: emptyListIndex(),
			provenanceOptions: [],
			loadError: "Saved ingredients could not be loaded. Try again.",
			provenanceError: "",
		};
	}
};

export const loadMixPageData = async (
	context: CloudDataContext,
): Promise<MixPageInitialData> => {
	try {
		const [fridge, shoppingList, preferences, foodSafetyContext] = await Promise.all([
			readCloudSmoothieList(MIX_STORAGE_KEYS.fridge, context),
			readCloudSmoothieList(MIX_STORAGE_KEYS.shoppingList, context),
			readCloudMixPreferences(context),
			getUserFoodSafetyContext(context.supabase, context.userId),
		]);
		if (!fridge || !shoppingList || !preferences) {
			throw new Error("Authenticated ingredient lists were unavailable.");
		}
		return {
			fridge: annotateFoodsWithFoodSafety(fridge, foodSafetyContext),
			shoppingList: annotateFoodsWithFoodSafety(
				shoppingList,
				foodSafetyContext,
			),
			preferences,
			loadError: "",
		};
	} catch (error) {
		console.error("[user-data] Mix ingredient data could not load.", error);
		return {
			fridge: [],
			shoppingList: [],
			preferences: {},
			loadError: "Your saved ingredient lists could not be loaded. Try again.",
		};
	}
};

export const loadSavedPageData = async (
	context: CloudDataContext,
): Promise<SavedPageInitialData> => {
	try {
		const drinks = await readCloudSavedDrinks(context);
		if (!drinks) throw new Error("Authenticated saved drinks were unavailable.");
		return { drinks, loadError: "" };
	} catch (error) {
		console.error("[user-data] Saved drink data could not load.", error);
		return {
			drinks: [],
			loadError: "Your saved drinks could not be loaded. Try again.",
		};
	}
};
