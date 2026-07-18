import type { FdcFood } from "$lib/utils/food/types";

export type BasicIconProps = {
	class?: string;
	size?: number | string;
	strokeWidth?: number | string;
	title?: string;
};

export type FoodSymbolProps = {
	food: Pick<FdcFood, "description" | "foodCategory" | "image"> &
		Partial<Pick<FdcFood, "brandOwner" | "dataType" | "customFood">>;
	class?: string;
};
