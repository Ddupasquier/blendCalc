import type { Actions, PageServerLoad } from "./$types";
import {
	catalogReviewWorkWorkspaceActions,
	loadCatalogReviewWorkWorkspace,
} from "$lib/server/moderation/catalogReviewWorkWorkspace.server";

export const load: PageServerLoad = loadCatalogReviewWorkWorkspace;
export const actions: Actions = catalogReviewWorkWorkspaceActions;
