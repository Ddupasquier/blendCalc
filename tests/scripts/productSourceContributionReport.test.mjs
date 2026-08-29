import { describe, expect, it } from "vitest";
import {
	buildSourceContributionReport,
	buildSourceOperationalRows,
} from "../../scripts/lib/catalog/productSourceContributionReport.mjs";

const sourceNames = new Map([
	["open-food-facts", "Open Food Facts"],
	["usda", "USDA FoodData Central"],
]);

describe("product source contribution report", () => {
	it("aggregates request, cache, coverage, and response metrics by source", () => {
		const rows = buildSourceOperationalRows(
			[
				{
					source_key: "usda",
					lookup_count: 2,
					api_request_count: 3,
					api_error_count: 1,
					cache_hit_count: 1,
					completed_lookup_count: 2,
					match_count: 1,
					exact_barcode_match_count: 1,
					evaluated_product_count: 1,
					reported_nutrient_total: 20,
					brand_present_count: 1,
					category_present_count: 1,
					serving_present_count: 1,
					ingredients_present_count: 0,
					image_present_count: 0,
					response_milliseconds_total: 400,
				},
				{
					source_key: "usda",
					lookup_count: 1,
					api_request_count: 0,
					cache_hit_count: 1,
					completed_lookup_count: 1,
					match_count: 1,
					exact_barcode_match_count: 1,
					evaluated_product_count: 1,
					reported_nutrient_total: 10,
					brand_present_count: 1,
					category_present_count: 0,
					serving_present_count: 0,
					ingredients_present_count: 0,
					image_present_count: 0,
					response_milliseconds_total: 200,
				},
			],
			sourceNames,
		);

		expect(rows).toEqual([
			expect.objectContaining({
				sourceKey: "usda",
				source: "USDA FoodData Central",
				lookups: 3,
				apiRequests: 3,
				requestsPerLookup: 1,
				cacheHits: 2,
				apiErrors: 1,
				matchPercent: 66.7,
				exactBarcodeMatches: 2,
				averageNutrients: 15,
				averageResponseMilliseconds: 200,
			}),
		]);
	});

	it("keeps canonical contributions, missing fields, and disagreements distinct", () => {
		const report = buildSourceContributionReport({
			observationRows: [
				{ id: "observation-usda", source: "usda" },
				{ id: "observation-off", source: "open-food-facts" },
			],
			selectedProvenanceRows: [
				{ observation_id: "observation-usda", field_path: "nutrient:1008" },
				{ observation_id: "observation-off", field_path: "ingredientsText" },
				{ observation_id: "missing-observation", field_path: "brandOwner" },
			],
			coverageRows: [
				{
					provider_key: "usda",
					field_path: "nutrients",
					coverage_status: "reported",
				},
				{
					provider_key: "usda",
					field_path: "ingredientsText",
					coverage_status: "not-reported",
				},
				{
					provider_key: "open-food-facts",
					field_path: "alcoholByVolume",
					coverage_status: "not-applicable",
				},
				{
					provider_key: "open-food-facts",
					field_path: "productIdentity",
					coverage_status: "product-not-found",
				},
			],
			openConflictRows: [
				{
					field_path: "brandOwner",
					observed_values: [
						{ source: "usda", value: "Brand A" },
						{ source: "open-food-facts", value: "Brand B" },
						{ source: "usda", value: "Brand A" },
					],
				},
				{ field_path: "servingWeightGrams", observed_values: null },
			],
			sourceNames,
		});

		expect(report.sourceRows).toEqual([
			{
				sourceKey: "open-food-facts",
				source: "Open Food Facts",
				selectedFieldCount: 1,
				reportedCoverageCount: 0,
				notReportedCoverageCount: 0,
				notApplicableCoverageCount: 1,
				productNotFoundCount: 1,
				openDisagreementCount: 1,
			},
			{
				sourceKey: "usda",
				source: "USDA FoodData Central",
				selectedFieldCount: 1,
				reportedCoverageCount: 1,
				notReportedCoverageCount: 1,
				notApplicableCoverageCount: 0,
				productNotFoundCount: 0,
				openDisagreementCount: 1,
			},
		]);
		expect(report.fieldRows).toContainEqual(
			expect.objectContaining({
				sourceKey: "usda",
				fieldPath: "ingredientsText",
				notReportedCoverageCount: 1,
			}),
		);
	});
});
