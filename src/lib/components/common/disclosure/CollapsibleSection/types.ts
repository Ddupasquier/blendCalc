import type { Snippet } from "svelte";

export type CollapsibleSectionSurface = "accent" | "panel";

export type CollapsibleSectionProps = {
	title: string;
	titleId?: string;
	badge?: string;
	open?: boolean;
	surface?: CollapsibleSectionSurface;
	class?: string;
	summaryEnd?: Snippet;
	children: Snippet;
};
