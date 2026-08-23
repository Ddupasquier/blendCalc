type JsonRecord = Record<string, unknown>;

export type CatalogProductReadinessIssue = {
	occurrenceKey: string;
	issueCode: string;
	sourceScope: string;
	sourceReason: string;
	parameters: JsonRecord;
	detectedAt: string;
	operationalSeverity: string;
	responsibleGroup: string;
	resolutionAction: string;
	automatedRepairAllowed: boolean;
	automatedRepairKey: string | null;
};

export type CatalogProductReadinessPassport = {
	product: {
		id: string;
		barcode: string;
		productName: string;
		brandOwner: string | null;
		sharedCatalogStatus: string;
		apiV1Status: string;
		searchableInBlendcalc: boolean;
		usableInBlendcalc: boolean;
		openMaterialConflictCount: number;
		pendingCorrectionCount: number;
		lastVerifiedAt: string | null;
		updatedAt: string;
	};
	revision: {
		id: string;
		number: number;
		labelObservedAt: string;
		createdAt: string;
		source: string;
		sourceReference: string | null;
		changeSummary: JsonRecord;
	} | null;
	qualityDimensions: JsonRecord;
	evidence: {
		selectedFieldCount: number;
		normalizedNutrientCount: number;
		nutrientsWithSourceEvidenceCount: number;
		servingCount: number;
		servingsWithSourceEvidenceCount: number;
		observationCount: number;
		sources: string[];
	};
	issues: CatalogProductReadinessIssue[];
};

const readRecord = (value: unknown, field: string): JsonRecord => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`Invalid product readiness passport field: ${field}`);
	}
	return value as JsonRecord;
};

const readArray = (value: unknown, field: string): unknown[] => {
	if (!Array.isArray(value)) {
		throw new TypeError(`Invalid product readiness passport field: ${field}`);
	}
	return value;
};

const readString = (value: unknown, field: string): string => {
	if (typeof value !== "string") {
		throw new TypeError(`Invalid product readiness passport field: ${field}`);
	}
	return value;
};

const readNullableString = (value: unknown, field: string): string | null =>
	value === null ? null : readString(value, field);

const readNumber = (value: unknown, field: string): number => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new TypeError(`Invalid product readiness passport field: ${field}`);
	}
	return value;
};

const readBoolean = (value: unknown, field: string): boolean => {
	if (typeof value !== "boolean") {
		throw new TypeError(`Invalid product readiness passport field: ${field}`);
	}
	return value;
};

const parseIssue = (
	value: unknown,
	index: number,
): CatalogProductReadinessIssue => {
	const path = `issues[${index}]`;
	const issue = readRecord(value, path);
	return {
		occurrenceKey: readString(issue.occurrenceKey, `${path}.occurrenceKey`),
		issueCode: readString(issue.issueCode, `${path}.issueCode`),
		sourceScope: readString(issue.sourceScope, `${path}.sourceScope`),
		sourceReason: readString(issue.sourceReason, `${path}.sourceReason`),
		parameters: readRecord(issue.parameters, `${path}.parameters`),
		detectedAt: readString(issue.detectedAt, `${path}.detectedAt`),
		operationalSeverity: readString(
			issue.operationalSeverity,
			`${path}.operationalSeverity`,
		),
		responsibleGroup: readString(issue.responsibleGroup, `${path}.responsibleGroup`),
		resolutionAction: readString(issue.resolutionAction, `${path}.resolutionAction`),
		automatedRepairAllowed: readBoolean(
			issue.automatedRepairAllowed,
			`${path}.automatedRepairAllowed`,
		),
		automatedRepairKey: readNullableString(
			issue.automatedRepairKey,
			`${path}.automatedRepairKey`,
		),
	};
};

export const parseCatalogProductReadinessPassport = (
	value: unknown,
): CatalogProductReadinessPassport => {
	const root = readRecord(value, "root");
	const product = readRecord(root.product, "product");
	const evidence = readRecord(root.evidence, "evidence");
	const revision = root.revision === null ? null : readRecord(root.revision, "revision");

	return {
		product: {
			id: readString(product.id, "product.id"),
			barcode: readString(product.barcode, "product.barcode"),
			productName: readString(product.productName, "product.productName"),
			brandOwner: readNullableString(product.brandOwner, "product.brandOwner"),
			sharedCatalogStatus: readString(
				product.sharedCatalogStatus,
				"product.sharedCatalogStatus",
			),
			apiV1Status: readString(product.apiV1Status, "product.apiV1Status"),
			searchableInBlendcalc: readBoolean(
				product.searchableInBlendcalc,
				"product.searchableInBlendcalc",
			),
			usableInBlendcalc: readBoolean(
				product.usableInBlendcalc,
				"product.usableInBlendcalc",
			),
			openMaterialConflictCount: readNumber(
				product.openMaterialConflictCount,
				"product.openMaterialConflictCount",
			),
			pendingCorrectionCount: readNumber(
				product.pendingCorrectionCount,
				"product.pendingCorrectionCount",
			),
			lastVerifiedAt: readNullableString(
				product.lastVerifiedAt,
				"product.lastVerifiedAt",
			),
			updatedAt: readString(product.updatedAt, "product.updatedAt"),
		},
		revision: revision
			? {
				id: readString(revision.id, "revision.id"),
				number: readNumber(revision.number, "revision.number"),
				labelObservedAt: readString(
					revision.labelObservedAt,
					"revision.labelObservedAt",
				),
				createdAt: readString(revision.createdAt, "revision.createdAt"),
				source: readString(revision.source, "revision.source"),
				sourceReference: readNullableString(
					revision.sourceReference,
					"revision.sourceReference",
				),
				changeSummary: readRecord(revision.changeSummary, "revision.changeSummary"),
			}
			: null,
		qualityDimensions: readRecord(root.qualityDimensions, "qualityDimensions"),
		evidence: {
			selectedFieldCount: readNumber(
				evidence.selectedFieldCount,
				"evidence.selectedFieldCount",
			),
			normalizedNutrientCount: readNumber(
				evidence.normalizedNutrientCount,
				"evidence.normalizedNutrientCount",
			),
			nutrientsWithSourceEvidenceCount: readNumber(
				evidence.nutrientsWithSourceEvidenceCount,
				"evidence.nutrientsWithSourceEvidenceCount",
			),
			servingCount: readNumber(evidence.servingCount, "evidence.servingCount"),
			servingsWithSourceEvidenceCount: readNumber(
				evidence.servingsWithSourceEvidenceCount,
				"evidence.servingsWithSourceEvidenceCount",
			),
			observationCount: readNumber(
				evidence.observationCount,
				"evidence.observationCount",
			),
			sources: readArray(evidence.sources, "evidence.sources").map((source, index) =>
				readString(source, `evidence.sources[${index}]`),
			),
		},
		issues: readArray(root.issues, "issues").map(parseIssue),
	};
};
