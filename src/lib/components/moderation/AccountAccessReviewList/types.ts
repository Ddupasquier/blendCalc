import type { ModerationWorkspaceData } from "$lib/server/moderation/moderationWorkspace.server";

export type AccountAccessReviewListProps = {
	users: ModerationWorkspaceData["users"];
	query: string;
	totalCount: number;
	viewerUserId: string;
	viewerRole: ModerationWorkspaceData["viewerRole"];
	searchPath: string;
	showHeading?: boolean;
};
