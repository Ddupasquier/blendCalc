/**
 * Purpose: Classify current catalog publication blockers by their database-owned
 * repair contract and summarize a fresh read-only API readiness audit.
 * Do not run directly.
 * Parent workflow: `npm run audit:blendCalcAPI-catalog`
 */

/** @type {Readonly<Record<string, string>>} */
const READINESS_OWNER_BY_RESPONSIBLE_GROUP = {
	catalog_review: "catalog_review",
	data_operations: "data_operations_review",
	external_review: "external_review",
	food_policy_review: "food_policy_review",
	system: "system_investigation",
};

const ROLLOUT_MISSING_CONTRACT_CODES = new Set([
	"42703",
	"42P01",
	"PGRST200",
	"PGRST204",
	"PGRST205",
]);

const REDISTRIBUTION_POLICY_REASONS = new Set([
	"api_redistribution_not_approved",
	"field_source_not_redistributable",
	"nutrient_source_not_redistributable",
	"serving_source_not_redistributable",
]);

const REDISTRIBUTION_POLICY_ISSUE_CODES = new Set([
	"API_REDISTRIBUTION_REVIEW_REQUIRED",
]);

/** @param {string} reason */
export const isRedistributionPolicyReason = (reason) =>
	REDISTRIBUTION_POLICY_REASONS.has(reason.split(":", 1)[0]);

/** @param {string[]} reasons */
export const separateCatalogReadinessReasons = (reasons) => ({
	repairReasons: reasons.filter(
		(reason) => !isRedistributionPolicyReason(reason),
	),
	redistributionPolicyReasons: reasons.filter(isRedistributionPolicyReason),
});

/** @param {{ issueCode: string; reason?: string; owner?: string }[]} issues */
export const separateCatalogReadinessIssues = (issues) => ({
	repairIssues: issues.filter(
		(issue) =>
			!REDISTRIBUTION_POLICY_ISSUE_CODES.has(issue.issueCode) &&
			!(issue.reason && isRedistributionPolicyReason(issue.reason)),
	),
	redistributionPolicyIssues: issues.filter(
		(issue) =>
			REDISTRIBUTION_POLICY_ISSUE_CODES.has(issue.issueCode) ||
			Boolean(issue.reason && isRedistributionPolicyReason(issue.reason)),
	),
});

/** @param {unknown} error */
export const isCatalogReadinessContractUnavailable = (error) => {
	if (!error || typeof error !== "object") return false;
	const code =
		"code" in error && typeof error.code === "string" ? error.code : "";
	const message =
		"message" in error && typeof error.message === "string"
			? error.message.toLowerCase()
			: "";
	return (
		ROLLOUT_MISSING_CONTRACT_CODES.has(code) &&
		(message.includes("does not exist") ||
			message.includes("schema cache") ||
			message.includes("could not find"))
	);
};

/**
 * @param {{
 *   automated_repair_allowed?: boolean;
 *   responsible_group?: string;
 * } | null | undefined} issueContract
 */
export const classifyCatalogReadinessIssue = (issueContract) => {
	if (issueContract?.automated_repair_allowed) return "safe_automated_repair";
	if (!issueContract?.responsible_group) return "unclassified";
	return (
		READINESS_OWNER_BY_RESPONSIBLE_GROUP[issueContract.responsible_group] ??
		"unclassified"
	);
};

/** @param {string[]} values */
const countValues = (values) =>
	Object.fromEntries(
		[
			...values.reduce((counts, value) => {
				counts.set(value, (counts.get(value) ?? 0) + 1);
				return counts;
			}, new Map()),
		].sort(([left], [right]) => left.localeCompare(right)),
	);

/**
 * @param {Array<{
 *   api: string;
 *   reasons: string[];
 *   issues: Array<{ issueCode: string; owner: string }>;
 * }>} report
 */
export const buildCatalogReadinessSummary = (report) => {
	const withheldRows = report.filter((row) => row.api === "withheld");
	const classifiedRows = withheldRows.map((row) => ({
		...row,
		...separateCatalogReadinessReasons(row.reasons),
		...separateCatalogReadinessIssues(row.issues),
	}));
	const repairRows = classifiedRows.filter(
		(row) =>
			row.repairReasons.length > 0 ||
			(row.repairReasons.length === 0 &&
				row.redistributionPolicyReasons.length === 0),
	);
	const redistributionPolicyRows = classifiedRows.filter(
		(row) => row.redistributionPolicyReasons.length > 0,
	);
	const redistributionPolicyOnlyRows = redistributionPolicyRows.filter(
		(row) => row.repairReasons.length === 0,
	);
	/** @param {string} owner */
	const countWithOwner = (owner) =>
		repairRows.filter((row) =>
			row.repairIssues.some((issue) => issue.owner === owner),
		).length;

	return {
		activeSharedProducts: report.length,
		apiIncluded: report.length - withheldRows.length,
		apiWithheld: withheldRows.length,
		withheldNeedingRemediation: repairRows.length,
		withheldByRedistributionPolicy: redistributionPolicyRows.length,
		withheldOnlyByRedistributionPolicy: redistributionPolicyOnlyRows.length,
		withheldWithSafeAutomatedRepairs: countWithOwner("safe_automated_repair"),
		withheldNeedingCatalogReview: countWithOwner("catalog_review"),
		withheldNeedingDataOperationsReview: countWithOwner(
			"data_operations_review",
		),
		withheldNeedingFoodPolicyReview: countWithOwner("food_policy_review"),
		withheldNeedingExternalReview: countWithOwner("external_review"),
		withheldNeedingSystemInvestigation: countWithOwner("system_investigation"),
		withheldWithoutIssueContract: repairRows.filter(
			(row) =>
				row.repairIssues.length === 0 ||
				row.repairIssues.some((issue) => issue.owner === "unclassified"),
		).length,
		withholdingReasonCounts: countValues(
			repairRows.flatMap((row) => row.repairReasons),
		),
		redistributionPolicyReasonCounts: countValues(
			redistributionPolicyRows.flatMap(
				(row) => row.redistributionPolicyReasons,
			),
		),
		issueCodeCounts: countValues(
			repairRows.flatMap((row) =>
				row.repairIssues.map((issue) => issue.issueCode),
			),
		),
		redistributionPolicyIssueCodeCounts: countValues(
			redistributionPolicyRows.flatMap((row) =>
				row.redistributionPolicyIssues.map((issue) => issue.issueCode),
			),
		),
		allIncludedRowsPassedPolicyGate: report
			.filter((row) => row.api === "included")
			.every((row) => row.reasons.length === 0),
	};
};
