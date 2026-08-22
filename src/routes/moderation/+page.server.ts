import type { Actions, PageServerLoad } from "./$types";
import {
	loadModerationWorkspaceData,
	moderationWorkspaceActions,
} from "$lib/server/moderation/moderationWorkspace.server";

export const load: PageServerLoad = (event) =>
	loadModerationWorkspaceData(event, "/moderation");

export const actions: Actions = moderationWorkspaceActions;
