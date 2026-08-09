import type { FoodItem } from "$lib/utils/food/types";
import type { CloudMixPreferences } from "$lib/utils/storage/supabase/shared";

export type MixPageInitialData = {
	fridge: FoodItem[];
	shoppingList: FoodItem[];
	preferences: CloudMixPreferences;
	loadError: string;
};
