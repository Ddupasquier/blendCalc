import type { Snippet } from "svelte";

export type ViewTopProps = {
	className?: string;
	compactHidden?: boolean;
	children: Snippet;
};
