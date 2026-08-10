import type { Snippet } from "svelte";

export type ProfileSettingsSheetLauncherProps = {
	title: string;
	description: string;
	controls: string;
	actionRequiredCount?: number;
	actionRequiredLabel?: string;
	variant?: "default" | "privileged";
	icon: Snippet;
	onOpen: () => void;
};
