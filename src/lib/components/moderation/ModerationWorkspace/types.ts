import type { ModerationWorkspaceData } from "$lib/server/moderation/moderationWorkspace.server";
import type { ModerationActionFeedback } from "$lib/components/moderation/types";

export type ModerationWorkspaceScope =
	| "all"
	| "product-submissions"
	| "food-warning-reports"
	| "profile-images"
	| "account-access";

export type ModerationWorkspaceProps = {
	data: ModerationWorkspaceData;
	form?: ModerationActionFeedback;
	scope?: ModerationWorkspaceScope;
};
