import type { ModerationWorkspaceData } from "$lib/server/moderation/moderationWorkspace.server";

export type ModerationWorkspaceScope =
	| "all"
	| "product-submissions"
	| "food-warning-reports"
	| "profile-images"
	| "account-access";

export type ModerationWorkspaceForm = {
	moderationError?: string;
	moderationWarning?: string;
	moderationSuccess?: string;
	productReviewError?: string;
	productReviewSuccess?: string;
	compatibilityReviewError?: string;
	compatibilityReviewSuccess?: string;
} | null;

export type ModerationWorkspaceProps = {
	data: ModerationWorkspaceData;
	form?: ModerationWorkspaceForm;
	scope?: ModerationWorkspaceScope;
};
