import type { Snippet } from "svelte";

export type ViewBodyProps = {
	className?: string;
	scroll?: boolean;
	element?: HTMLElement | null;
	children: Snippet;
};
