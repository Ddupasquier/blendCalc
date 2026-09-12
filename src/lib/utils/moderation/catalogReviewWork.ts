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

export type CatalogReviewProductSummary = {
	productId: string;
	barcode: string;
	productName: string;
	brandOwner: string | null;
	oldestReviewAt: string;
	counts: {
		conflicts: number;
		providerChanges: number;
		safetyMatches: number;
		total: number;
	};
};

type MutableCatalogReviewProductSummary = Omit<
	CatalogReviewProductSummary,
	"counts"
> & {
	counts: CatalogReviewProductSummary["counts"];
};

const compareReviewDates = (left: string, right: string) =>
	Date.parse(left) - Date.parse(right);

export const groupCatalogReviewWorkByProduct = (
	reviewWork: CatalogReviewWorkSummary,
): CatalogReviewProductSummary[] => {
	const products = new Map<string, MutableCatalogReviewProductSummary>();
	const addReview = (input: {
		productId: string;
		barcode: string;
		productName: string;
		brandOwner?: string | null;
		reviewAt: string;
		category: "conflicts" | "providerChanges" | "safetyMatches";
	}) => {
		const existing = products.get(input.productId);
		if (existing) {
			existing.counts[input.category] += 1;
			existing.counts.total += 1;
			if (compareReviewDates(input.reviewAt, existing.oldestReviewAt) < 0) {
				existing.oldestReviewAt = input.reviewAt;
			}
			if (!existing.brandOwner && input.brandOwner) {
				existing.brandOwner = input.brandOwner;
			}
			return;
		}
		products.set(input.productId, {
			productId: input.productId,
			barcode: input.barcode,
			productName: input.productName,
			brandOwner: input.brandOwner ?? null,
			oldestReviewAt: input.reviewAt,
			counts: {
				conflicts: input.category === "conflicts" ? 1 : 0,
				providerChanges: input.category === "providerChanges" ? 1 : 0,
				safetyMatches: input.category === "safetyMatches" ? 1 : 0,
				total: 1,
			},
		});
	};

	for (const match of reviewWork.safetyMatches) {
		addReview({
			productId: match.sharedProductId,
			barcode: match.barcode,
			productName: match.productName,
			brandOwner: match.brandOwner,
			reviewAt: match.detectedAt,
			category: "safetyMatches",
		});
	}
	for (const conflict of reviewWork.conflicts) {
		addReview({
			productId: conflict.productId,
			barcode: conflict.barcode,
			productName: conflict.productName,
			reviewAt: conflict.createdAt,
			category: "conflicts",
		});
	}
	for (const change of reviewWork.providerChanges) {
		addReview({
			productId: change.sharedProductId,
			barcode: change.barcode,
			productName: change.productName,
			reviewAt: change.createdAt,
			category: "providerChanges",
		});
	}

	return [...products.values()].sort((left, right) => {
		const safetyPriority =
			Number(right.counts.safetyMatches > 0) -
			Number(left.counts.safetyMatches > 0);
		if (safetyPriority !== 0) return safetyPriority;
		return compareReviewDates(left.oldestReviewAt, right.oldestReviewAt);
	});
};

export const filterCatalogReviewWorkForProduct = (
	reviewWork: CatalogReviewWorkSummary,
	productId: string,
): CatalogReviewWorkSummary => {
	const conflicts = reviewWork.conflicts.filter(
		(conflict) => conflict.productId === productId,
	);
	const providerChanges = reviewWork.providerChanges.filter(
		(change) => change.sharedProductId === productId,
	);
	const safetyMatches = reviewWork.safetyMatches.filter(
		(match) => match.sharedProductId === productId,
	);
	return {
		conflicts,
		providerChanges,
		safetyMatches,
		counts: {
			conflicts: conflicts.length,
			providerChanges: providerChanges.length,
			safetyMatches: safetyMatches.length,
		},
		issueLimit: reviewWork.issueLimit,
	};
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
