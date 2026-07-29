import type { FdcFood } from "$lib/utils/food/types";

export type FoodSymbolProps = {
	food: Pick<FdcFood, "description" | "image"> &
		Partial<
			Pick<
				FdcFood,
				"symbolKey" | "foodCategory" | "brandedFoodCategory" | "categories"
			>
		>;
	fallbackOnly?: boolean;
	class?: string;
};
