import type { Snippet } from "svelte";

export type ProfileSettingsSheetLauncherProps = {
	title: string;
	description: string;
	controls: string;
	icon: Snippet;
	onOpen: () => void;
};
