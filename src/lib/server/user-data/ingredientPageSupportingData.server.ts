import { annotateFoodsWithFoodSafety } from "$lib/server/food-safety/foodSafetyEvaluation.server";
import { getUserFoodSafetyContext } from "$lib/server/food-safety/userFoodSafety.server";
import type { IngredientPageSupportingData } from "$lib/types/pageData/ingredientPageData";
import { readIngredientProvenanceOptions } from "$lib/utils/ingredients/ingredientProvenance";
import {
	readCloudCustomFoods,
	readCloudIngredientListIndex,
	type CloudDataContext,
} from "$lib/utils/storage/supabase";

export const readIngredientPageSupportingData = async (
	cloudDataContext: CloudDataContext,
): Promise<IngredientPageSupportingData> => {
	const [customFoods, listIndex, provenanceOptions, foodSafetyContext] =
		await Promise.all([
			readCloudCustomFoods(cloudDataContext),
			readCloudIngredientListIndex(cloudDataContext),
			readIngredientProvenanceOptions(cloudDataContext.supabase),
			getUserFoodSafetyContext(
				cloudDataContext.supabase,
				cloudDataContext.userId,
			),
		]);

	if (!customFoods || !listIndex || !provenanceOptions) {
		throw new Error("Ingredient supporting data was unavailable.");
	}

	return {
		customFoods: annotateFoodsWithFoodSafety(customFoods, foodSafetyContext),
		listIndex,
		provenanceOptions,
	};
};
