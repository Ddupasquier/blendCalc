export type IngredientActionSheetProps = {
	open: boolean;
	title: string;
	removeLabel: string;
	removing?: boolean;
	canAdjustImagePlacement?: boolean;
	onClose: () => void;
	onAdjustImagePlacement?: () => void;
	onRename: () => void;
	onRemove: () => void;
};
