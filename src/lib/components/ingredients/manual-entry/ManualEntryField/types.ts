import type { Snippet } from "svelte";

export type ManualEntryFieldProps = {
	forId: string;
	label: string;
	optional?: boolean;
	required?: boolean;
	children: Snippet;
};
