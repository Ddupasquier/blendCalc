type JsonRecord = Record<string, unknown>;

export type CatalogDataOperationsOverview = {
	activeProducts: number;
	publicationReadyProducts: number;
	unresolvedConflicts: number;
	pendingProductSubmissions: number;
	pendingCompatibilityReports: number;
	pendingPreferenceMappings: number;
	nutrientMappingReviewGaps: number;
	revisionHistoryGaps: number;
	datasetReviewGaps: number;
	sourcePolicyGaps: number;
	compatibilityCoverageGaps: number;
};

export type CatalogSourceOperationalHealth = {
	key: string;
	displayName: string;
	sourceType: string;
	enabled: boolean;
	canonicalStorageAllowed: boolean;
	apiRedistributionAllowed: boolean;
	policyReviewedAt: string | null;
	policyIssues: string[];
	metrics: {
		windowDays: number;
		lookups: number;
		completedLookups: number;
		apiRequests: number;
		apiErrors: number;
		cacheHits: number;
		matches: number;
		exactBarcodeMatches: number;
		evaluatedProducts: number;
		reportedNutrients: number;
		brandCoverage: number;
		categoryCoverage: number;
		servingCoverage: number;
		ingredientCoverage: number;
		imageCoverage: number;
		averageResponseMilliseconds: number | null;
	};
	latestEvaluation: {
		kind: string;
		decision: string;
		summary: string;
		evaluatedAt: string;
		sampleSize: number;
		matchedCount: number;
		usableCount: number;
		evidenceUrl: string | null;
	} | null;
};

export type CatalogDatasetOperationalHealth = {
	key: string;
	sourceKey: string;
	displayName: string;
	version: string;
	regionCode: string | null;
	licenseName: string;
	licenseReviewStatus: string;
	importEnabled: boolean;
	active: boolean;
	importedAt: string | null;
	checksumRecorded: boolean;
	foodCount: number;
	nutrientValueCount: number;
	measureCount: number;
	issues: string[];
};

export type FoodWarningPolicyOperationalHealth = {
	version: number | null;
	effectiveAt: string | null;
	reviewedAt: string | null;
	bundleHash: string | null;
	changeSummary: string | null;
	sourceReferenceCount: number;
	selectablePreferenceCount: number;
	coverageGapCount: number;
	pendingPreferenceMappingCount: number;
};

export type CatalogDataOperationsIssues = {
	conflicts: Array<{
		id: string;
		productId: string;
		barcode: string;
		productName: string;
		fieldPath: string;
		severity: string;
		createdAt: string;
	}>;
	publication: Array<{
		productId: string;
		barcode: string;
		productName: string;
		reasons: string[];
	}>;
	nutrientMappings: Array<{
		sourceKey: string;
		sourceNutrientKey: string;
		sourceNutrientName: string | null;
		sourceUnitName: string;
		reviewStatus: string;
		reviewReference: string | null;
	}>;
	revisions: Array<{
		productId: string;
		barcode: string;
		productName: string;
		issue: string;
	}>;
};

export type CatalogDataOperationsHealth = {
	generatedAt: string;
	metricWindowDays: number;
	issueLimit: number;
	overview: CatalogDataOperationsOverview;
	sources: CatalogSourceOperationalHealth[];
	datasets: CatalogDatasetOperationalHealth[];
	policy: FoodWarningPolicyOperationalHealth;
	issues: CatalogDataOperationsIssues;
};

const readRecord = (value: unknown, field: string): JsonRecord => {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`Invalid catalog data-operations field: ${field}`);
	}
	return value as JsonRecord;
};

const readArray = (value: unknown, field: string): unknown[] => {
	if (!Array.isArray(value)) {
		throw new TypeError(`Invalid catalog data-operations field: ${field}`);
	}
	return value;
};

const readString = (value: unknown, field: string): string => {
	if (typeof value !== "string") {
		throw new TypeError(`Invalid catalog data-operations field: ${field}`);
	}
	return value;
};

const readNullableString = (value: unknown, field: string): string | null =>
	value === null ? null : readString(value, field);

const readNumber = (value: unknown, field: string): number => {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new TypeError(`Invalid catalog data-operations field: ${field}`);
	}
	return value;
};

const readNullableNumber = (value: unknown, field: string): number | null =>
	value === null ? null : readNumber(value, field);

const readBoolean = (value: unknown, field: string): boolean => {
	if (typeof value !== "boolean") {
		throw new TypeError(`Invalid catalog data-operations field: ${field}`);
	}
	return value;
};

const readStringArray = (value: unknown, field: string): string[] =>
	readArray(value, field).map((entry, index) =>
		readString(entry, `${field}[${index}]`));

const parseOverview = (value: unknown): CatalogDataOperationsOverview => {
	const row = readRecord(value, "overview");
	return {
		activeProducts: readNumber(row.activeProducts, "overview.activeProducts"),
		publicationReadyProducts: readNumber(row.publicationReadyProducts, "overview.publicationReadyProducts"),
		unresolvedConflicts: readNumber(row.unresolvedConflicts, "overview.unresolvedConflicts"),
		pendingProductSubmissions: readNumber(row.pendingProductSubmissions, "overview.pendingProductSubmissions"),
		pendingCompatibilityReports: readNumber(row.pendingCompatibilityReports, "overview.pendingCompatibilityReports"),
		pendingPreferenceMappings: readNumber(row.pendingPreferenceMappings, "overview.pendingPreferenceMappings"),
		nutrientMappingReviewGaps: readNumber(row.nutrientMappingReviewGaps, "overview.nutrientMappingReviewGaps"),
		revisionHistoryGaps: readNumber(row.revisionHistoryGaps, "overview.revisionHistoryGaps"),
		datasetReviewGaps: readNumber(row.datasetReviewGaps, "overview.datasetReviewGaps"),
		sourcePolicyGaps: readNumber(row.sourcePolicyGaps, "overview.sourcePolicyGaps"),
		compatibilityCoverageGaps: readNumber(row.compatibilityCoverageGaps, "overview.compatibilityCoverageGaps"),
	};
};

const parseSource = (value: unknown, index: number): CatalogSourceOperationalHealth => {
	const path = `sources[${index}]`;
	const row = readRecord(value, path);
	const metrics = readRecord(row.metrics, `${path}.metrics`);
	const evaluation = row.latestEvaluation === null
		? null
		: readRecord(row.latestEvaluation, `${path}.latestEvaluation`);

	return {
		key: readString(row.key, `${path}.key`),
		displayName: readString(row.displayName, `${path}.displayName`),
		sourceType: readString(row.sourceType, `${path}.sourceType`),
		enabled: readBoolean(row.enabled, `${path}.enabled`),
		canonicalStorageAllowed: readBoolean(row.canonicalStorageAllowed, `${path}.canonicalStorageAllowed`),
		apiRedistributionAllowed: readBoolean(row.apiRedistributionAllowed, `${path}.apiRedistributionAllowed`),
		policyReviewedAt: readNullableString(row.policyReviewedAt, `${path}.policyReviewedAt`),
		policyIssues: readStringArray(row.policyIssues, `${path}.policyIssues`),
		metrics: {
			windowDays: readNumber(metrics.windowDays, `${path}.metrics.windowDays`),
			lookups: readNumber(metrics.lookups, `${path}.metrics.lookups`),
			completedLookups: readNumber(metrics.completedLookups, `${path}.metrics.completedLookups`),
			apiRequests: readNumber(metrics.apiRequests, `${path}.metrics.apiRequests`),
			apiErrors: readNumber(metrics.apiErrors, `${path}.metrics.apiErrors`),
			cacheHits: readNumber(metrics.cacheHits, `${path}.metrics.cacheHits`),
			matches: readNumber(metrics.matches, `${path}.metrics.matches`),
			exactBarcodeMatches: readNumber(metrics.exactBarcodeMatches, `${path}.metrics.exactBarcodeMatches`),
			evaluatedProducts: readNumber(metrics.evaluatedProducts, `${path}.metrics.evaluatedProducts`),
			reportedNutrients: readNumber(metrics.reportedNutrients, `${path}.metrics.reportedNutrients`),
			brandCoverage: readNumber(metrics.brandCoverage, `${path}.metrics.brandCoverage`),
			categoryCoverage: readNumber(metrics.categoryCoverage, `${path}.metrics.categoryCoverage`),
			servingCoverage: readNumber(metrics.servingCoverage, `${path}.metrics.servingCoverage`),
			ingredientCoverage: readNumber(metrics.ingredientCoverage, `${path}.metrics.ingredientCoverage`),
			imageCoverage: readNumber(metrics.imageCoverage, `${path}.metrics.imageCoverage`),
			averageResponseMilliseconds: readNullableNumber(metrics.averageResponseMilliseconds, `${path}.metrics.averageResponseMilliseconds`),
		},
		latestEvaluation: evaluation
			? {
				kind: readString(evaluation.kind, `${path}.latestEvaluation.kind`),
				decision: readString(evaluation.decision, `${path}.latestEvaluation.decision`),
				summary: readString(evaluation.summary, `${path}.latestEvaluation.summary`),
				evaluatedAt: readString(evaluation.evaluatedAt, `${path}.latestEvaluation.evaluatedAt`),
				sampleSize: readNumber(evaluation.sampleSize, `${path}.latestEvaluation.sampleSize`),
				matchedCount: readNumber(evaluation.matchedCount, `${path}.latestEvaluation.matchedCount`),
				usableCount: readNumber(evaluation.usableCount, `${path}.latestEvaluation.usableCount`),
				evidenceUrl: readNullableString(evaluation.evidenceUrl, `${path}.latestEvaluation.evidenceUrl`),
			}
			: null,
	};
};

const compareModeratorSourcesByDescendingLookupUsage = (
	firstSource: CatalogSourceOperationalHealth,
	secondSource: CatalogSourceOperationalHealth,
) =>
	secondSource.metrics.lookups - firstSource.metrics.lookups ||
	firstSource.displayName.localeCompare(secondSource.displayName, "en", {
		sensitivity: "base",
	}) ||
	firstSource.key.localeCompare(secondSource.key, "en");

const parseDataset = (value: unknown, index: number): CatalogDatasetOperationalHealth => {
	const path = `datasets[${index}]`;
	const row = readRecord(value, path);
	return {
		key: readString(row.key, `${path}.key`),
		sourceKey: readString(row.sourceKey, `${path}.sourceKey`),
		displayName: readString(row.displayName, `${path}.displayName`),
		version: readString(row.version, `${path}.version`),
		regionCode: readNullableString(row.regionCode, `${path}.regionCode`),
		licenseName: readString(row.licenseName, `${path}.licenseName`),
		licenseReviewStatus: readString(row.licenseReviewStatus, `${path}.licenseReviewStatus`),
		importEnabled: readBoolean(row.importEnabled, `${path}.importEnabled`),
		active: readBoolean(row.active, `${path}.active`),
		importedAt: readNullableString(row.importedAt, `${path}.importedAt`),
		checksumRecorded: readBoolean(row.checksumRecorded, `${path}.checksumRecorded`),
		foodCount: readNumber(row.foodCount, `${path}.foodCount`),
		nutrientValueCount: readNumber(row.nutrientValueCount, `${path}.nutrientValueCount`),
		measureCount: readNumber(row.measureCount, `${path}.measureCount`),
		issues: readStringArray(row.issues, `${path}.issues`),
	};
};

const parsePolicy = (value: unknown): FoodWarningPolicyOperationalHealth => {
	const row = readRecord(value, "policy");
	return {
		version: readNullableNumber(row.version, "policy.version"),
		effectiveAt: readNullableString(row.effectiveAt, "policy.effectiveAt"),
		reviewedAt: readNullableString(row.reviewedAt, "policy.reviewedAt"),
		bundleHash: readNullableString(row.bundleHash, "policy.bundleHash"),
		changeSummary: readNullableString(row.changeSummary, "policy.changeSummary"),
		sourceReferenceCount: readNumber(row.sourceReferenceCount, "policy.sourceReferenceCount"),
		selectablePreferenceCount: readNumber(row.selectablePreferenceCount, "policy.selectablePreferenceCount"),
		coverageGapCount: readNumber(row.coverageGapCount, "policy.coverageGapCount"),
		pendingPreferenceMappingCount: readNumber(row.pendingPreferenceMappingCount, "policy.pendingPreferenceMappingCount"),
	};
};

const parseIssues = (value: unknown): CatalogDataOperationsIssues => {
	const row = readRecord(value, "issues");
	return {
		conflicts: readArray(row.conflicts, "issues.conflicts").map((value, index) => {
			const path = `issues.conflicts[${index}]`;
			const issue = readRecord(value, path);
			return {
				id: readString(issue.id, `${path}.id`),
				productId: readString(issue.productId, `${path}.productId`),
				barcode: readString(issue.barcode, `${path}.barcode`),
				productName: readString(issue.productName, `${path}.productName`),
				fieldPath: readString(issue.fieldPath, `${path}.fieldPath`),
				severity: readString(issue.severity, `${path}.severity`),
				createdAt: readString(issue.createdAt, `${path}.createdAt`),
			};
		}),
		publication: readArray(row.publication, "issues.publication").map((value, index) => {
			const path = `issues.publication[${index}]`;
			const issue = readRecord(value, path);
			return {
				productId: readString(issue.productId, `${path}.productId`),
				barcode: readString(issue.barcode, `${path}.barcode`),
				productName: readString(issue.productName, `${path}.productName`),
				reasons: readStringArray(issue.reasons, `${path}.reasons`),
			};
		}),
		nutrientMappings: readArray(row.nutrientMappings, "issues.nutrientMappings").map((value, index) => {
			const path = `issues.nutrientMappings[${index}]`;
			const issue = readRecord(value, path);
			return {
				sourceKey: readString(issue.sourceKey, `${path}.sourceKey`),
				sourceNutrientKey: readString(issue.sourceNutrientKey, `${path}.sourceNutrientKey`),
				sourceNutrientName: readNullableString(issue.sourceNutrientName, `${path}.sourceNutrientName`),
				sourceUnitName: readString(issue.sourceUnitName, `${path}.sourceUnitName`),
				reviewStatus: readString(issue.reviewStatus, `${path}.reviewStatus`),
				reviewReference: readNullableString(issue.reviewReference, `${path}.reviewReference`),
			};
		}),
		revisions: readArray(row.revisions, "issues.revisions").map((value, index) => {
			const path = `issues.revisions[${index}]`;
			const issue = readRecord(value, path);
			return {
				productId: readString(issue.productId, `${path}.productId`),
				barcode: readString(issue.barcode, `${path}.barcode`),
				productName: readString(issue.productName, `${path}.productName`),
				issue: readString(issue.issue, `${path}.issue`),
			};
		}),
	};
};

export const parseCatalogDataOperationsHealth = (
	value: unknown,
): CatalogDataOperationsHealth => {
	const row = readRecord(value, "dashboard");
	return {
		generatedAt: readString(row.generatedAt, "generatedAt"),
		metricWindowDays: readNumber(row.metricWindowDays, "metricWindowDays"),
		issueLimit: readNumber(row.issueLimit, "issueLimit"),
		overview: parseOverview(row.overview),
		sources: readArray(row.sources, "sources")
			.map(parseSource)
			.sort(compareModeratorSourcesByDescendingLookupUsage),
		datasets: readArray(row.datasets, "datasets").map(parseDataset),
		policy: parsePolicy(row.policy),
		issues: parseIssues(row.issues),
	};
};
