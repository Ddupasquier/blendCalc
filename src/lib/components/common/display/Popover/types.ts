import type { Snippet } from "svelte";

export type PopoverProps = {
	open: boolean;
	buttonLabel?: string;
	title?: string;
	children?: Snippet;
	onOpen: () => void;
	onClose: () => void;
};
