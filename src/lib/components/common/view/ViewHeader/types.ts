import type { Snippet } from "svelte";

export type ViewHeaderProps = {
	title: string;
	subtitle?: string;
	titleId?: string;
	children?: Snippet;
};
