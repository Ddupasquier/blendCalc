import type { FoodItem } from "$lib/utils/food/types";

export type NutritionServingSelectProps = {
	food: FoodItem;
	viewingGrams: number;
	onSelect: (gramWeight: number) => void;
};
