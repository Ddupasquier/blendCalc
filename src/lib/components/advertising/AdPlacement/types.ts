import type { Snippet } from "svelte";
import type { AdFormat } from "$lib/utils/advertising/adPolicy";

export type AdPlacementProps = {
	format?: AdFormat;
	children: Snippet;
	ondismiss?: () => void;
};
