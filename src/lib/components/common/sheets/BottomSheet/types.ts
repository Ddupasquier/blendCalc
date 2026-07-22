import type { Snippet } from "svelte";

export type BottomSheetProps = {
	open: boolean;
	title?: string;
	titleId?: string;
	label?: string;
	backLabel?: string;
	showBack?: boolean;
	aboveNav?: boolean;
	fill?: boolean;
	comfortable?: boolean;
	children: Snippet;
	onClose: () => void;
};
