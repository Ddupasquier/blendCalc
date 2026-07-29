import type { Snippet } from "svelte";

export type MetadataPillTone =
	| "soft"
	| "neutral"
	| "success"
	| "warning"
	| "danger";

export type MetadataPillProps = {
	label: string;
	value?: string;
	ariaLabel?: string;
	title?: string;
	tone?: MetadataPillTone;
	class?: string;
	leading?: Snippet;
	trailing?: Snippet;
};
