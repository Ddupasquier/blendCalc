import type { ModerationActionFeedback } from "$lib/components/moderation/types";
import type { ModerationWorkspaceData } from "$lib/server/moderation/moderationWorkspace.server";

export type ProfileImageReportReviewListProps = {
	reports: ModerationWorkspaceData["profileImageReports"];
	form?: ModerationActionFeedback;
	showHeading?: boolean;
};
