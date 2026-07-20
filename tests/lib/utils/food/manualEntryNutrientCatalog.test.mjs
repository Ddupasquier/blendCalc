import { describe, expect, it } from "vitest";
import { createManualEntryNutrientCatalog } from "../../../../scripts/lib/manual_entry_nutrient_catalog.mjs";
import { createSourceNutrientMappingCatalog } from "../../../../scripts/lib/source_nutrient_mapping_catalog.mjs";
import { findCanonicalNutrientMatch } from "../../../../scripts/reference-data/nutrientMatching.mjs";

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
			},
			{
				source_nutrient_key: "vitamin-d",
				source_unit_name: "IU",
				nutrient_id: 1110,
				priority: 10,
				confidence: 1,
				enabled: true,
			},
		]);

		expect(
			catalog.resolve({
				sourceNutrientKey: "vitamin-d_100g",
				sourceUnitName: "µg",
			}),
		).toMatchObject({ nutrient_id: 1114 });
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
			findCanonicalNutrientMatch({
				sourceName: "Saturated fat",
				sourceUnit: "G",
				definitions: [totalFat, saturatedFat],
				preferredNutrientIds: new Set([1004]),
			})?.definition.nutrient_id,
		).toBe(1258);
	});
});
