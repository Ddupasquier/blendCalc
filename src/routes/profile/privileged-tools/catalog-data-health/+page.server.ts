import type { Actions, PageServerLoad } from "./$types";
import {
	catalogDataHealthWorkspaceActions,
	loadCatalogDataHealthWorkspace,
} from "$lib/server/moderation/catalogDataHealthWorkspace.server";

const routePath = "/profile/privileged-tools/catalog-data-health";

export const load: PageServerLoad = (event) =>
	loadCatalogDataHealthWorkspace(event, routePath);

export const actions: Actions = catalogDataHealthWorkspaceActions;
