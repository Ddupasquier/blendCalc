import type { Snippet } from "svelte";
export type PublicPageShellProps = {
	children: Snippet;
	next?: string;
	variant?: "default" | "landing";
};
