import type { FdcFood } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type SearchDropdownProps = {
	results: FdcFood[];
	activeResultIndex?: number;
	addingFoodId?: number | null;
	hasMoreResults?: boolean;
	loadingMore?: boolean;
	contentVersion?: string | number;
	savedFoodIdentityKeys?: ReadonlySet<string>;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	onSelect: (food: FdcFood) => void;
	onAdd?: (food: FdcFood) => void | Promise<void>;
	onActivate?: (index: number) => void;
	onLoadMore?: () => void | Promise<void>;
};
