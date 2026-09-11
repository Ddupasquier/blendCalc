import type {
	DatasetImportEvidenceActionData,
	DatasetImportEvidenceWorkspace,
} from "$lib/utils/moderation/datasetImportEvidence";

export type DatasetImportEvidenceReviewProps = {
	workspace: DatasetImportEvidenceWorkspace;
	form?: DatasetImportEvidenceActionData | null;
};
