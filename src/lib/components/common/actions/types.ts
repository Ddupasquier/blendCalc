import type { Snippet } from "svelte";

export type TwoStepConfirmationControl = {
	armed: boolean;
	activate: () => void;
	label: string;
	messageId: string;
};

export type TwoStepConfirmationProps = {
	actionLabel: string;
	confirmationLabel: string;
	message: string;
	messageId: string;
	disabled?: boolean;
	onConfirm: () => void;
	children: Snippet<[TwoStepConfirmationControl]>;
};
