import { annotateFoodsWithFoodSafety } from "$lib/server/food-safety/foodSafetyEvaluation.server";
import { getUserFoodSafetyContext } from "$lib/server/food-safety/userFoodSafety.server";
import { readCloudIngredientList } from "$lib/server/user-data/foodLists.server";
import type { MixPageInitialData } from "$lib/types/pageData/mixPageData";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import {
	readCloudMixPreferences,
	type CloudDataContext,
} from "$lib/utils/storage/supabase";

export const loadMixPageData = async (
	cloudDataContext: CloudDataContext,
): Promise<MixPageInitialData> => {
	try {
		const [fridge, shoppingList, preferences, foodSafetyContext] = await Promise.all([
			readCloudIngredientList(MIX_STORAGE_KEYS.fridge, cloudDataContext),
			readCloudIngredientList(MIX_STORAGE_KEYS.shoppingList, cloudDataContext),
			readCloudMixPreferences(cloudDataContext),
			getUserFoodSafetyContext(
				cloudDataContext.supabase,
				cloudDataContext.userId,
			),
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
			foodPreferences: foodSafetyContext.profile,
			loadError: "",
		};
	} catch (error) {
		console.error("[user-data] Mix ingredient data could not load.", error);
		return {
			fridge: [],
			shoppingList: [],
			preferences: {},
			foodPreferences: null,
			loadError: "Your saved ingredient lists could not be loaded. Try again.",
		};
	}
};
