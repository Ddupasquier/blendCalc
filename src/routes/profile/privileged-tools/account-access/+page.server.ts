import type { Actions, PageServerLoad } from "./$types";
import {
	loadModerationWorkspaceData,
	moderationWorkspaceActions,
} from "$lib/server/moderation/moderationWorkspace.server";

const routePath = "/profile/privileged-tools/account-access";

export const load: PageServerLoad = (event) =>
	loadModerationWorkspaceData(event, routePath, "account-access");

export const actions: Actions = {
	ban: moderationWorkspaceActions.ban,
	unban: moderationWorkspaceActions.unban,
};
