import { describe, expect, it } from "vitest";
import {
	dedupeManualEntryNutrients,
	groupManualEntryNutrients,
	type ManualEntryNutrientDefinition,
} from "$lib/utils/food/nutrientDefinitions";

const makeDefinition = (
	override: Partial<ManualEntryNutrientDefinition>,
): ManualEntryNutrientDefinition => ({
	dedupeKey: "macros:required-basics:calories-kcal",
	nutrientId: 999_999,
	nutrientName: "Energy",
	nutrientNumber: "208",
	unitName: "kcal",
	nutrientType: "energy",
	step: "macros",
	group: "Required basics",
	groupSort: 10,
	sort: 10,
	label: "Calories (kcal)",
	requiredForManualEntry: false,
	...override,
});

describe("manual entry nutrient definitions", () => {
	it("dedupes equivalent manual-entry nutrients and prefers canonical core IDs", () => {
		const groups = groupManualEntryNutrients([
			makeDefinition({
				nutrientId: 999_999,
				nutrientName: "Energy duplicate",
			}),
			makeDefinition({
				nutrientId: 1008,
				nutrientName: "Calories",
			}),
			makeDefinition({
				dedupeKey: "macros:required-basics:protein-g",
				nutrientId: 1003,
				nutrientName: "Protein",
				nutrientNumber: "203",
				unitName: "g",
				nutrientType: "macro",
				sort: 40,
				label: "Protein (g)",
			}),
		]);

		expect(groups.macros).toHaveLength(1);
		expect(groups.macros[0].fields.map((field) => field.label)).toEqual([
			"Calories (kcal)",
			"Protein (g)",
		]);
		expect(groups.macros[0].fields[0].nutrientId).toBe(1008);
	});

	it("builds stable dedupe keys when older database rows do not include one", () => {
		const [definition] = dedupeManualEntryNutrients([
			makeDefinition({
				dedupeKey: "",
				nutrientId: 1093,
				nutrientName: "Sodium, Na",
				nutrientNumber: "307",
				unitName: "mg",
				nutrientType: "mineral",
				step: "extended",
				group: "Minerals",
				groupSort: 20,
				sort: 10,
				label: "Sodium, Na (mg)",
			}),
		]);

		expect(definition.dedupeKey).toBe("extended:minerals:sodium na:mg");
	});

	it("preserves DB-backed required manual-entry flags", () => {
		const groups = groupManualEntryNutrients([
			makeDefinition({
				dedupeKey: "macros:required-basics:sodium-mg",
				nutrientId: 1093,
				nutrientName: "Sodium",
				nutrientNumber: "307",
				unitName: "mg",
				nutrientType: "mineral",
				sort: 50,
				label: "Sodium (mg)",
				requiredForManualEntry: true,
			}),
		]);

		expect(groups.macros[0].fields[0]).toMatchObject({
			label: "Sodium (mg)",
			requiredForManualEntry: true,
		});
	});
});
