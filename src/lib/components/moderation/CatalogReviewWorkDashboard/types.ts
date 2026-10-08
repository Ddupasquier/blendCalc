import type { CatalogReviewWorkSummary } from "$lib/utils/moderation/catalogReviewWork";
import type { Snippet } from "svelte";

export type CatalogReviewWorkDashboardProps = {
	reviewWork: CatalogReviewWorkSummary;
	hideConflicts?: boolean;
	hideHeading?: boolean;
	visibleQueue?: "all" | "safetyMatches" | "providerChanges";
	refreshing?: boolean;
	safetyControls?: Snippet;
	providerControls?: Snippet;
};
