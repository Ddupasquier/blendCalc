import type { ModerationActionFeedback } from "$lib/components/moderation/types";
import type { ModerationWorkspaceData } from "$lib/server/moderation/moderationWorkspace.server";

export type FoodWarningReportReviewListProps = {
	reports: ModerationWorkspaceData["compatibilityFeedback"];
	form?: ModerationActionFeedback;
	showHeading?: boolean;
};

export type FoodWarningReport =
	FoodWarningReportReviewListProps["reports"][number];

export type StoredWarningFact = {
	label: string;
	factType: string;
	sourceType: string;
	sourceText: string | null;
	confidence: string;
};
