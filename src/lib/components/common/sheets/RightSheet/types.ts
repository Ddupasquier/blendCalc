import type { Snippet } from "svelte";

export type RightSheetProps = {
	open?: boolean;
	labelledby: string;
	onClose?: () => void;
	children: Snippet;
};
