import type { CatalogReviewWorkSummary } from "$lib/utils/moderation/catalogReviewWork";

export type CatalogReviewWorkDashboardProps = {
	reviewWork: CatalogReviewWorkSummary;
	hideConflicts?: boolean;
	hideHeading?: boolean;
};
