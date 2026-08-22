import type { ModerationWorkspaceForm } from "$lib/components/moderation/ModerationWorkspace/types";
import type { ModerationWorkspaceData } from "$lib/server/moderation/moderationWorkspace.server";

export type ProductSubmissionReviewListProps = {
	submissions: ModerationWorkspaceData["productSubmissions"];
	form?: ModerationWorkspaceForm;
	showHeading?: boolean;
};
