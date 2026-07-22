import type { Snippet } from "svelte";

export type CollapsibleSectionProps = {
	title: string;
	badge?: string;
	open?: boolean;
	class?: string;
	summaryEnd?: Snippet;
	children: Snippet;
};
