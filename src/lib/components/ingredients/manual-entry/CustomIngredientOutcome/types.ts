import type { CustomIngredientOutcomeState } from "../formTypes";

export type CustomIngredientOutcomeProps = {
	outcome: CustomIngredientOutcomeState;
	action: "move" | "undo" | null;
	onMoveToShopping: () => void | Promise<void>;
	onMoveToFridge: () => void | Promise<void>;
	onUndo: () => void | Promise<void>;
};
