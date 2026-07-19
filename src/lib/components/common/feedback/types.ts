import type { Snippet } from "svelte";

export type StatusMessageTone = "info" | "success" | "warning" | "danger";

export type StatusMessageProps = {
	tone?: StatusMessageTone;
	title?: string;
	children?: Snippet;
};

export type LoadingSpinnerSize = "small" | "medium" | "large";

export type LoadingSpinnerProps = {
	size?: LoadingSpinnerSize;
	label?: string;
	showLabel?: boolean;
	decorative?: boolean;
	class?: string;
};
