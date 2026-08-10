import type { Snippet } from "svelte";

export type StatusMessageTone = "info" | "success" | "warning" | "danger";
export type StatusMessageIconPlacement = "start" | "top-end";

export type StatusMessageProps = {
	tone?: StatusMessageTone;
	iconPlacement?: StatusMessageIconPlacement;
	title?: string;
	message?: string;
	children?: Snippet;
};
