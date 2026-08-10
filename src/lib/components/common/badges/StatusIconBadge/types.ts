import type { Snippet } from "svelte";

export type StatusIconBadgeTone = "info" | "success" | "warning" | "error";

export type StatusIconBadgeProps = {
	label: string;
	title?: string;
	tone?: StatusIconBadgeTone;
	decorative?: boolean;
	class?: string;
	children: Snippet;
};
