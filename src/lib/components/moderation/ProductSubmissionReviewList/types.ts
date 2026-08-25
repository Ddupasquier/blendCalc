import type { ModerationActionFeedback } from "$lib/components/moderation/types";
import type { ModerationWorkspaceData } from "$lib/server/moderation/moderationWorkspace.server";

export type ProductSubmissionReviewListProps = {
	submissions: ModerationWorkspaceData["productSubmissions"];
	form?: ModerationActionFeedback;
	showHeading?: boolean;
};
