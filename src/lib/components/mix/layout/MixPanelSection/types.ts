import type { Snippet } from "svelte";

export type MixPanelAttentionTone = "neutral" | "warning" | "danger";

export type MixPanelSectionProps = {
	title: string;
	titleId?: string;
	badge?: string;
	open?: boolean;
	attentionTone?: MixPanelAttentionTone;
	class?: string;
	ariaLabel?: string;
	dataTutorialTarget?: string;
	onOpenChange?: (open: boolean) => void;
	summaryEnd?: Snippet;
	children: Snippet;
};
