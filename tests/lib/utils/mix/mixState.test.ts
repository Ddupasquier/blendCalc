import { describe, expect, it } from "vitest";
import { getStateWithServingAmount } from "$lib/utils/mix/state/mixState";
import type { FdcFood } from "$lib/utils/food/types";

const food: FdcFood = {
	fdcId: 1,
	description: "Test food",
	foodNutrients: [],
};

const state = {
	selected: [],
	options: [],
	selectedFoodIds: [food.fdcId],
	servingGrams: { [food.fdcId]: 25 },
	servingQuantities: { [food.fdcId]: 25 },
	servingUnits: { [food.fdcId]: "g" as const },
};

describe("mix serving state", () => {
	it("does not convert a blank amount into zero", () => {
		expect(getStateWithServingAmount(state, food, "", "g")).toBe(state);
	});

	it("does not save a volume amount without measured conversion data", () => {
		expect(getStateWithServingAmount(state, food, "1", "cup")).toBe(state);
	});

	it("keeps an explicitly entered zero", () => {
		expect(getStateWithServingAmount(state, food, "0", "g")).toMatchObject({
			servingGrams: { [food.fdcId]: 0 },
			servingQuantities: { [food.fdcId]: 0 },
		});
	});
});
