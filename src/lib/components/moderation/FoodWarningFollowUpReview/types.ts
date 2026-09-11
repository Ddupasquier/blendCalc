import type { FoodWarningFollowUpCase } from "$lib/server/moderation/foodWarningFollowUp.server";

export type FoodWarningFollowUpReviewProps = {
	reviewCase: FoodWarningFollowUpCase;
	canResolve: boolean;
};
