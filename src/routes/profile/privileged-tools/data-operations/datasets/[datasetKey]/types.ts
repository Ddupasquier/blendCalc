import type { DatasetImportEvidenceWorkspaceData } from "$lib/server/moderation/datasetImportEvidenceWorkspace.server";
import type { DatasetImportEvidenceActionData } from "$lib/utils/moderation/datasetImportEvidence";

export type DatasetImportEvidencePageProps = {
	data: DatasetImportEvidenceWorkspaceData;
	form?: DatasetImportEvidenceActionData | null;
};
