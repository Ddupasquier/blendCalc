import type { FdcFood } from "$lib/utils/food/types";
import type { IngredientProvenanceOption } from "$lib/utils/ingredients/ingredientProvenance";

export type SavedIngredientCardProps = {
	food: FdcFood;
	active?: boolean;
	checked?: boolean;
	selectionMode?: boolean;
	moving?: boolean;
	removing?: boolean;
	moveDirection: "left" | "right";
	moveLabel: string;
	category: string;
	warning?: string | null;
	provenanceOptions?: readonly IngredientProvenanceOption[];
	onToggle: () => void;
	onEnterSelection: () => void;
	onPreview: () => void;
	onMove: () => void;
	onActions: () => void;
	onRemove: () => void;
};
