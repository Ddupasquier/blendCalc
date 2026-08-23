import type { PageServerLoad } from "./$types";
import { loadCatalogDataOperationsWorkspace } from "$lib/server/moderation/catalogDataOperationsWorkspace.server";

export const load: PageServerLoad = loadCatalogDataOperationsWorkspace;
