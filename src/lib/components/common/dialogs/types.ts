export type ConfirmationDialogProps = {
	open: boolean;
	title: string;
	description: string;
	confirmLabel?: string;
	cancelLabel?: string;
	busy?: boolean;
	danger?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
};
