import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";
import type { IngredientListPage } from "$lib/utils/ingredients/ingredientListPage";
import type { CloudIngredientListIndex } from "$lib/utils/storage/supabase/lists";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

export type IngredientPageInitialData = {
	fridge: IngredientListPage;
	shoppingList: IngredientListPage;
	customFoods: FoodItem[];
	routeFood: FoodItem | null;
	listIndex: CloudIngredientListIndex;
	provenanceOptions: IngredientProvenanceOption[];
	initialListKey: IngredientListKey;
	deferredDataPending: boolean;
	loadError: string;
	provenanceError: string;
};

export type IngredientPageSupportingData = {
	customFoods: FoodItem[];
	listIndex: CloudIngredientListIndex;
	provenanceOptions: IngredientProvenanceOption[];
};
