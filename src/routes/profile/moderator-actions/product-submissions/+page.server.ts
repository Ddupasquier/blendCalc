import type { Actions, PageServerLoad } from "./$types";
import {
	loadModerationWorkspaceData,
	moderationWorkspaceActions,
} from "$lib/server/moderation/moderationWorkspace.server";

const routePath = "/profile/moderator-actions/product-submissions";

export const load: PageServerLoad = (event) =>
	loadModerationWorkspaceData(event, routePath, "product-submissions");

export const actions: Actions = {
	approveProduct: moderationWorkspaceActions.approveProduct,
	rejectProduct: moderationWorkspaceActions.rejectProduct,
};
