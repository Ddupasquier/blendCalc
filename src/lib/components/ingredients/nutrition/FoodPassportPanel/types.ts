import type { FoodItem } from "$lib/utils/food/types";
import type { Snippet } from "svelte";

export type FoodPassportPanelProps = {
	food: FoodItem;
	children?: Snippet;
};
