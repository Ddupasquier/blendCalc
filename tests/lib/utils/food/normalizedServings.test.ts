import { describe, expect, it } from "vitest";
import {
	hydrateFoodWithNormalizedServings,
	normalizedRowsToServings,
	type NormalizedServingRow,
} from "$lib/utils/food/servings/normalizedServings";
import type { FoodItem } from "$lib/utils/food/types";

const legacyFood = {
	fdcId: 1,
	description: "Legacy serving snapshot",
	foodNutrients: [],
	hasSourceServing: true,
	servingSize: 99,
	servingSizeUnit: "g",
	householdServingFullText: "Legacy cup",
	foodServings: [{
		label: "Legacy cup",
		gramWeight: 99,
		amount: 1,
		unitKey: "cup",
		isPrimary: true,
		source: "unknown",
		confidence: "unknown",
	}],
} satisfies FoodItem;

const normalizedServing = {
	servingOrder: 0,
	label: "1 cup",
	gramWeight: 245,
	amount: 1,
	unitKey: "cup",
	isPrimary: true,
	measureType: "Household measure",
	isHouseholdMeasure: true,
	sourceMeasureKey: "portion:1",
	origin: "source-household-measure",
	gramWeightMethod: "source-reported",
	calculationBasis: null,
	source: "usda",
	sourceReference: "123",
	confidence: "unknown",
} satisfies NormalizedServingRow;

describe("normalized food servings", () => {
	it("replaces legacy JSON serving snapshots with normalized rows", () => {
		const hydrated = hydrateFoodWithNormalizedServings(legacyFood, [
			normalizedServing,
		]);

		expect(hydrated.foodServings).toEqual([
			expect.objectContaining({ label: "1 cup", gramWeight: 245 }),
		]);
		expect(hydrated.servingSize).toBe(245);
		expect(hydrated.householdServingFullText).toBe("1 cup");
	});

	it("treats an empty normalized result as authoritative", () => {
		const hydrated = hydrateFoodWithNormalizedServings(legacyFood, []);

		expect(hydrated.hasSourceServing).toBe(false);
		expect(hydrated.foodServings).toEqual([]);
		expect(hydrated.servingSize).toBeUndefined();
		expect(hydrated.householdServingFullText).toBeUndefined();
	});

	it("drops invalid normalized serving rows", () => {
		expect(normalizedRowsToServings([
			{ ...normalizedServing, gramWeight: Number.NaN },
		])).toEqual([]);
	});
});
