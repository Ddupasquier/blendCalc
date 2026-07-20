import type { FdcFood } from "$lib/utils/food/types";
import {
	compareCatalogSubmissionToExistingProduct,
	type CatalogSubmissionComparison,
	type CatalogSubmissionFieldChange,
} from "$lib/utils/products/catalogSubmissionComparison";

export type CatalogUpdateSource = "usda" | "open-food-facts";
export type CatalogUpdateSourceCheckStatus = "exact-match" | "not-found" | "error";

export type CatalogUpdateSourceCheck = {
	source: CatalogUpdateSource;
	status: CatalogUpdateSourceCheckStatus;
	checkedAt: string;
	sourceReference: string | null;
	supportsSubmittedValues: boolean | null;
	supportsCurrentValues: boolean | null;
	submittedDifferences: string[];
};

export type CatalogUpdateSummary = {
	version: 1;
	observedAt: string;
	baseRevisionNumber: number;
	changes: CatalogSubmissionFieldChange[];
	sourceChecks: CatalogUpdateSourceCheck[];
};

export const createCatalogUpdateSourceCheck = (input: {
	source: CatalogUpdateSource;
	status: CatalogUpdateSourceCheckStatus;
	checkedAt: string;
	sourceReference?: string;
	sourceFood?: FdcFood | null;
	submittedFood: FdcFood;
	currentFood: FdcFood;
}): CatalogUpdateSourceCheck => {
	if (input.status !== "exact-match" || !input.sourceFood) {
		return {
			source: input.source,
			status: input.status,
			checkedAt: input.checkedAt,
			sourceReference: input.sourceReference ?? null,
			supportsSubmittedValues: null,
			supportsCurrentValues: null,
			submittedDifferences: [],
		};
	}

	const submittedComparison = compareCatalogSubmissionToExistingProduct(
		input.submittedFood,
		input.sourceFood,
	);
	const currentComparison = compareCatalogSubmissionToExistingProduct(
		input.currentFood,
		input.sourceFood,
	);
	return {
		source: input.source,
		status: input.status,
		checkedAt: input.checkedAt,
		sourceReference: input.sourceReference ?? null,
		supportsSubmittedValues: submittedComparison.matchesExisting,
		supportsCurrentValues: currentComparison.matchesExisting,
		submittedDifferences: submittedComparison.issues,
	};
};

export const createCatalogUpdateSummary = (input: {
	comparison: CatalogSubmissionComparison;
	baseRevisionNumber: number;
	observedAt: string;
	sourceChecks: CatalogUpdateSourceCheck[];
}): CatalogUpdateSummary => ({
	version: 1,
	observedAt: input.observedAt,
	baseRevisionNumber: input.baseRevisionNumber,
	changes: input.comparison.changes,
	sourceChecks: input.sourceChecks,
});

export const readCatalogUpdateSummary = (value: unknown): CatalogUpdateSummary | null => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const record = value as Partial<CatalogUpdateSummary>;
	if (record.version !== 1 || !Array.isArray(record.changes)) return null;
	return {
		version: 1,
		observedAt: typeof record.observedAt === "string" ? record.observedAt : "",
		baseRevisionNumber: Number(record.baseRevisionNumber) || 0,
		changes: record.changes,
		sourceChecks: Array.isArray(record.sourceChecks) ? record.sourceChecks : [],
	};
};

export const formatCatalogChangeValue = (
	value: CatalogSubmissionFieldChange["previousValue"],
) => {
	if (value === null || value === "") return "Not reported";
	if (typeof value === "object") {
		return `${value.value} ${value.unit}`.trim();
	}
	return String(value);
};
