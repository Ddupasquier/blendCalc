import type { Snippet } from "svelte";

export type ModeratorReviewCardProps = {
	title: string;
	subtitle?: string;
	status?: Snippet;
	children: Snippet;
};
