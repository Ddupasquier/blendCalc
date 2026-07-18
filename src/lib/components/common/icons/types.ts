import type { Snippet } from "svelte";

export type CenteredIconProps = {
	class?: string;
	children?: Snippet;
};

export type CircularIconFrameProps = {
	class?: string;
	label?: string;
	title?: string;
	decorative?: boolean;
	dataTone?: string;
	children?: Snippet;
};
