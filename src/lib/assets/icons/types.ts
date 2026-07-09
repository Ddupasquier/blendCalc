import type { FdcFood } from "$lib/utils/food/types";

export type FoodSymbolProps = {
	food: Pick<FdcFood, "description" | "foodCategory" | "image">;
	class?: string;
};
