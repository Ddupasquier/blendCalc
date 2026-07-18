import type { Snippet } from "svelte";
import type { FdcFood } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type IngredientSearchTriggerProps = {
	label?: string;
	onOpen: () => void;
};

export type IngredientSearchProps = {
	onSelect: (food: FdcFood) => void;
	onAdd?: (food: FdcFood) => void | Promise<void>;
	addingFoodId?: number | null;
	savedFoodIdentityKeys?: ReadonlySet<string>;
	onSearchFocus?: () => void;
	autofocus?: boolean;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	sourceFilter?: string;
	trustFilter?: string;
	actions?: Snippet;
};

export type IngredientSearchViewProps = {
	scanning?: boolean;
	filtersActive?: boolean;
	onSelect: (food: FdcFood) => void;
	onAdd: (food: FdcFood) => void | Promise<void>;
	addingFoodId?: number | null;
	savedFoodIdentityKeys?: ReadonlySet<string>;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	sourceFilter?: string;
	trustFilter?: string;
	onScan: () => void;
	onFilter: () => void;
	onClose: () => void;
};

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
