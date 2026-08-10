import type { Snippet } from "svelte";

export type PrivilegedActionGroupProps = {
	title?: string;
	class?: string;
	children: Snippet;
};
