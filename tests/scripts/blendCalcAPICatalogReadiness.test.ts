import { describe, expect, it } from "vitest";
import {
	buildCatalogReadinessSummary,
	classifyCatalogReadinessIssue,
	isCatalogReadinessContractUnavailable,
} from "../../scripts/lib/catalog/blendCalcAPICatalogReadiness.mjs";

describe("API catalog readiness audit helpers", () => {
	it("prioritizes a reviewed automated repair over work-group routing", () => {
		expect(
			classifyCatalogReadinessIssue({
				automated_repair_allowed: true,
				responsible_group: "data_operations",
			}),
		).toBe("safe_automated_repair");
		expect(
			classifyCatalogReadinessIssue({
				automated_repair_allowed: false,
				responsible_group: "catalog_review",
			}),
		).toBe("catalog_review");
		expect(classifyCatalogReadinessIssue(null)).toBe("unclassified");
	});

	it("summarizes current readiness without treating every blocker as human review", () => {
		const summary = buildCatalogReadinessSummary([
			{ api: "included", reasons: [], issues: [] },
			{
				api: "withheld",
				reasons: [
					"missing_current_revision",
					"missing_field_provenance:brandOwner",
				],
				issues: [
					{
						issueCode: "CATALOG_REVISION_MISSING",
						owner: "safe_automated_repair",
					},
					{
						issueCode: "CATALOG_FIELD_PROVENANCE_MISSING",
						owner: "safe_automated_repair",
					},
				],
			},
			{
				api: "withheld",
				reasons: ["missing_required_field:ingredients"],
				issues: [
					{
						issueCode: "CATALOG_REQUIRED_FIELD_MISSING",
						owner: "catalog_review",
					},
				],
			},
			{
				api: "withheld",
				reasons: ["field_source_not_redistributable"],
				issues: [
					{
						issueCode: "API_REDISTRIBUTION_REVIEW_REQUIRED",
						owner: "external_review",
					},
				],
			},
		]);

		expect(summary).toMatchObject({
			activeSharedProducts: 4,
			apiIncluded: 1,
			apiWithheld: 3,
			withheldWithSafeAutomatedRepairs: 1,
			withheldNeedingCatalogReview: 1,
			withheldNeedingExternalReview: 1,
			withheldWithoutIssueContract: 0,
			allIncludedRowsPassedPolicyGate: true,
		});
		expect(summary.withholdingReasonCounts).toEqual({
			field_source_not_redistributable: 1,
			"missing_field_provenance:brandOwner": 1,
			missing_current_revision: 1,
			"missing_required_field:ingredients": 1,
		});
		expect(summary.issueCodeCounts.CATALOG_REVISION_MISSING).toBe(1);
	});

	it("flags withheld products whose blocker has no operational contract", () => {
		const summary = buildCatalogReadinessSummary([
			{
				api: "withheld",
				reasons: ["readiness_not_evaluated"],
				issues: [],
			},
		]);

		expect(summary.withheldWithoutIssueContract).toBe(1);
	});

	it("treats only missing rollout contracts as temporarily unavailable", () => {
		expect(
			isCatalogReadinessContractUnavailable({
				code: "42703",
				message: "column app_issue_codes.operational_severity does not exist",
			}),
		).toBe(true);
		expect(
			isCatalogReadinessContractUnavailable({
				code: "42501",
				message: "permission denied",
			}),
		).toBe(false);
		expect(
			isCatalogReadinessContractUnavailable(new Error("network failed")),
		).toBe(false);
	});
});
