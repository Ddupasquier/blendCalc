import type { ModerationActionFeedback } from "$lib/components/moderation/types";
import type { FoodWarningReport } from "$lib/utils/moderation/foodWarningQueuePagination";
export type { FoodWarningReport } from "$lib/utils/moderation/foodWarningQueuePagination";

export type FoodWarningReportReviewListProps = {
	reports: FoodWarningReport[];
	totalCount?: number;
	refreshing?: boolean;
	form?: ModerationActionFeedback;
	showHeading?: boolean;
};

export type StoredWarningFact = {
	label: string;
	factType: string;
	sourceType: string;
	sourceText: string | null;
	confidence: string;
};
