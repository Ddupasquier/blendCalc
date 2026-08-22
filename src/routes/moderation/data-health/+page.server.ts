import type { Actions, PageServerLoad } from "./$types";
import {
	catalogDataHealthWorkspaceActions,
	loadCatalogDataHealthWorkspace,
} from "$lib/server/moderation/catalogDataHealthWorkspace.server";

export const load: PageServerLoad = (event) =>
	loadCatalogDataHealthWorkspace(event, "/moderation/data-health");

export const actions: Actions = catalogDataHealthWorkspaceActions;
