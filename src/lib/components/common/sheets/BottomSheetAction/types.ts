import type { Snippet } from "svelte";

export type BottomSheetActionProps = {
	label: string;
	description?: string;
	actionRequiredCount?: number;
	actionRequiredLabel?: string;
	variant?: "default" | "move" | "danger";
	disabled?: boolean;
	icon?: Snippet;
	onSelect: () => void;
};
