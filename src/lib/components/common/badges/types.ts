import type { Snippet } from "svelte";

export type StatusIconBadgeTone = "warning" | "error";

export type StatusIconBadgeProps = {
	label: string;
	title?: string;
	tone?: StatusIconBadgeTone;
	decorative?: boolean;
	children: Snippet;
};
