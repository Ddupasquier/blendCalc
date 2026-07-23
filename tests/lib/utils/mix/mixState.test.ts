import { beforeEach, describe, expect, it } from "vitest";
import {
	MIX_STATE_STORAGE_VERSION,
	getStateWithServingAmount,
	readStoredMixState,
	writeStoredMixState,
} from "$lib/utils/mix/state/mixState";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
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
	beforeEach(() => {
		localStorage.clear();
	});

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

	it("stores the current Mix state contract version", () => {
		writeStoredMixState(state);

		expect(
			JSON.parse(localStorage.getItem(MIX_STORAGE_KEYS.mixState) ?? "{}"),
		).toMatchObject({
			version: MIX_STATE_STORAGE_VERSION,
			selectedFoodIds: [food.fdcId],
		});
	});

	it("ignores unversioned pre-MVP Mix snapshots", () => {
		const fallback = { ...state, selectedFoodIds: [] };
		localStorage.setItem(
			MIX_STORAGE_KEYS.mixState,
			JSON.stringify({ ...state, selectedFoodIds: [food.fdcId] }),
		);

		expect(readStoredMixState(fallback, [food])).toEqual(fallback);
	});
});
