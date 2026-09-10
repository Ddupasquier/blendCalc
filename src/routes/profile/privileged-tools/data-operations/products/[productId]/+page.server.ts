import type { Actions, PageServerLoad } from "./$types";
import {
	finishCatalogProductReviewAction,
	loadCatalogProductRepairWorkspace,
	runCatalogProductRepairAction,
} from "$lib/server/moderation/catalogProductRepairWorkspace.server";

export const load: PageServerLoad = loadCatalogProductRepairWorkspace;
export const actions: Actions = {
	finishCatalogReview: finishCatalogProductReviewAction,
	runCatalogRepair: runCatalogProductRepairAction,
};
