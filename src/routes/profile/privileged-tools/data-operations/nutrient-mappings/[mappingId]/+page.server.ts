import type { Actions, PageServerLoad } from "./$types";
import {
	loadNutrientMappingReviewWorkspace,
	reviewNutrientMappingAction,
} from "$lib/server/moderation/nutrientMappingReviewWorkspace.server";

export const load: PageServerLoad = loadNutrientMappingReviewWorkspace;
export const actions: Actions = {
	reviewNutrientMapping: reviewNutrientMappingAction,
};
