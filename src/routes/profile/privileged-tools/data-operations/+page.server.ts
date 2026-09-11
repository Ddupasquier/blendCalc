import type { PageServerLoad } from "./$types";
import { loadCatalogDataOperationsWorkspace } from "$lib/server/moderation/catalogDataOperationsWorkspace.server";

export const load: PageServerLoad = async (event) => ({
	...(await loadCatalogDataOperationsWorkspace(event)),
	datasetEvidenceRecorded:
		event.url.searchParams.get("datasetEvidence") === "recorded",
});
