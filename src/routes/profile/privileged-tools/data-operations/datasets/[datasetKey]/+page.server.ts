import type { Actions, PageServerLoad } from "./$types";
import {
	applyDatasetImportEvidenceAction,
	loadDatasetImportEvidenceWorkspace,
	previewDatasetImportEvidenceAction,
} from "$lib/server/moderation/datasetImportEvidenceWorkspace.server";

export const load: PageServerLoad = loadDatasetImportEvidenceWorkspace;
export const actions: Actions = {
	previewDatasetImportEvidence: previewDatasetImportEvidenceAction,
	applyDatasetImportEvidence: applyDatasetImportEvidenceAction,
};
