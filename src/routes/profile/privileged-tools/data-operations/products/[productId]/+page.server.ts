import type { PageServerLoad } from "./$types";
import { loadCatalogProductReadinessPassportWorkspace } from "$lib/server/moderation/catalogProductReadinessPassportWorkspace.server";

export const load: PageServerLoad = (event) =>
	loadCatalogProductReadinessPassportWorkspace(
		event,
		"data_operations.catalog_health.read",
		"/profile/privileged-tools/data-operations",
	);
