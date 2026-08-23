import type { PageServerLoad } from "./$types";
import { loadCatalogProductReadinessPassportWorkspace } from "$lib/server/moderation/catalogProductReadinessPassportWorkspace.server";

export const load: PageServerLoad = (event) =>
	loadCatalogProductReadinessPassportWorkspace(
		event,
		"moderation.catalog.review",
		"/profile/privileged-tools/catalog-review-work",
	);
