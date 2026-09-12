import type { Snippet } from "svelte";

export type RightSheetProps = {
	id?: string;
	open?: boolean;
	labelledby: string;
	className?: string;
	panelClass?: string;
	onClose?: () => void;
	children: Snippet;
};
