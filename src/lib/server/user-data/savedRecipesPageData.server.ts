import type { SavedRecipesPageInitialData } from "$lib/types/pageData/savedRecipesPageData";
import {
	readCloudSavedRecipes,
	type CloudDataContext,
} from "$lib/utils/storage/supabase";
import { getUserFoodSafetyContext } from "$lib/server/food-safety/userFoodSafety.server";
import { annotateFoodsWithFoodSafety } from "$lib/server/food-safety/foodSafetyEvaluation.server";
import { hydrateFoodsWithCachedImages } from "$lib/utils/storage/supabase/foodImages";

export const loadSavedRecipesPageData = async (
	cloudDataContext: CloudDataContext,
): Promise<SavedRecipesPageInitialData> => {
	try {
		const [savedRecipes, foodSafetyContext] = await Promise.all([
			readCloudSavedRecipes(cloudDataContext),
			getUserFoodSafetyContext(
				cloudDataContext.supabase,
				cloudDataContext.userId,
			),
		]);
		if (!savedRecipes) {
			throw new Error("Authenticated saved recipes were unavailable.");
		}
		const foodsWithImages = await hydrateFoodsWithCachedImages(
			cloudDataContext.supabase,
			savedRecipes.flatMap((recipe) => recipe.foods),
		);
		let foodOffset = 0;
		return {
			recipes: savedRecipes.map((recipe) => {
				const foods = foodsWithImages.slice(
					foodOffset,
					foodOffset + recipe.foods.length,
				);
				foodOffset += recipe.foods.length;
				return {
					...recipe,
					foods: annotateFoodsWithFoodSafety(foods, foodSafetyContext),
				};
			}),
			loadError: "",
		};
	} catch (error) {
		console.error("[user-data] Saved recipe data could not load.", error);
		return {
			recipes: [],
			loadError: "Your saved recipes could not be loaded. Try again.",
		};
	}
};
