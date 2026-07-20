import type { FdcFood } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";
import type { SavedDrink } from "$lib/utils/storage/client/savedDrinks";
import type { CloudSmoothieListIndex } from "$lib/utils/storage/supabase/lists";
import type { CloudMixPreferences } from "$lib/utils/storage/supabase/shared";

export type UserFoodListPage = {
	foods: FdcFood[];
	totalCount: number;
};

export type IngredientPageInitialData = {
	fridge: UserFoodListPage;
	shoppingList: UserFoodListPage;
	customFoods: FdcFood[];
	listIndex: CloudSmoothieListIndex;
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
	drinks: SavedDrink[];
	loadError: string;
};
