import type { Snippet } from "svelte";

export type SettingsSelectionRowProps = {
	title: string;
	description?: string;
	class?: string;
	status?: Snippet;
	actions?: Snippet;
};
