import type { FoodItem } from "$lib/utils/food/types";
import type { FoodSafetyFilter } from "$lib/utils/food/safety/foodSafetyFilters";
export type FavoriteFoodsListProps = {
	query: string;
	sort: string;
	safety: FoodSafetyFilter;
	onPreview: (food: FoodItem) => void;
};
