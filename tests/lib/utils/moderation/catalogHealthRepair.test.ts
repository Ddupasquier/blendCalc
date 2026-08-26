import { describe, expect, it } from "vitest";
import {
	getCatalogHealthRepairItemLabel,
	getCatalogHealthRepairReasonLabel,
	parseCatalogHealthRepairResult,
} from "$lib/utils/moderation/catalogHealthRepair";
import { catalogHealthRepairDryRunFixture } from "../../../fixtures/catalogHealthRepair";

describe("catalog health repair contract", () => {
	it("parses the bounded dry-run result", () => {
		expect(
			parseCatalogHealthRepairResult(catalogHealthRepairDryRunFixture),
		).toEqual(catalogHealthRepairDryRunFixture);
	});

	it("rejects malformed counts, modes, and items", () => {
		expect(() =>
			parseCatalogHealthRepairResult({
				...catalogHealthRepairDryRunFixture,
				candidateCount: -1,
			}),
		).toThrow(/candidateCount/u);
		expect(() =>
			parseCatalogHealthRepairResult({
				...catalogHealthRepairDryRunFixture,
				mode: "automatic",
			}),
		).toThrow(/mode/u);
		expect(() =>
			parseCatalogHealthRepairResult({
				...catalogHealthRepairDryRunFixture,
				items: [{}],
			}),
		).toThrow(/items\[0\]/u);
	});

	it("translates repair details without exposing database codes", () => {
		expect(getCatalogHealthRepairItemLabel("nutrient:1003")).toBe(
			"Nutrition value",
		);
		expect(getCatalogHealthRepairItemLabel("serving")).toBe("Primary serving");
		expect(getCatalogHealthRepairItemLabel("revision:baseline")).toBe(
			"First catalog revision",
		);
		expect(getCatalogHealthRepairItemLabel("revision:4")).toBe(
			"Revision change history",
		);
		expect(getCatalogHealthRepairReasonLabel("exact_nutrient_match")).toContain(
			"exact reusable source record",
		);
		expect(
			getCatalogHealthRepairReasonLabel("exact_submission_revision_baseline"),
		).toContain("approved matching submission");
		expect(
			getCatalogHealthRepairReasonLabel(
				"structured_revision_change_evidence_missing",
			),
		).toContain("does not contain enough exact detail");
		expect(getCatalogHealthRepairReasonLabel("unknown_reason")).toBe(
			"This item still needs supporting evidence.",
		);
	});
});
