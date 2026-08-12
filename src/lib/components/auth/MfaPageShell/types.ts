import type { Snippet } from "svelte";

export type MfaPageShellProps = {
	eyebrow: string;
	title: string;
	description: string;
	children: Snippet;
};
