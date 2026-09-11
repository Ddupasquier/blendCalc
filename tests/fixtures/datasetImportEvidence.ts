import type {
	DatasetImportEvidenceApplyResult,
	DatasetImportEvidencePreview,
	DatasetImportEvidenceWorkspace,
} from "$lib/utils/moderation/datasetImportEvidence";

export const datasetImportEvidenceWorkspaceFixture: DatasetImportEvidenceWorkspace =
	{
		dataset: {
			key: "cnf-2026",
			displayName: "Canadian Nutrient File 2026",
			version: "2026",
			regionCode: "CA",
			sourceKey: "health-canada-cnf",
			sourceDisplayName: "Health Canada Canadian Nutrient File",
			sourceUrl: "https://example.test/cnf-2026",
			licenseName: "Open Government Licence – Canada",
			licenseUrl: "https://example.test/canada-license",
			licenseReviewStatus: "approved",
			importEnabled: true,
			active: false,
			importedAt: null,
			sourceFileSha256: null,
			foodCount: 5993,
			nutrientValueCount: 100000,
			measureCount: 3000,
			updatedAt: "2026-09-10T20:00:00.000Z",
			evidenceReference: null,
		},
		missingEvidence: ["imported_at", "source_file_sha256"],
		actionRequired: true,
		responsibleRole: "Administrator or developer with data-repair access",
		latestDecision: null,
	};

export const datasetImportEvidencePreviewFixture: DatasetImportEvidencePreview =
	{
		previewId: "77600000-0000-4000-8000-000000000100",
		datasetKey: "cnf-2026",
		outcome: "candidate",
		releaseVersion: "2026",
		previousImportedAt: null,
		proposedImportedAt: "2026-09-10T21:30:00.000Z",
		previousSourceFileSha256: null,
		proposedSourceFileSha256:
			"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		evidenceReference: "https://example.test/cnf-import-log",
		willRecordImportTime: true,
		willRecordChecksum: true,
		willClearFinding: true,
	};

export const datasetImportEvidenceApplyFixture: DatasetImportEvidenceApplyResult =
	{
		runId: "77600000-0000-4000-8000-000000000101",
		previewId: datasetImportEvidencePreviewFixture.previewId,
		datasetKey: "cnf-2026",
		outcome: "applied",
		importedAt: "2026-09-10T21:30:00.000Z",
		sourceFileSha256:
			"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		evidenceReference: "https://example.test/cnf-import-log",
		updatedAt: "2026-09-10T21:45:00.000Z",
		findingCleared: true,
	};
