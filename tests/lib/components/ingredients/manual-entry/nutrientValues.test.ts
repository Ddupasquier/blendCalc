import { describe, expect, it } from "vitest";
import {
	buildSaveNutrients,
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

	it("keeps missing summary values missing", () => {
		expect(getSummaryItems({
			requiredFields: [proteinField],
			getValue: () => null,
		})).toEqual([
			expect.objectContaining({ value: null }),
		]);
	});
});
