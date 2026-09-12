import type { Snippet } from "svelte";

export type ViewFrameProps = {
	appShell?: boolean;
	className?: string;
	fullWidth?: boolean;
	children: Snippet;
};
