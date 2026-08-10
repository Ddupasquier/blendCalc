import type { FoodItem } from "$lib/utils/food/types";

export type FoodSymbolProps = {
	food: Pick<FoodItem, "description" | "image"> &
		Partial<
			Pick<
				FoodItem,
				"symbolKey" | "foodCategory" | "brandedFoodCategory" | "categories"
			>
		>;
	fallbackOnly?: boolean;
	class?: string;
};
