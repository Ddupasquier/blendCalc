import type { Snippet } from "svelte";

export type ProfileSettingsSectionProps = {
	title: string;
	description: string;
	tutorialTarget?: string;
	children: Snippet;
};
