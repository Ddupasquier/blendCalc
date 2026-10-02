import type { FoodItem } from "$lib/utils/food/types";

export type SavedIngredientCardProps = {
	food: FoodItem;
	active?: boolean;
	checked?: boolean;
	selectionMode?: boolean;
	moving?: boolean;
	removing?: boolean;
	moveDirection: "left" | "right";
	moveLabel: string;
	category: string;
	warning?: string | null;
	tutorialCardTarget?: string;
	tutorialActionsTarget?: string;
	onToggle: () => void;
	onEnterSelection: () => void;
	onPreview: () => void;
	onMove: () => void;
	onActions: () => void;
	onRemove: () => void;
};
