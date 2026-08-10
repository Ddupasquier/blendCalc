import type { Snippet } from "svelte";

export type ManualEntryToggleRowProps = {
	title: string;
	description: string;
	disabled?: boolean;
	children: Snippet;
};
