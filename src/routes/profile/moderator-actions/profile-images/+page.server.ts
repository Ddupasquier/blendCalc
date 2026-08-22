import type { Actions, PageServerLoad } from "./$types";
import {
	loadModerationWorkspaceData,
	moderationWorkspaceActions,
} from "$lib/server/moderation/moderationWorkspace.server";

const routePath = "/profile/moderator-actions/profile-images";

export const load: PageServerLoad = (event) =>
	loadModerationWorkspaceData(event, routePath, "profile-images");

export const actions: Actions = {
	ban: moderationWorkspaceActions.ban,
	unban: moderationWorkspaceActions.unban,
};
