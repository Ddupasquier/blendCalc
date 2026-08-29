/**
 * Purpose: Summarize PostgreSQL JSON query plans and identify sequential scans that
 * process enough rows to justify an evidence-based index review. Do not run directly.
 * Parent workflow: `node scripts/audits/catalog/audit_blendCalcAPI_query_plans.mjs`
 */

const collectPlanNodes = (planNode, nodes = []) => {
	nodes.push(planNode);
	for (const childPlan of planNode.Plans ?? [])
		collectPlanNodes(childPlan, nodes);
	return nodes;
};

export const summarizePostgresQueryPlan = (
	queryPlan,
	sequentialScanReviewRowThreshold = 10_000,
) => {
	const root = queryPlan[0];
	if (!root?.Plan)
		throw new Error("PostgreSQL did not return a JSON query plan.");
	const nodes = collectPlanNodes(root.Plan);
	const sequentialScans = nodes
		.filter((node) => node["Node Type"] === "Seq Scan")
		.map((node) => ({
			relation: node["Relation Name"] ?? "unknown",
			processedRows:
				(Number(node["Actual Rows"]) +
					Number(node["Rows Removed by Filter"] ?? 0)) *
				Number(node["Actual Loops"] ?? 1),
		}))
		.filter((scan) => Number.isFinite(scan.processedRows));

	return {
		planningMilliseconds: Number(root["Planning Time"] ?? 0),
		executionMilliseconds: Number(root["Execution Time"] ?? 0),
		totalCost: Number(root.Plan["Total Cost"] ?? 0),
		returnedRows: Number(root.Plan["Actual Rows"] ?? 0),
		sharedBufferHits: nodes.reduce(
			(total, node) => total + Number(node["Shared Hit Blocks"] ?? 0),
			0,
		),
		sharedBufferReads: nodes.reduce(
			(total, node) => total + Number(node["Shared Read Blocks"] ?? 0),
			0,
		),
		nodeTypes: [...new Set(nodes.map((node) => node["Node Type"]))],
		sequentialScans,
		sequentialScansNeedingReview: sequentialScans.filter(
			(scan) => scan.processedRows >= sequentialScanReviewRowThreshold,
		),
	};
};
