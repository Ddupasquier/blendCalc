import { describe, expect, it } from "vitest";
import {
	buildSaveNutrients,
	getPopulatedNutrientGroupCount,
	getSummaryItems,
	setManualNutrientState,
} from "$lib/components/ingredients/manual-entry/utils/nutrientValues";
import type { ManualEntryNutrientDefinition } from "$lib/utils/food/nutrients/nutrientDefinitions";

const proteinField = {
	dedupeKey: "macros:required-basics:protein-g",
	nutrientId: 1003,
	nutrientName: "Protein",
	nutrientNumber: "203",
	unitName: "G",
	nutrientType: "macro",
	step: "macros",
	group: "Required basics",
	groupSort: 10,
	sort: 40,
	label: "Protein (g)",
	requiredForManualEntry: true,
} satisfies ManualEntryNutrientDefinition;

describe("manual-entry nutrient values", () => {
	it("preserves a reported zero", () => {
		const state = setManualNutrientState({
			field: proteinField,
			value: "0",
			values: {},
			touched: {},
		});

		expect(state.values).toEqual({ 1003: 0 });
		expect(state.touched).toEqual({ 1003: true });
	});

	it("counts positive and explicit-zero values while leaving blanks unknown", () => {
		const carbohydrateField = {
			...proteinField,
			dedupeKey: "macros:required-basics:carbohydrate-g",
			nutrientId: 1005,
			nutrientName: "Carbohydrate",
			label: "Carbohydrate (g)",
		};
		const fatField = {
			...proteinField,
			dedupeKey: "macros:required-basics:fat-g",
			nutrientId: 1004,
			nutrientName: "Total fat",
			label: "Total Fat (g)",
		};
		const values = new Map([
			[proteinField.nutrientId, 0],
			[carbohydrateField.nutrientId, 12],
		]);

		expect(
			getPopulatedNutrientGroupCount(
				{
					title: "Required basics",
					fields: [proteinField, carbohydrateField, fatField],
				},
				(field) => values.get(field.nutrientId) ?? null,
			),
		).toBe(2);
	});

	it("clears invalid input instead of converting it to zero", () => {
		const state = setManualNutrientState({
			field: proteinField,
			value: "-2",
			values: { 1003: 4 },
			touched: { 1003: true },
		});

		expect(state.values).toEqual({});
		expect(state.touched).toEqual({});
	});

	it("drops invalid imported values and keeps valid zeroes", () => {
		const nutrients = buildSaveNutrients({
			importedNutrients: [
				{
					nutrientId: 1004,
					nutrientName: "Total fat",
					nutrientNumber: "204",
					unitName: "G",
					value: 0,
				},
				{
					nutrientId: 1005,
					nutrientName: "Carbohydrate",
					nutrientNumber: "205",
					unitName: "G",
					value: null as unknown as number,
				},
			],
			manualEntryNutrientFields: [],
			manualNutrientValues: {},
			manualTouchedNutrientIds: {},
		});

		expect(nutrients).toEqual([
			expect.objectContaining({ nutrientId: 1004, value: 0 }),
		]);
	});

	it("preserves all 17 imported nutrients for UPC 00030000581728", () => {
		const valuesByNutrientId = new Map([
			[1008, 110],
			[1003, 2],
			[1004, 1],
			[1005, 24],
			[1079, 1],
			[2000, 9],
			[1235, 9],
			[1093, 190],
			[1258, 0],
			[1257, 0],
			[1293, 0],
			[1292, 0],
			[1253, 0],
			[1087, 10],
			[1089, 0.4],
			[1092, 60],
			[1114, 0],
		]);
		const nutrients = buildSaveNutrients({
			importedNutrients: [...valuesByNutrientId].map(([nutrientId, value]) => ({
				nutrientId,
				nutrientName: `Nutrient ${nutrientId}`,
				nutrientNumber: String(nutrientId),
				unitName: "G",
				value,
				source: "open-food-facts" as const,
				sourceReference: "00030000581728",
				mappingStatus: "canonical" as const,
			})),
			manualEntryNutrientFields: [],
			manualNutrientValues: {},
			manualTouchedNutrientIds: {},
		});

		expect(nutrients).toHaveLength(17);
		expect(
			new Map(
				nutrients.map((nutrient) => [nutrient.nutrientId, nutrient.value]),
			),
		).toEqual(valuesByNutrientId);
		expect(nutrients).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					nutrientId: 1114,
					value: 0,
					source: "open-food-facts",
					sourceReference: "00030000581728",
				}),
			]),
		);
	});
	it("keeps missing summary values missing", () => {
		expect(
			getSummaryItems({
				requiredFields: [proteinField],
				getValue: () => null,
			}),
		).toEqual([expect.objectContaining({ value: null })]);
	});
});
