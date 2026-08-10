import type { Snippet } from "svelte";

export type InputLoadingControlKind = "input" | "select";

export type InputLoadingFrameProps = {
	loading?: boolean;
	loadingLabel?: string;
	controlKind?: InputLoadingControlKind;
	children: Snippet;
};
