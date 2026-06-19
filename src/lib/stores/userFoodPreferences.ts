import { writable } from "svelte/store";
import type { FoodPreferenceProfile } from "$lib/utils/profile/foodPreferenceProfile";

export const userFoodPreferences = writable<FoodPreferenceProfile | null>(null);
