import type { Actions, PageServerLoad } from "./$types";
import {
	catalogDataHealthWorkspaceActions,
	loadCatalogDataHealthWorkspace,
} from "$lib/server/moderation/catalogDataHealthWorkspace.server";

const routePath = "/profile/moderator-actions/catalog-data-health";

export const load: PageServerLoad = (event) =>
	loadCatalogDataHealthWorkspace(event, routePath);

export const actions: Actions = catalogDataHealthWorkspaceActions;
