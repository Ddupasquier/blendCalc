export type MoveItemPromptProps = {
	message: string;
	onConfirm: () => void;
	onCancel: () => void;
	busy?: boolean;
};
