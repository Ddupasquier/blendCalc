import type { Snippet } from "svelte";
export type ActionLinkProps = {
	href: string;
	variant?: "primary" | "secondary";
	children: Snippet;
};
