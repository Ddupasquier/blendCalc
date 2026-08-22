import type { Snippet } from "svelte";

export type ModeratorActionRightSheetProps = {
	id: string;
	title: string;
	subtitle: string;
	onClose: () => void;
	children: Snippet;
};
