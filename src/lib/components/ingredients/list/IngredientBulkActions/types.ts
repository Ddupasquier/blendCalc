export type IngredientBulkActionsProps = {
	selectedCount: number;
	moveTargetLabel: string;
	moving?: boolean;
	onSelectAll: () => void;
	onClear: () => void;
	onMove: () => void;
};
