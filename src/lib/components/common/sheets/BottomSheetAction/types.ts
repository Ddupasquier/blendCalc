import type { Snippet } from "svelte";

export type BottomSheetActionProps = {
	label: string;
	variant?: "default" | "move" | "danger";
	disabled?: boolean;
	privileged?: boolean;
	icon?: Snippet;
	onSelect: () => void;
};
