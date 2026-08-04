export type MixOptionsSheetProps = {
	open: boolean;
	canResetGoals: boolean;
	canClearIngredients: boolean;
	canResetAll: boolean;
	onClose: () => void;
	onReorganize: () => void;
	onResetGoals: () => void;
	onClearIngredients: () => void;
	onResetAll: () => void;
};
