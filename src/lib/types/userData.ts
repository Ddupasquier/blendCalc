import type { FdcFood } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";
import type { SavedRecipe } from "$lib/utils/storage/client/savedRecipes";
import type { CloudIngredientListIndex } from "$lib/utils/storage/supabase/lists";
import type { CloudMixPreferences } from "$lib/utils/storage/supabase/shared";

export type UserFoodListPage = {
	foods: FdcFood[];
	totalCount: number;
};

export type IngredientPageInitialData = {
	fridge: UserFoodListPage;
	shoppingList: UserFoodListPage;
	customFoods: FdcFood[];
	routeFood: FdcFood | null;
	listIndex: CloudIngredientListIndex;
	provenanceOptions: IngredientProvenanceOption[];
	loadError: string;
	provenanceError: string;
};

export type MixPageInitialData = {
	fridge: FdcFood[];
	shoppingList: FdcFood[];
	preferences: CloudMixPreferences;
	loadError: string;
};

export type SavedPageInitialData = {
	recipes: SavedRecipe[];
	loadError: string;
};
