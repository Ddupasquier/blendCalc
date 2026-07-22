export type IngredientCardActionsProps = {
	description: string;
	removing?: boolean;
	removeArmed?: boolean;
	removeLabel?: string;
	removeMessageId?: string;
	onActions: () => void;
	onRemove: () => void;
};
