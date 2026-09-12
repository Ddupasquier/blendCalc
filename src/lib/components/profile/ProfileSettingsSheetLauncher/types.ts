import type { Snippet } from "svelte";

export type ProfileSettingsSheetLauncherProps = {
	title: string;
	description: string;
	actionRequiredCount?: number;
	actionRequiredLabel?: string;
	variant?: "default" | "privileged";
	icon: Snippet;
} & (
	| {
			href: string;
			controls?: never;
			onOpen?: never;
	  }
	| {
			href?: never;
			controls: string;
			onOpen: () => void;
	  }
);
