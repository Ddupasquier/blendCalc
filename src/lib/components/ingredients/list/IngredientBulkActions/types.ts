export type IngredientBulkActionsProps = {
	selectionMode: boolean;
	selectedCount: number;
	selectableCount: number;
	moveTargetLabel: string;
	moving?: boolean;
	onEnterSelection: () => void;
	onSelectAll: () => void;
	onCancel: () => void;
	onMove: () => void;
};
