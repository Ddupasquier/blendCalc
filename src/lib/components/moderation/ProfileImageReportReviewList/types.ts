import type { ModerationWorkspaceForm } from "$lib/components/moderation/ModerationWorkspace/types";
import type { ModerationWorkspaceData } from "$lib/server/moderation/moderationWorkspace.server";

export type ProfileImageReportReviewListProps = {
	reports: ModerationWorkspaceData["profileImageReports"];
	form?: ModerationWorkspaceForm;
	showHeading?: boolean;
};
