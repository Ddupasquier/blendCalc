import type { NutrientMappingReviewWorkspaceData } from "$lib/server/moderation/nutrientMappingReviewWorkspace.server";
import type { NutrientMappingReviewActionData } from "$lib/utils/moderation/nutrientMappingReview";

export type NutrientMappingReviewPageProps = {
	data: NutrientMappingReviewWorkspaceData;
	form?: NutrientMappingReviewActionData | null;
};
