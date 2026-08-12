import { describe, expect, it } from "vitest";
import { createManualEntryNutrientCatalog } from "../../../../scripts/lib/nutrition/manual_entry_nutrient_catalog.mjs";
import {
	createSourceNutrientMappingCatalog,
	preserveReviewedSourceNutrientMappings,
} from "../../../../scripts/lib/nutrition/source_nutrient_mapping_catalog.mjs";
import { findCanonicalNutrientCandidate } from "../../../../scripts/lib/reference-data/nutrientMatching.mjs";

const groups = [
	{
		id: "fat-details",
		entry_step: "macros",
		title: "Fat details",
		sort_order: 30,
		enabled: true,
		group_role: "display",
	},
	{
		id: "carbohydrate-details",
		entry_step: "macros",
		title: "Carbohydrate details",
		sort_order: 20,
		enabled: true,
		group_role: "display",
	},
	{
		id: "unclassified-nutrients",
		entry_step: "extended",
		title: "Unclassified nutrients",
		sort_order: 999,
		enabled: false,
		group_role: "unclassified",
	},
];

const fields = [
	{
		nutrient_id: 1258,
		group_id: "fat-details",
		nutrient_type: "fat",
		display_label: "Fatty Acids, Total Saturated (g)",
		sort_order: 10,
		enabled: true,
		dedupe_key: "macros:fat-details:fatty acids total saturated:g",
		classification_status: "approved",
		classification_version: 2,
		replacement_nutrient_id: null,
	},
	{
		nutrient_id: 2000,
		group_id: "carbohydrate-details",
		nutrient_type: "carbohydrate",
		display_label: "Total Sugars (g)",
		sort_order: 20,
		enabled: true,
		dedupe_key: "macros:carbohydrate-details:total sugars:g",
		classification_status: "approved",
		classification_version: 2,
		replacement_nutrient_id: null,
	},
	{
		nutrient_id: 1063,
		group_id: "carbohydrate-details",
		nutrient_type: "carbohydrate",
		display_label: "Sugars (g)",
		sort_order: 20,
		enabled: false,
		dedupe_key: "macros:carbohydrate-details:sugars:g",
		classification_status: "retired",
		classification_version: 2,
		replacement_nutrient_id: 2000,
	},
];

describe("DB-backed manual-entry nutrient catalog", () => {
	it("uses the approved database classification without guessing from the name", () => {
		const catalog = createManualEntryNutrientCatalog({ groups, fields });
		expect(catalog.resolve(1258)).toMatchObject({
			canonicalNutrientId: 1258,
			entryStep: "macros",
			groupId: "fat-details",
			fieldSortOrder: 10,
			classificationMethod: "db-catalog-v2",
		});
	});

	it("resolves a retired source nutrient to its approved canonical replacement", () => {
		const catalog = createManualEntryNutrientCatalog({ groups, fields });
		expect(catalog.resolve(1063)).toMatchObject({
			canonicalNutrientId: 2000,
			groupId: "carbohydrate-details",
			displayLabel: "Total Sugars (g)",
		});
	});

	it("stores unknown API nutrients as hidden review candidates", () => {
		const catalog = createManualEntryNutrientCatalog({ groups, fields });
		expect(catalog.resolve(999999)).toMatchObject({
			canonicalNutrientId: 999999,
			entryStep: "extended",
			groupId: "unclassified-nutrients",
			classificationStatus: "pending_review",
		});
	});
});

describe("source nutrient mapping catalog", () => {
	it("uses an exact source key and unit from database mappings", () => {
		const catalog = createSourceNutrientMappingCatalog([
			{
				source_nutrient_key: "vitamin-d",
				source_unit_name: "UG",
				nutrient_id: 1114,
				priority: 10,
				confidence: 1,
				enabled: true,
				mapping_method: "db_reviewed_api_key_match",
				review_status: "approved",
				review_reference: "reviewed-vitamin-d-micrograms",
				reviewed_at: "2026-08-11T00:00:00.000Z",
			},
			{
				source_nutrient_key: "vitamin-d",
				source_unit_name: "IU",
				nutrient_id: 1110,
				priority: 10,
				confidence: 1,
				enabled: true,
				mapping_method: "db_reviewed_api_key_match",
				review_status: "approved",
				review_reference: "reviewed-vitamin-d-iu",
				reviewed_at: "2026-08-11T00:00:00.000Z",
			},
		]);

		expect(
			catalog.resolve({
				sourceNutrientKey: "vitamin-d_100g",
				sourceUnitName: "µg",
			}),
		).toMatchObject({ nutrient_id: 1114 });
	});

	it("does not resolve pending semantic candidates", () => {
		const catalog = createSourceNutrientMappingCatalog([{
			source_nutrient_key: "vitamin-a",
			source_unit_name: "UG",
			nutrient_id: 1106,
			priority: 10,
			confidence: 1,
			enabled: false,
			mapping_method: "api_taxonomy_match",
			review_status: "pending_review",
		}]);

		expect(
			catalog.resolve({
				sourceNutrientKey: "vitamin-a",
				sourceUnitName: "UG",
			}),
		).toBeNull();
	});

	it("does not reuse an approved mapping from a different unit", () => {
		const catalog = createSourceNutrientMappingCatalog([{
			source_nutrient_key: "vitamin-d",
			source_unit_name: "UG",
			nutrient_id: 1114,
			priority: 10,
			confidence: 1,
			enabled: true,
			mapping_method: "db_reviewed_api_key_match",
			review_status: "approved",
			review_reference: "reviewed-vitamin-d-micrograms",
			reviewed_at: "2026-08-11T00:00:00.000Z",
		}]);

		expect(
			catalog.resolve({
				sourceNutrientKey: "vitamin-d",
				sourceUnitName: "IU",
			}),
		).toBeNull();
	});

	it("normalizes equivalent source unit spellings before exact lookup", () => {
		const catalog = createSourceNutrientMappingCatalog([{
			source_nutrient_key: "vitamin-a",
			source_unit_name: "UG",
			nutrient_id: 1106,
			priority: 10,
			confidence: 1,
			enabled: true,
			mapping_method: "db_reviewed_api_key_match",
			review_status: "approved",
			review_reference: "reviewed-vitamin-a-micrograms",
			reviewed_at: "2026-08-11T00:00:00.000Z",
		}]);

		expect(
			catalog.resolve({
				sourceNutrientKey: "vitamin-a",
				sourceUnitName: "micrograms",
			}),
		).toMatchObject({ nutrient_id: 1106 });
	});

	it("does not let a later API observation overwrite a reviewed mapping", () => {
		const [mapping] = preserveReviewedSourceNutrientMappings({
			existingMappings: [{
				source_key: "open-food-facts",
				source_nutrient_key: "fat",
				source_unit_name: "G",
				source_nutrient_name: "Fat",
				nutrient_id: 1004,
				priority: 0,
				mapping_method: "db_reviewed_api_key_match",
				confidence: 1,
				enabled: true,
				review_status: "approved",
				review_reference: "reviewed-core-label-field",
				reviewed_at: "2026-07-19T00:00:00.000Z",
				first_observed_at: "2026-07-19T00:00:00.000Z",
				provenance: { reviewed: true },
			}],
			observedMappings: [{
				source_key: "open-food-facts",
				source_nutrient_key: "fat",
				source_unit_name: "G",
				source_nutrient_name: "Total fat",
				nutrient_id: 1085,
				priority: 10,
				mapping_method: "api_taxonomy_match",
				confidence: 0.99,
				enabled: true,
				review_status: "approved",
				review_reference: "taxonomy",
				reviewed_at: "2026-07-27T00:00:00.000Z",
				observation_count: 25,
				first_observed_at: "2026-07-27T00:00:00.000Z",
				last_observed_at: "2026-07-27T00:00:00.000Z",
				provenance: { sampleSize: 25 },
			}],
		});

		expect(mapping).toMatchObject({
			nutrient_id: 1004,
			mapping_method: "db_reviewed_api_key_match",
			review_status: "approved",
			review_reference: "reviewed-core-label-field",
			observation_count: 25,
			provenance: {
				reviewed: true,
				sampleSize: 25,
				reviewedMappingPreserved: true,
			},
		});
	});
});

describe("canonical nutrient matching", () => {
	it("does not let UI importance override a more exact nutrient match", () => {
		const totalFat = {
			nutrient_id: 1004,
			nutrient_name: "Total lipid (fat)",
			default_unit_name: "G",
			observation_count: 1000,
		};
		const saturatedFat = {
			nutrient_id: 1258,
			nutrient_name: "Fatty acids, total saturated",
			default_unit_name: "G",
			observation_count: 100,
		};

		expect(
			findCanonicalNutrientCandidate({
				sourceName: "Saturated fat",
				sourceUnit: "G",
				definitions: [totalFat, saturatedFat],
				preferredNutrientIds: new Set([1004]),
			})?.definition.nutrient_id,
		).toBe(1258);
	});

	it("keeps an exact vitamin name as a review candidate instead of approval", () => {
		const candidate = findCanonicalNutrientCandidate({
			sourceName: "Vitamin A",
			sourceUnit: "micrograms",
			definitions: [{
				nutrient_id: 1106,
				nutrient_name: "Vitamin A",
				default_unit_name: "UG",
			}],
		});

		expect(candidate).toMatchObject({
			nameMatchKind: "exact-name",
			unitCompatibility: "exact",
		});
		expect(candidate).not.toHaveProperty("automaticApproval");
	});

	it("marks mass-unit changes as requiring a reviewed conversion", () => {
		expect(
			findCanonicalNutrientCandidate({
				sourceName: "Vitamin E",
				sourceUnit: "G",
				definitions: [{
					nutrient_id: 1109,
					nutrient_name: "Vitamin E",
					default_unit_name: "MG",
				}],
			}),
		).toMatchObject({ unitCompatibility: "conversion-required" });
	});

	it("marks dimensionally incompatible units instead of approving them", () => {
		expect(
			findCanonicalNutrientCandidate({
				sourceName: "Vitamin K",
				sourceUnit: "KCAL",
				definitions: [{
					nutrient_id: 1184,
					nutrient_name: "Vitamin K",
					default_unit_name: "UG",
				}],
			}),
		).toMatchObject({ unitCompatibility: "incompatible" });
	});

	it("does not substitute a parent fatty-acid nutrient for a specific child", () => {
		const candidate = findCanonicalNutrientCandidate({
			sourceName: "Fatty acids, total trans-monoenoic",
			sourceUnit: "G",
			definitions: [
				{
					nutrient_id: 1257,
					nutrient_name: "Fatty acids, total trans",
					default_unit_name: "G",
				},
				{
					nutrient_id: 1259,
					nutrient_name: "Fatty acids, total trans-monoenoic",
					default_unit_name: "G",
				},
			],
		});

		expect(candidate?.definition.nutrient_id).toBe(1259);
	});
});
