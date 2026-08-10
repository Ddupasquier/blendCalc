import type { Snippet } from "svelte";
import type { FoodItem } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type IngredientSearchProps = {
	onSelect: (food: FoodItem) => void;
	onAdd?: (food: FoodItem) => void | Promise<void>;
	addingFoodId?: number | null;
	savedFoodIdentityKeys?: ReadonlySet<string>;
	onSearchFocus?: () => void;
	autofocus?: boolean;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	sourceFilter?: string;
	trustFilter?: string;
	actions?: Snippet;
};
