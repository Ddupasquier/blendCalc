import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";
import type { IngredientListKey } from "$lib/utils/storage/client/ingredientLists";

export type SearchDropdownProps = {
	results: FoodItem[];
	activeResultIndex?: number;
	addingFoodId?: number | null;
	hasMoreResults?: boolean;
	loadingMore?: boolean;
	contentVersion?: string | number;
	destinationListKey?: IngredientListKey;
	destinationListFoodIdentityKeys?: ReadonlySet<string>;
	otherListFoodIdentityKeys?: ReadonlySet<string>;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	onSelect: (food: FoodItem) => void;
	onAdd?: (food: FoodItem) => void | Promise<void>;
	onActivate?: (index: number) => void;
	onLoadMore?: () => void | Promise<void>;
};
