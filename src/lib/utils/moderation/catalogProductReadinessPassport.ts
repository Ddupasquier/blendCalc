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
	workCategory: "publication_blocker" | "catalog_diagnostic";
	impact: "blocks_publication" | "does_not_block_publication";
};

export type CatalogProductReviewCompletion = {
	requiredSafeRepairCheckCount: number;
	completedSafeRepairCheckCount: number;
	canFinish: boolean;
};

export type CatalogProductReviewDisposition = {
	outcome: "accepted_withheld" | "accepted_evidence_gap";
	reviewNote: string;
	issueCount: number;
	reviewedAt: string;
};

export type CatalogProductRevisionChange = {
	fieldPath: string;
	fieldLabel: string;
	changeType: "added" | "removed" | "changed";
	previousValue: unknown;
	newValue: unknown;
	severity: "low" | "medium" | "high";
};

export type CatalogProductRevisionContext = {
	id: string;
	number: number;
	labelObservedAt: string;
	createdAt: string;
	source: string;
	sourceReference: string | null;
	changes: CatalogProductRevisionChange[];
};

export type CatalogProductReadinessPassport = {
	product: {
		id: string;
		barcode: string;
		productName: string;
		brandOwner: string | null;
		sharedCatalogStatus: string;
		blendCalcAPIV1Status: string;
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
	revisionHistory: CatalogProductRevisionContext[];
	revisionHistoryAvailable: boolean;
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
	reviewCompletion: CatalogProductReviewCompletion;
	diagnosticReviewCompletion: CatalogProductReviewCompletion;
	reviewDisposition: CatalogProductReviewDisposition | null;
	diagnosticReviewDisposition: CatalogProductReviewDisposition | null;
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

const parseReviewDisposition = (
	value: unknown,
	field: "reviewDisposition" | "diagnosticReviewDisposition",
): CatalogProductReadinessPassport["reviewDisposition"] => {
	if (value === null) return null;
	const disposition = readRecord(value, field);
	const outcome = readString(disposition.outcome, `${field}.outcome`);
	if (outcome !== "accepted_withheld" && outcome !== "accepted_evidence_gap") {
		throw new TypeError(
			`Invalid product readiness passport field: ${field}.outcome`,
		);
	}
	return {
		outcome,
		reviewNote: readString(disposition.reviewNote, `${field}.reviewNote`),
		issueCount: readNumber(disposition.issueCount, `${field}.issueCount`),
		reviewedAt: readString(disposition.reviewedAt, `${field}.reviewedAt`),
	};
};

const readWorkCategory = (
	value: unknown,
	field: string,
): CatalogProductReadinessIssue["workCategory"] => {
	if (value !== "publication_blocker" && value !== "catalog_diagnostic") {
		throw new TypeError(`Invalid product readiness passport field: ${field}`);
	}
	return value;
};

const readImpact = (
	value: unknown,
	field: string,
): CatalogProductReadinessIssue["impact"] => {
	if (
		value !== "blocks_publication" &&
		value !== "does_not_block_publication"
	) {
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
		responsibleGroup: readString(
			issue.responsibleGroup,
			`${path}.responsibleGroup`,
		),
		resolutionAction: readString(
			issue.resolutionAction,
			`${path}.resolutionAction`,
		),
		automatedRepairAllowed: readBoolean(
			issue.automatedRepairAllowed,
			`${path}.automatedRepairAllowed`,
		),
		automatedRepairKey: readNullableString(
			issue.automatedRepairKey,
			`${path}.automatedRepairKey`,
		),
		workCategory: readWorkCategory(issue.workCategory, `${path}.workCategory`),
		impact: readImpact(issue.impact, `${path}.impact`),
	};
};

const parseRevisionChange = (
	value: unknown,
	path: string,
): CatalogProductRevisionChange => {
	const change = readRecord(value, path);
	const changeType = readString(change.changeType, `${path}.changeType`);
	const severity = readString(change.severity, `${path}.severity`);
	if (!["added", "removed", "changed"].includes(changeType)) {
		throw new TypeError(
			`Invalid product readiness passport field: ${path}.changeType`,
		);
	}
	if (!["low", "medium", "high"].includes(severity)) {
		throw new TypeError(
			`Invalid product readiness passport field: ${path}.severity`,
		);
	}
	return {
		fieldPath: readString(change.fieldPath, `${path}.fieldPath`),
		fieldLabel: readString(change.fieldLabel, `${path}.fieldLabel`),
		changeType: changeType as CatalogProductRevisionChange["changeType"],
		previousValue: change.previousValue,
		newValue: change.newValue,
		severity: severity as CatalogProductRevisionChange["severity"],
	};
};

export const parseCatalogProductRevisionHistory = (
	value: unknown,
): CatalogProductRevisionContext[] =>
	readArray(value, "revisionHistory").map((entry, index) => {
		const path = `revisionHistory[${index}]`;
		const revision = readRecord(entry, path);
		return {
			id: readString(revision.id, `${path}.id`),
			number: readNumber(revision.number, `${path}.number`),
			labelObservedAt: readString(
				revision.labelObservedAt,
				`${path}.labelObservedAt`,
			),
			createdAt: readString(revision.createdAt, `${path}.createdAt`),
			source: readString(revision.source, `${path}.source`),
			sourceReference: readNullableString(
				revision.sourceReference,
				`${path}.sourceReference`,
			),
			changes: readArray(revision.changes, `${path}.changes`).map(
				(change, changeIndex) =>
					parseRevisionChange(change, `${path}.changes[${changeIndex}]`),
			),
		};
	});

const parseReviewCompletion = (
	value: unknown,
	field: "reviewCompletion" | "diagnosticReviewCompletion",
): CatalogProductReviewCompletion => {
	const completion = readRecord(value, field);
	return {
		requiredSafeRepairCheckCount: readNumber(
			completion.requiredSafeRepairCheckCount,
			`${field}.requiredSafeRepairCheckCount`,
		),
		completedSafeRepairCheckCount: readNumber(
			completion.completedSafeRepairCheckCount,
			`${field}.completedSafeRepairCheckCount`,
		),
		canFinish: readBoolean(completion.canFinish, `${field}.canFinish`),
	};
};

export const parseCatalogProductReadinessPassport = (
	value: unknown,
): CatalogProductReadinessPassport => {
	const root = readRecord(value, "root");
	const product = readRecord(root.product, "product");
	const evidence = readRecord(root.evidence, "evidence");
	const revision =
		root.revision === null ? null : readRecord(root.revision, "revision");

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
			blendCalcAPIV1Status: readString(
				product.blendCalcAPIV1Status,
				"product.blendCalcAPIV1Status",
			),
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
					changeSummary: readRecord(
						revision.changeSummary,
						"revision.changeSummary",
					),
				}
			: null,
		revisionHistory:
			root.revisionHistory === undefined
				? []
				: parseCatalogProductRevisionHistory(root.revisionHistory),
		revisionHistoryAvailable: root.revisionHistoryAvailable !== false,
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
			sources: readArray(evidence.sources, "evidence.sources").map(
				(source, index) => readString(source, `evidence.sources[${index}]`),
			),
		},
		reviewCompletion: parseReviewCompletion(
			root.reviewCompletion,
			"reviewCompletion",
		),
		diagnosticReviewCompletion: parseReviewCompletion(
			root.diagnosticReviewCompletion,
			"diagnosticReviewCompletion",
		),
		reviewDisposition: parseReviewDisposition(
			root.reviewDisposition,
			"reviewDisposition",
		),
		diagnosticReviewDisposition: parseReviewDisposition(
			root.diagnosticReviewDisposition,
			"diagnosticReviewDisposition",
		),
		issues: readArray(root.issues, "issues").map(parseIssue),
	};
};
