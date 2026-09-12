type JsonRecord = Record<string, unknown>;

export type DatasetImportEvidenceWorkspace = {
	dataset: {
		key: string;
		displayName: string;
		version: string;
		regionCode: string;
		sourceKey: string;
		sourceDisplayName: string;
		sourceUrl: string;
		licenseName: string;
		licenseUrl: string;
		licenseReviewStatus: string;
		importEnabled: boolean;
		active: boolean;
		importedAt: string | null;
		sourceFileSha256: string | null;
		foodCount: number;
		nutrientValueCount: number;
		measureCount: number;
		updatedAt: string;
		evidenceReference: string | null;
	};
	missingEvidence: Array<"imported_at" | "source_file_sha256">;
	actionRequired: boolean;
	responsibleRole: string;
	latestDecision: {
		id: string;
		outcome: string;
		evidenceReference: string;
		reviewNote: string;
		recordedAt: string;
	} | null;
};

export type DatasetImportEvidencePreview = {
	previewId: string;
	datasetKey: string;
	outcome: "candidate" | "no_change" | "already_complete";
	releaseVersion: string;
	previousImportedAt: string | null;
	proposedImportedAt: string | null;
	previousSourceFileSha256: string | null;
	proposedSourceFileSha256: string | null;
	evidenceReference: string;
	willRecordImportTime: boolean;
	willRecordChecksum: boolean;
	willClearFinding: boolean;
};

export type DatasetImportEvidenceApplyResult = {
	runId: string;
	previewId: string;
	datasetKey: string;
	outcome: "applied";
	importedAt: string;
	sourceFileSha256: string;
	evidenceReference: string;
	updatedAt: string;
	findingCleared: boolean;
};

export type DatasetImportEvidenceActionData = {
	datasetImportEvidenceError?: string;
	datasetImportEvidencePreview?: DatasetImportEvidencePreview;
	datasetImportEvidenceValues?: {
		releaseVersion: string;
		importedAt: string;
		sourceFileSha256: string;
		evidenceReference: string;
	};
};

const readRecord = (value: unknown, field: string): JsonRecord => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`Invalid dataset evidence field: ${field}`);
	}
	return value as JsonRecord;
};

const readString = (value: unknown, field: string): string => {
	if (typeof value !== "string" || value.length === 0) {
		throw new TypeError(`Invalid dataset evidence field: ${field}`);
	}
	return value;
};

const readNullableString = (value: unknown, field: string): string | null =>
	value === null ? null : readString(value, field);

const readNumber = (value: unknown, field: string): number => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new TypeError(`Invalid dataset evidence field: ${field}`);
	}
	return value;
};

const readBoolean = (value: unknown, field: string): boolean => {
	if (typeof value !== "boolean") {
		throw new TypeError(`Invalid dataset evidence field: ${field}`);
	}
	return value;
};

const readEvidenceKey = (
	value: unknown,
	field: string,
): "imported_at" | "source_file_sha256" => {
	const key = readString(value, field);
	if (key !== "imported_at" && key !== "source_file_sha256") {
		throw new TypeError(`Invalid dataset evidence field: ${field}`);
	}
	return key;
};

export const parseDatasetImportEvidenceWorkspace = (
	value: unknown,
): DatasetImportEvidenceWorkspace => {
	const root = readRecord(value, "root");
	const dataset = readRecord(root.dataset, "dataset");
	if (!Array.isArray(root.missingEvidence)) {
		throw new TypeError("Invalid dataset evidence field: missingEvidence");
	}
	const latestDecision =
		root.latestDecision === null
			? null
			: readRecord(root.latestDecision, "latestDecision");

	return {
		dataset: {
			key: readString(dataset.key, "dataset.key"),
			displayName: readString(dataset.displayName, "dataset.displayName"),
			version: readString(dataset.version, "dataset.version"),
			regionCode: readString(dataset.regionCode, "dataset.regionCode"),
			sourceKey: readString(dataset.sourceKey, "dataset.sourceKey"),
			sourceDisplayName: readString(
				dataset.sourceDisplayName,
				"dataset.sourceDisplayName",
			),
			sourceUrl: readString(dataset.sourceUrl, "dataset.sourceUrl"),
			licenseName: readString(dataset.licenseName, "dataset.licenseName"),
			licenseUrl: readString(dataset.licenseUrl, "dataset.licenseUrl"),
			licenseReviewStatus: readString(
				dataset.licenseReviewStatus,
				"dataset.licenseReviewStatus",
			),
			importEnabled: readBoolean(
				dataset.importEnabled,
				"dataset.importEnabled",
			),
			active: readBoolean(dataset.active, "dataset.active"),
			importedAt: readNullableString(dataset.importedAt, "dataset.importedAt"),
			sourceFileSha256: readNullableString(
				dataset.sourceFileSha256,
				"dataset.sourceFileSha256",
			),
			foodCount: readNumber(dataset.foodCount, "dataset.foodCount"),
			nutrientValueCount: readNumber(
				dataset.nutrientValueCount,
				"dataset.nutrientValueCount",
			),
			measureCount: readNumber(dataset.measureCount, "dataset.measureCount"),
			updatedAt: readString(dataset.updatedAt, "dataset.updatedAt"),
			evidenceReference: readNullableString(
				dataset.evidenceReference,
				"dataset.evidenceReference",
			),
		},
		missingEvidence: root.missingEvidence.map((evidence, index) =>
			readEvidenceKey(evidence, `missingEvidence[${index}]`),
		),
		actionRequired: readBoolean(root.actionRequired, "actionRequired"),
		responsibleRole: readString(root.responsibleRole, "responsibleRole"),
		latestDecision: latestDecision
			? {
					id: readString(latestDecision.id, "latestDecision.id"),
					outcome: readString(latestDecision.outcome, "latestDecision.outcome"),
					evidenceReference: readString(
						latestDecision.evidenceReference,
						"latestDecision.evidenceReference",
					),
					reviewNote: readString(
						latestDecision.reviewNote,
						"latestDecision.reviewNote",
					),
					recordedAt: readString(
						latestDecision.recordedAt,
						"latestDecision.recordedAt",
					),
				}
			: null,
	};
};

export const parseDatasetImportEvidencePreview = (
	value: unknown,
): DatasetImportEvidencePreview => {
	const root = readRecord(value, "root");
	const outcome = readString(root.outcome, "outcome");
	if (
		outcome !== "candidate" &&
		outcome !== "no_change" &&
		outcome !== "already_complete"
	) {
		throw new TypeError("Invalid dataset evidence field: outcome");
	}
	return {
		previewId: readString(root.previewId, "previewId"),
		datasetKey: readString(root.datasetKey, "datasetKey"),
		outcome,
		releaseVersion: readString(root.releaseVersion, "releaseVersion"),
		previousImportedAt: readNullableString(
			root.previousImportedAt,
			"previousImportedAt",
		),
		proposedImportedAt: readNullableString(
			root.proposedImportedAt,
			"proposedImportedAt",
		),
		previousSourceFileSha256: readNullableString(
			root.previousSourceFileSha256,
			"previousSourceFileSha256",
		),
		proposedSourceFileSha256: readNullableString(
			root.proposedSourceFileSha256,
			"proposedSourceFileSha256",
		),
		evidenceReference: readString(root.evidenceReference, "evidenceReference"),
		willRecordImportTime: readBoolean(
			root.willRecordImportTime,
			"willRecordImportTime",
		),
		willRecordChecksum: readBoolean(
			root.willRecordChecksum,
			"willRecordChecksum",
		),
		willClearFinding: readBoolean(root.willClearFinding, "willClearFinding"),
	};
};

export const parseDatasetImportEvidenceApplyResult = (
	value: unknown,
): DatasetImportEvidenceApplyResult => {
	const root = readRecord(value, "root");
	if (readString(root.outcome, "outcome") !== "applied") {
		throw new TypeError("Invalid dataset evidence field: outcome");
	}
	return {
		runId: readString(root.runId, "runId"),
		previewId: readString(root.previewId, "previewId"),
		datasetKey: readString(root.datasetKey, "datasetKey"),
		outcome: "applied",
		importedAt: readString(root.importedAt, "importedAt"),
		sourceFileSha256: readString(root.sourceFileSha256, "sourceFileSha256"),
		evidenceReference: readString(root.evidenceReference, "evidenceReference"),
		updatedAt: readString(root.updatedAt, "updatedAt"),
		findingCleared: readBoolean(root.findingCleared, "findingCleared"),
	};
};
