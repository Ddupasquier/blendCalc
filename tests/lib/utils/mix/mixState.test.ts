import { beforeEach, describe, expect, it } from "vitest";
import {
	MIX_STATE_STORAGE_VERSION,
	getDefaultMixState,
	getStateWithServingAmount,
	getStateWithToggledFood,
	readStoredMixState,
	writeStoredMixState,
} from "$lib/utils/mix/state/mixState";
import { getDefaultMixFields } from "$lib/utils/food/reference/appReferenceCatalog";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { FoodItem } from "$lib/utils/food/types";

const food: FoodItem = {
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

	it("uses account nutrient priorities as the default Mix display order", () => {
		const defaultFields = getDefaultMixFields();
		const prioritizedIds = defaultFields
			.slice(0, 2)
			.map((field) => field.id)
			.reverse();

		expect(getDefaultMixState(prioritizedIds).selected.slice(0, 2)).toEqual(
			prioritizedIds,
		);
	});

	it("stores an exact volume without inventing a gram weight", () => {
		expect(getStateWithServingAmount(state, food, "1", "cup")).toMatchObject({
			servingQuantities: { [food.fdcId]: 1 },
			servingUnits: { [food.fdcId]: "cup" },
			servingGrams: {},
		});
	});

	it("stores a count serving without inventing a gram weight", () => {
		const cookie: FoodItem = {
			fdcId: 3,
			description: "Cookie",
			foodNutrients: [],
			hasSourceServing: true,
			foodServings: [
				{
					label: "2 cookies",
					amount: 2,
					unitKey: "item",
					isPrimary: true,
				},
			],
		};
		const defaultState = getStateWithToggledFood(
			{
				...state,
				selectedFoodIds: [],
				servingGrams: {},
				servingQuantities: {},
				servingUnits: {},
			},
			cookie.fdcId,
			[cookie],
		);

		expect(defaultState.servingQuantities[cookie.fdcId]).toBe(2);
		expect(defaultState.servingUnits[cookie.fdcId]).toBe("item");
		expect(defaultState.servingGrams[cookie.fdcId]).toBeUndefined();
	});

	it("keeps an explicitly entered zero", () => {
		expect(getStateWithServingAmount(state, food, "0", "g")).toMatchObject({
			servingGrams: { [food.fdcId]: 0 },
			servingQuantities: { [food.fdcId]: 0 },
		});
	});

	it("stores exact source servings using their reported gram weight", () => {
		const banana: FoodItem = {
			fdcId: 2,
			description: "Banana, Raw",
			foodNutrients: [],
			foodServings: [
				{
					label: "1 medium banana (118 g)",
					gramWeight: 118,
					isPrimary: true,
					gramWeightMethod: "source-reported",
				},
			],
		};
		const defaultState = getStateWithToggledFood(
			{
				...state,
				selectedFoodIds: [],
				servingGrams: {},
				servingQuantities: {},
				servingUnits: {},
			},
			banana.fdcId,
			[banana],
		);
		const sourceServingUnit = defaultState.servingUnits[banana.fdcId];

		expect(sourceServingUnit).toMatch(/^source-serving:/);
		expect(defaultState.servingQuantities[banana.fdcId]).toBe(1);
		expect(defaultState.servingGrams[banana.fdcId]).toBe(118);
		expect(
			getStateWithServingAmount(defaultState, banana, "2", sourceServingUnit),
		).toMatchObject({
			servingQuantities: { [banana.fdcId]: 2 },
			servingGrams: { [banana.fdcId]: 236 },
		});
	});

	it("uses account Mix defaults for foods without an exact serving", () => {
		const defaultState = getStateWithToggledFood(
			{
				...state,
				selectedFoodIds: [],
				servingGrams: {},
				servingQuantities: {},
				servingUnits: {},
			},
			food.fdcId,
			[food],
			{
				preferredServingGrams: 56.69904625,
				preferredWeightUnit: "oz",
			},
		);

		expect(defaultState.servingQuantities[food.fdcId]).toBeCloseTo(2);
		expect(defaultState.servingUnits[food.fdcId]).toBe("oz");
		expect(defaultState.servingGrams[food.fdcId]).toBeCloseTo(56.69904625);
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
