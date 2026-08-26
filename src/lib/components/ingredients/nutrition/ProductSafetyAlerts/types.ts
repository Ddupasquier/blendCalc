import type { FoodItem, FoodSafetyAlert } from "$lib/utils/food/types";

export type ProductSafetyAlertsProps = {
	food?: FoodItem;
	alerts?: FoodSafetyAlert[];
};
