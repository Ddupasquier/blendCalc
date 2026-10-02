import type {
	FoodWarningPolicyReview,
	FoodWarningProductCorrection,
} from "$lib/utils/moderation/foodWarningQueuePagination";
import type { Snippet } from "svelte";

export type FoodWarningFollowUpListProps = {
	followUps: {
		productCorrections: FoodWarningProductCorrection[];
		policyReviews: FoodWarningPolicyReview[];
	};
	productCorrectionTotal?: number;
	policyReviewTotal?: number;
	productCorrectionControls?: Snippet;
	policyReviewControls?: Snippet;
};
