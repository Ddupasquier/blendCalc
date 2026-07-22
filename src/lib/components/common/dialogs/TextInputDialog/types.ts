import type { Snippet } from "svelte";

export type TextInputDialogProps = {
	open?: boolean;
	title: string;
	description?: string;
	label: string;
	placeholder?: string;
	confirmLabel?: string;
	secondaryConfirmLabel?: string;
	cancelLabel?: string;
	initialValue?: string;
	error?: string;
	busy?: boolean;
	children?: Snippet;
	onConfirm: (value: string) => void | Promise<void>;
	onSecondaryConfirm?: (value: string) => void | Promise<void>;
	onValueChange?: (value: string) => void;
	onCancel: () => void;
};
