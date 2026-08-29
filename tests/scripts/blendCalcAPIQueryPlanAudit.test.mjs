import { describe, expect, it } from "vitest";
import { summarizePostgresQueryPlan } from "../../scripts/lib/catalog/blendCalcAPIQueryPlanAudit.mjs";

describe("blendCalcAPI query-plan audit", () => {
	it("summarizes nested plan costs, buffers, and node types", () => {
		const summary = summarizePostgresQueryPlan([
			{
				Plan: {
					"Node Type": "Limit",
					"Total Cost": 12.5,
					"Actual Rows": 1,
					"Shared Hit Blocks": 2,
					Plans: [
						{
							"Node Type": "Index Scan",
							"Actual Rows": 1,
							"Actual Loops": 1,
							"Shared Hit Blocks": 4,
						},
					],
				},
				"Planning Time": 0.2,
				"Execution Time": 1.4,
			},
		]);

		expect(summary).toMatchObject({
			planningMilliseconds: 0.2,
			executionMilliseconds: 1.4,
			totalCost: 12.5,
			returnedRows: 1,
			sharedBufferHits: 6,
			sharedBufferReads: 0,
			nodeTypes: ["Limit", "Index Scan"],
			sequentialScans: [],
			sequentialScansNeedingReview: [],
		});
	});

	it("requires review only when a sequential scan crosses the evidence threshold", () => {
		const summary = summarizePostgresQueryPlan(
			[
				{
					Plan: {
						"Node Type": "Seq Scan",
						"Relation Name": "shared_products",
						"Actual Rows": 250,
						"Rows Removed by Filter": 750,
						"Actual Loops": 2,
					},
				},
			],
			2_000,
		);

		expect(summary.sequentialScans).toEqual([
			{ relation: "shared_products", processedRows: 2_000 },
		]);
		expect(summary.sequentialScansNeedingReview).toEqual(
			summary.sequentialScans,
		);
	});
});
