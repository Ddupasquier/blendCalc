import type { Snippet } from "svelte";

export type GuestAccessPageShellWidth = "standard" | "wide";

export type GuestAccessPageShellProps = {
	width?: GuestAccessPageShellWidth;
	children: Snippet;
};
