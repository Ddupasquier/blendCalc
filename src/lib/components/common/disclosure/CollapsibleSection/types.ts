import type { Snippet } from "svelte";

export type CollapsibleSectionSurface = "accent" | "panel";
export type CollapsibleSectionTone = "neutral" | "warning" | "danger";

export type CollapsibleSectionProps = {
	title: string;
	titleId?: string;
	badge?: string;
	open?: boolean;
	surface?: CollapsibleSectionSurface;
	tone?: CollapsibleSectionTone;
	class?: string;
	onOpenChange?: (open: boolean) => void;
	summaryEnd?: Snippet;
	children: Snippet;
};
