import type { ModerationActionFeedback } from "$lib/components/moderation/types";
import type { ModerationWorkspaceData } from "$lib/server/moderation/moderationWorkspace.server";

export type FoodWarningReportReviewListProps = {
	reports: ModerationWorkspaceData["compatibilityFeedback"];
	form?: ModerationActionFeedback;
	showHeading?: boolean;
};
