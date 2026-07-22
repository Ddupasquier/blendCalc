import type { Snippet } from "svelte";

export type StatusMessageTone = "info" | "success" | "warning" | "danger";

export type StatusMessageProps = {
	tone?: StatusMessageTone;
	title?: string;
	children?: Snippet;
};
