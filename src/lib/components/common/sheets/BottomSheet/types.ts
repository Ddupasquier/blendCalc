import type { Snippet } from "svelte";

export type BottomSheetProps = {
	id?: string;
	open: boolean;
	title?: string;
	titleId?: string;
	label?: string;
	aboveNav?: boolean;
	fill?: boolean;
	comfortable?: boolean;
	children: Snippet;
	onClose: () => void;
};
