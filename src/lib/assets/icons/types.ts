import type { FdcFood } from "$lib/utils/food/types";

export type BasicIconProps = {
	class?: string;
	size?: number | string;
	strokeWidth?: number | string;
	title?: string;
};

export type ChevronDirection = "up" | "right" | "down" | "left";

export type ChevronProps = BasicIconProps & {
	direction?: ChevronDirection;
};

export type FoodSymbolProps = {
	food: Pick<FdcFood, "description" | "image"> &
		Partial<
			Pick<
				FdcFood,
				"symbolKey" | "foodCategory" | "brandedFoodCategory" | "categories"
			>
		>;
	class?: string;
};
