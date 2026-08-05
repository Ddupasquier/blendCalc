import type { FdcFood } from "$lib/utils/food/types";

export type MixIngredientOptionProps = {
	food: FdcFood;
	selected: boolean;
	onSelect: () => void;
};
