import type { ModerationActionFeedback } from "$lib/components/moderation/types";
import type { FoodWarningQueuePages } from "$lib/utils/moderation/foodWarningQueuePagination";

export type FoodWarningQueuesProps = {
	pages: FoodWarningQueuePages;
	form?: ModerationActionFeedback;
	scrollContainer: HTMLElement | null;
	onTotalsChange?: (totals: { reports: number; followUps: number }) => void;
};
