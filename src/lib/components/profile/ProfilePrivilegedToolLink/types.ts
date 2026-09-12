import type { Snippet } from "svelte";

export type ProfilePrivilegedToolLinkProps = {
	href: string;
	label: string;
	description: string;
	actionRequiredCount?: number;
	actionRequiredLabel?: string;
	icon: Snippet;
};
