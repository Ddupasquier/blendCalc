import { describe, expect, it } from "vitest";
import {
	auditOpenFoodFactsNutrientMappings,
	createOpenFoodFactsPendingMappingRows,
	getOpenFoodFactsObservationRows,
	getOpenFoodFactsTaxonomyRows,
} from "../../scripts/lib/nutrition/openFoodFactsNutrientMappingAudit.mjs";

const taxonomy = {
	"en:calcium": { name: { en: "Calcium" }, unit: { en: "mg" } },
	"en:future-nutrient": {
		name: { en: "Future nutrient" },
		unit: { en: "µg" },
	},
	"en:pending-nutrient": {
		name: { en: "Pending nutrient" },
		unit: { en: "g" },
	},
	"en:no-unit": { name: { en: "No unit" } },
};

describe("Open Food Facts nutrient mapping audit", () => {
	it("normalizes the complete taxonomy into exact source identities", () => {
		expect(getOpenFoodFactsTaxonomyRows(taxonomy)).toEqual([
			expect.objectContaining({
				sourceNutrientKey: "calcium",
				sourceUnitName: "MG",
			}),
			expect.objectContaining({
				sourceNutrientKey: "future-nutrient",
				sourceUnitName: "UG",
			}),
			expect.objectContaining({
				sourceNutrientKey: "pending-nutrient",
				sourceUnitName: "G",
			}),
		]);
	});

	it("keeps observed identities anonymous and bounded to mapping evidence", () => {
		expect(
			getOpenFoodFactsObservationRows([
				{
					source_key: "open-food-facts",
					source_nutrient_key: "future-nutrient",
					source_nutrient_name: "Future nutrient",
					source_unit_name: "µg",
					observation_count: 3,
					first_observed_at: "2026-09-01T00:00:00Z",
					last_observed_at: "2026-09-02T00:00:00Z",
					barcode: "must-not-be-consumed",
				},
			]),
		).toEqual([
			{
				sourceNutrientKey: "future-nutrient",
				sourceNutrientName: "Future nutrient",
				sourceUnitName: "UG",
				observationCount: 3,
				firstObservedAt: "2026-09-01T00:00:00Z",
				lastObservedAt: "2026-09-02T00:00:00Z",
			},
		]);
	});

	it("separates approved, queued, candidate, and unsupported identities", () => {
		const audit = auditOpenFoodFactsNutrientMappings({
			taxonomy,
			observations: [
				{
					source_key: "open-food-facts",
					source_nutrient_key: "future-nutrient",
					source_nutrient_name: "Future nutrient",
					source_unit_name: "UG",
					observation_count: 3,
					first_observed_at: "2026-09-01T00:00:00Z",
					last_observed_at: "2026-09-02T00:00:00Z",
				},
			],
			definitions: [
				{
					nutrient_id: 9998,
					nutrient_name: "Future nutrient",
					default_unit_name: "UG",
				},
			],
			mappings: [
				{
					source_key: "open-food-facts",
					source_nutrient_key: "calcium",
					source_unit_name: "mg",
					nutrient_id: 1087,
					review_status: "approved",
					enabled: true,
				},
				{
					source_key: "open-food-facts",
					source_nutrient_key: "pending-nutrient",
					source_unit_name: "G",
					nutrient_id: 9999,
					review_status: "pending_review",
					enabled: false,
				},
			],
		});

		expect(audit.counts).toEqual({
			approved: 1,
			pendingReview: 1,
			rejected: 0,
			candidateMissing: 1,
			unsupported: 0,
			observedCandidateMissing: 1,
			observedUnsupported: 0,
		});
		expect(audit.observedIdentityCount).toBe(1);
		expect(audit.actionableUnresolved).toHaveLength(1);
		expect(audit.unresolved.map((row) => row.sourceNutrientKey)).toEqual([
			"future-nutrient",
			"pending-nutrient",
		]);
		expect(
			createOpenFoodFactsPendingMappingRows(audit, "2026-09-02T00:00:00.000Z"),
		).toMatchObject([
			{
				source_nutrient_key: "future-nutrient",
				source_unit_name: "UG",
				nutrient_id: 9998,
				review_status: "pending_review",
				enabled: false,
				mapping_method: "api_observation_match",
				observation_count: 3,
			},
		]);
	});

	it("does not queue a taxonomy-only candidate until a trusted cache sees it", () => {
		const audit = auditOpenFoodFactsNutrientMappings({
			taxonomy,
			mappings: [],
			definitions: [
				{
					nutrient_id: 9998,
					nutrient_name: "Future nutrient",
					default_unit_name: "UG",
				},
			],
		});

		expect(audit.counts.candidateMissing).toBe(1);
		expect(audit.counts.observedCandidateMissing).toBe(0);
		expect(
			createOpenFoodFactsPendingMappingRows(audit, "2026-09-02T00:00:00.000Z"),
		).toEqual([]);
	});
});
