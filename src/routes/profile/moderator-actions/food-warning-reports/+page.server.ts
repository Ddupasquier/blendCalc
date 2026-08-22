import type { Actions, PageServerLoad } from "./$types";
import {
	loadModerationWorkspaceData,
	moderationWorkspaceActions,
} from "$lib/server/moderation/moderationWorkspace.server";

const routePath = "/profile/moderator-actions/food-warning-reports";

export const load: PageServerLoad = (event) =>
	loadModerationWorkspaceData(event, routePath, "food-warning-reports");

export const actions: Actions = {
	reviewCompatibilityFeedback:
		moderationWorkspaceActions.reviewCompatibilityFeedback,
};
