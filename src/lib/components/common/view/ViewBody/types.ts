import type { Snippet } from "svelte";

export type ViewBodyProps = {
	className?: string;
	scroll?: boolean;
	children: Snippet;
};
