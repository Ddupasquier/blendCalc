import type { NutrientMappingReviewActionData } from "$lib/utils/moderation/nutrientMappingReview";
import type { NutrientMappingReviewWorkspace } from "$lib/utils/moderation/nutrientMappingReview";

export type NutrientMappingReviewProps = {
	workspace: NutrientMappingReviewWorkspace;
	form?: NutrientMappingReviewActionData | null;
};
