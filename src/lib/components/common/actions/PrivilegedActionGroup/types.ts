import type { Snippet } from "svelte";

export type PrivilegedActionGroupProps = {
	title?: string;
	showHeader?: boolean;
	class?: string;
	children: Snippet;
};
