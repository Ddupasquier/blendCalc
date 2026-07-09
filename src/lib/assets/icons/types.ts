import type { FdcFood } from "$lib/utils/food/types";

export type FoodSymbolProps = {
	food: Pick<FdcFood, "description" | "foodCategory" | "image"> &
		Partial<Pick<FdcFood, "brandOwner" | "dataType" | "customFood">>;
	class?: string;
};
