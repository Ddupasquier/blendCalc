import type { CatalogMonitorModerationSummary } from "./catalogMonitorModeration";
import type { CatalogDataOperationsIssues } from "./catalogDataOperationsHealth";

type JsonRecord = Record<string, unknown>;

export type CatalogReviewWorkSummary = {
	conflicts: Array<
		CatalogDataOperationsIssues["conflicts"][number] & {
			observedValues: unknown[];
		}
	>;
	providerChanges: Array<
		CatalogMonitorModerationSummary["providerChanges"][number] & {
			correctionStatus: "waiting_for_correction" | "linked" | null;
			submissionId: string | null;
		}
	>;
	safetyMatches: CatalogMonitorModerationSummary["safetyMatches"];
	counts: {
		conflicts: number;
		providerChanges: number;
		safetyMatches: number;
	};
	issueLimit: number;
};

const readRecord = (value: unknown, field: string): JsonRecord => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`Invalid catalog review-work field: ${field}`);
	}
	return value as JsonRecord;
};

const readArray = (value: unknown, field: string): unknown[] => {
	if (!Array.isArray(value)) {
		throw new TypeError(`Invalid catalog review-work field: ${field}`);
	}
	return value;
};

const readString = (value: unknown, field: string): string => {
	if (typeof value !== "string") {
		throw new TypeError(`Invalid catalog review-work field: ${field}`);
	}
	return value;
};

const readNullableString = (value: unknown, field: string): string | null =>
	value === null ? null : readString(value, field);

const readNumber = (value: unknown, field: string): number => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new TypeError(`Invalid catalog review-work field: ${field}`);
	}
	return value;
};

const readBoolean = (value: unknown, field: string): boolean => {
	if (typeof value !== "boolean") {
		throw new TypeError(`Invalid catalog review-work field: ${field}`);
	}
	return value;
};

const readCorrectionStatus = (
	value: unknown,
	field: string,
): "waiting_for_correction" | "linked" | null => {
	if (value === null) return null;
	if (value === "waiting_for_correction" || value === "linked") return value;
	throw new TypeError(`Invalid catalog review-work field: ${field}`);
};

const parseConflict = (value: unknown, index: number) => {
	const path = `conflicts[${index}]`;
	const conflict = readRecord(value, path);
	return {
		id: readString(conflict.id, `${path}.id`),
		productId: readString(conflict.productId, `${path}.productId`),
		barcode: readString(conflict.barcode, `${path}.barcode`),
		productName: readString(conflict.productName, `${path}.productName`),
		fieldPath: readString(conflict.fieldPath, `${path}.fieldPath`),
		observedValues: readArray(
			conflict.observedValues,
			`${path}.observedValues`,
		),
		severity: readString(conflict.severity, `${path}.severity`),
		createdAt: readString(conflict.createdAt, `${path}.createdAt`),
	};
};

const parseProviderChange = (value: unknown, index: number) => {
	const path = `providerChanges[${index}]`;
	const change = readRecord(value, path);
	const summary = readRecord(change.changeSummary, `${path}.changeSummary`);
	return {
		id: readString(change.id, `${path}.id`),
		sharedProductId: readString(
			change.sharedProductId,
			`${path}.sharedProductId`,
		),
		barcode: readString(change.barcode, `${path}.barcode`),
		productName: readString(change.productName, `${path}.productName`),
		sourceName: readString(change.sourceName, `${path}.sourceName`),
		changeSummary: {
			changes: readArray(summary.changes, `${path}.changeSummary.changes`).map(
				(value, changeIndex) => {
					const detailPath = `${path}.changeSummary.changes[${changeIndex}]`;
					const detail = readRecord(value, detailPath);
					return {
						field: readString(detail.field, `${detailPath}.field`),
						label: readString(detail.label, `${detailPath}.label`),
						severity: readString(detail.severity, `${detailPath}.severity`),
						previousValue: detail.previousValue ?? null,
						observedValue: detail.observedValue ?? null,
					};
				},
			),
		},
		materialFieldPaths: readArray(
			change.materialFieldPaths,
			`${path}.materialFieldPaths`,
		).map((entry, entryIndex) =>
			readString(entry, `${path}.materialFieldPaths[${entryIndex}]`),
		),
		observedAt: readString(change.observedAt, `${path}.observedAt`),
		createdAt: readString(change.createdAt, `${path}.createdAt`),
		correctionStatus: readCorrectionStatus(
			change.correctionStatus,
			`${path}.correctionStatus`,
		),
		submissionId: readNullableString(
			change.submissionId,
			`${path}.submissionId`,
		),
	};
};

const MAX_EVIDENCE_VALUE_LENGTH = 240;

export const formatCatalogEvidenceValue = (value: unknown): string => {
	if (value === null || value === undefined || value === "")
		return "Not reported";
	if (typeof value === "string")
		return value.slice(0, MAX_EVIDENCE_VALUE_LENGTH);
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	if (Array.isArray(value)) {
		const formatted = value.map(formatCatalogEvidenceValue).join(", ");
		return formatted.slice(0, MAX_EVIDENCE_VALUE_LENGTH);
	}
	if (typeof value === "object") {
		const record = value as Record<string, unknown>;
		if ("value" in record) {
			return `${formatCatalogEvidenceValue(record.value)} ${typeof record.unit === "string" ? record.unit : ""}`.trim();
		}
		const formatted = Object.entries(record)
			.map(([key, entry]) => `${key}: ${formatCatalogEvidenceValue(entry)}`)
			.join("; ");
		return formatted.slice(0, MAX_EVIDENCE_VALUE_LENGTH);
	}
	return "Not reported";
};

const parseSafetyMatch = (value: unknown, index: number) => {
	const path = `safetyMatches[${index}]`;
	const match = readRecord(value, path);
	return {
		id: readString(match.id, `${path}.id`),
		sharedProductId: readString(
			match.sharedProductId,
			`${path}.sharedProductId`,
		),
		barcode: readString(match.barcode, `${path}.barcode`),
		productName: readString(match.productName, `${path}.productName`),
		brandOwner: readNullableString(match.brandOwner, `${path}.brandOwner`),
		alertProductDescription: readString(
			match.alertProductDescription,
			`${path}.alertProductDescription`,
		),
		classification: readNullableString(
			match.classification,
			`${path}.classification`,
		),
		reason: readNullableString(match.reason, `${path}.reason`),
		packageDescription: readNullableString(
			match.packageDescription,
			`${path}.packageDescription`,
		),
		codeInformation: readNullableString(
			match.codeInformation,
			`${path}.codeInformation`,
		),
		sourceUrl: readString(match.sourceUrl, `${path}.sourceUrl`),
		sourceName: readString(match.sourceName, `${path}.sourceName`),
		matchEvidence: readRecord(match.matchEvidence, `${path}.matchEvidence`),
		requiresPackageCheck: readBoolean(
			match.requiresPackageCheck,
			`${path}.requiresPackageCheck`,
		),
		detectedAt: readString(match.detectedAt, `${path}.detectedAt`),
	};
};

export const parseCatalogReviewWorkSummary = (
	value: unknown,
): CatalogReviewWorkSummary => {
	const root = readRecord(value, "root");
	const counts = readRecord(root.counts, "counts");
	return {
		conflicts: readArray(root.conflicts, "conflicts").map(parseConflict),
		providerChanges: readArray(root.providerChanges, "providerChanges").map(
			parseProviderChange,
		),
		safetyMatches: readArray(root.safetyMatches, "safetyMatches").map(
			parseSafetyMatch,
		),
		counts: {
			conflicts: readNumber(counts.conflicts, "counts.conflicts"),
			providerChanges: readNumber(
				counts.providerChanges,
				"counts.providerChanges",
			),
			safetyMatches: readNumber(counts.safetyMatches, "counts.safetyMatches"),
		},
		issueLimit: readNumber(root.issueLimit, "issueLimit"),
	};
};
