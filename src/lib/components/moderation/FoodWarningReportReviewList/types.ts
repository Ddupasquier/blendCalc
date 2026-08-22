import type { ModerationWorkspaceForm } from "$lib/components/moderation/ModerationWorkspace/types";
import type { ModerationWorkspaceData } from "$lib/server/moderation/moderationWorkspace.server";

export type FoodWarningReportReviewListProps = {
	reports: ModerationWorkspaceData["compatibilityFeedback"];
	form?: ModerationWorkspaceForm;
	showHeading?: boolean;
};
