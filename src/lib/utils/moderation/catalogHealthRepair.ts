type JsonRecord = Record<string, unknown>;

export type CatalogHealthRepairMode = "dry_run" | "apply";

export type CatalogHealthRepairItem = {
	itemKey: string;
	result: string;
	reasonCode: string;
};

export type CatalogHealthRepairResult = {
	runId: string;
	mode: CatalogHealthRepairMode;
	status: string;
	candidateCount: number;
	changedCount: number;
	skippedCount: number;
	unresolvedCount: number;
	items: CatalogHealthRepairItem[];
};

export type CatalogHealthRepairActionData = {
	catalogRepairOccurrenceKey?: string;
	catalogRepairError?: string;
	catalogRepairSuccess?: string;
	catalogRepairResult?: CatalogHealthRepairResult;
};

const readRecord = (value: unknown, field: string): JsonRecord => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new TypeError(`Invalid catalog repair field: ${field}`);
	}
	return value as JsonRecord;
};

const readString = (value: unknown, field: string): string => {
	if (typeof value !== "string" || value.length === 0) {
		throw new TypeError(`Invalid catalog repair field: ${field}`);
	}
	return value;
};

const readCount = (value: unknown, field: string): number => {
	if (!Number.isInteger(value) || (value as number) < 0) {
		throw new TypeError(`Invalid catalog repair field: ${field}`);
	}
	return value as number;
};

const readMode = (value: unknown): CatalogHealthRepairMode => {
	if (value !== "dry_run" && value !== "apply") {
		throw new TypeError("Invalid catalog repair field: mode");
	}
	return value;
};

const parseCatalogHealthRepairItem = (
	value: unknown,
	index: number,
): CatalogHealthRepairItem => {
	const path = `items[${index}]`;
	const item = readRecord(value, path);
	return {
		itemKey: readString(item.itemKey, `${path}.itemKey`),
		result: readString(item.result, `${path}.result`),
		reasonCode: readString(item.reasonCode, `${path}.reasonCode`),
	};
};

export const parseCatalogHealthRepairResult = (
	value: unknown,
): CatalogHealthRepairResult => {
	const result = readRecord(value, "root");
	if (!Array.isArray(result.items)) {
		throw new TypeError("Invalid catalog repair field: items");
	}

	return {
		runId: readString(result.runId, "runId"),
		mode: readMode(result.mode),
		status: readString(result.status, "status"),
		candidateCount: readCount(result.candidateCount, "candidateCount"),
		changedCount: readCount(result.changedCount, "changedCount"),
		skippedCount: readCount(result.skippedCount, "skippedCount"),
		unresolvedCount: readCount(result.unresolvedCount, "unresolvedCount"),
		items: result.items.map(parseCatalogHealthRepairItem),
	};
};

const CATALOG_REPAIR_REASON_LABELS: Record<string, string> = {
	already_repaired: "This evidence link is already in place.",
	canonical_value_missing: "The current product value is missing, so there is nothing safe to link.",
	exact_observation_revision_baseline: "An exact stored source record can restore the first catalog revision.",
	exact_nutrient_match: "An exact reusable source record matches this nutrition value.",
	exact_revision_baseline_evidence_missing: "No exact stored record can safely reconstruct the first catalog revision.",
	exact_serving_match: "An exact reusable source record matches this serving.",
	exact_submission_revision_baseline: "An approved matching submission can restore the first catalog revision.",
	exact_value_match: "An exact reusable source record matches this product information.",
	no_exact_redistributable_observation: "No exact reusable source record matches the current value.",
	primary_serving_missing: "This product does not have a primary serving to verify.",
	product_required: "This issue is not connected to a catalog product.",
	repair_execution_failed: "The safety check stopped before making an uncertain change.",
	repair_handler_not_available: "This issue does not have a safe automated repair yet.",
	structured_revision_change_available: "The stored revision summary contains enough exact detail to restore its change history.",
	structured_revision_change_evidence_missing: "The stored revision summary does not contain enough exact detail to reconstruct what changed.",
};

export const getCatalogHealthRepairReasonLabel = (reasonCode: string) =>
	CATALOG_REPAIR_REASON_LABELS[reasonCode]
	?? "This item still needs supporting evidence.";

export const getCatalogHealthRepairItemLabel = (itemKey: string) => {
	if (itemKey === "serving") return "Primary serving";
	if (itemKey.startsWith("nutrient:")) return "Nutrition value";
	if (itemKey === "revision:baseline") return "First catalog revision";
	if (itemKey.startsWith("revision:")) return "Revision change history";
	return itemKey;
};
