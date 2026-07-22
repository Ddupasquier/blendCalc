import type { FdcFood } from "$lib/utils/food/types";

export type NutritionServingSelectProps = {
	food: FdcFood;
	viewingGrams: number;
	onSelect: (gramWeight: number) => void;
};
