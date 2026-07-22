import type {
	IngredientFilterApplyPayload,
	IngredientSortOption,
} from "$lib/components/ingredients/sheets/types";
import type { FoodListSort } from "$lib/utils/list/listNavigation";

export type IngredientFilterSheetProps = {
	open: boolean;
	query: string;
	sortValue: FoodListSort | string;
	sortOptions: readonly IngredientSortOption[];
	loading?: boolean;
	onApply: (filters: IngredientFilterApplyPayload) => void;
	onClose: () => void;
};
