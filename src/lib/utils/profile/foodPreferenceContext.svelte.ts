import { getContext, setContext } from "svelte";
import type { FoodPreferenceProfile } from "./foodPreferenceProfile";

const FOOD_PREFERENCE_CONTEXT_KEY = Symbol("food-preferences");

export type FoodPreferenceContextValue = {
	current: FoodPreferenceProfile | null;
};

const EMPTY_FOOD_PREFERENCE_CONTEXT: FoodPreferenceContextValue = {
	current: null,
};

export const setFoodPreferenceContext = (
	value: FoodPreferenceContextValue,
) => {
	setContext(FOOD_PREFERENCE_CONTEXT_KEY, value);
	return value;
};

export const getFoodPreferenceContext = () =>
	getContext<FoodPreferenceContextValue | undefined>(
		FOOD_PREFERENCE_CONTEXT_KEY,
	) ?? EMPTY_FOOD_PREFERENCE_CONTEXT;
