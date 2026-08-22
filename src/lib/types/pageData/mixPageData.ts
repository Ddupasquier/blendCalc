import type { FoodItem } from "$lib/utils/food/types";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";
import type { CloudMixPreferences } from "$lib/utils/storage/supabase/shared";

export type MixPageInitialData = {
	fridge: FoodItem[];
	shoppingList: FoodItem[];
	preferences: CloudMixPreferences;
	foodPreferences: FoodPreferenceProfile | null;
	loadError: string;
};
