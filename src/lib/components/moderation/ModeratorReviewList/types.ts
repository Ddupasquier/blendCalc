import type { Snippet } from "svelte";

export type ModeratorReviewListProps = {
	label: string;
	itemCount: number;
	singularItemLabel: string;
	pluralItemLabel: string;
	emptyTitle: string;
	emptyDescription: string;
	children: Snippet;
};
