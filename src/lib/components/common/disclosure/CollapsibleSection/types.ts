import type { Snippet } from "svelte";

export type CollapsibleSectionProps = {
	title: string;
	titleId?: string;
	badge?: string;
	open?: boolean;
	class?: string;
	summaryEnd?: Snippet;
	children: Snippet;
};
