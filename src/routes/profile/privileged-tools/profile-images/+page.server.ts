import type { Actions, PageServerLoad } from "./$types";
import {
	loadModerationWorkspaceData,
	moderationWorkspaceActions,
} from "$lib/server/moderation/moderationWorkspace.server";

const routePath = "/profile/privileged-tools/profile-images";

export const load: PageServerLoad = (event) =>
	loadModerationWorkspaceData(event, routePath, "profile-images");

export const actions: Actions = {
	reviewProfileImageReport: moderationWorkspaceActions.reviewProfileImageReport,
};
