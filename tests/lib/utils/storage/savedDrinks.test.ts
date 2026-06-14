import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudData = vi.hoisted(() => ({
	deleteCloudSavedDrink: vi.fn(),
	saveCloudSavedDrink: vi.fn(),
	saveCloudSavedDrinkWithResult: vi.fn(),
	saveCloudMixPreferences: vi.fn(),
	writeCloudSavedDrinks: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabaseData", () => cloudData);
import { MIX_STORAGE_KEYS } from "../../../../src/defaults/mixDefaults";
import {
	addSavedDrink,
	clearLoadedSavedDrink,
	deleteSavedDrink,
	hasSavedDrinkName,
	readLoadedSavedDrink,
	readSavedDrinks,
	restoreSavedDrinkToMix,
	SAVED_DRINKS_STORAGE_KEY,
	updateSavedDrink,
} from "$lib/utils/storage/savedDrinks";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";
import { LEGACY_SODIUM_NUTRIENT_ID } from "$lib/utils/mix/nutrientMappings";

const food = {
	fdcId: 1,
	description: "Bananas, raw",
	foodNutrients: [],
} satisfies FdcFood;

describe("saved drinks", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		cloudData.deleteCloudSavedDrink.mockResolvedValue(true);
	});

	it("saves drink snapshots", () => {
		addSavedDrink({
			name: "Post-workout",
			foods: [food],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 350 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 1 },
			servingUnits: { 1: "g" },
		});

		expect(readSavedDrinks()[0]).toMatchObject({
			name: "Post-workout",
			foods: [{ fdcId: 1, description: "Bananas, raw" }],
		});
	});

	it("restores a saved drink to mix state", () => {
		const drink = addSavedDrink({
			name: "High fiber",
			foods: [food],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 350 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 1 },
			servingUnits: { 1: "g" },
		});

		restoreSavedDrinkToMix(drink);

		expect(JSON.parse(localStorage.getItem(MIX_STORAGE_KEYS.mixState) ?? "{}"))
			.toMatchObject({
				selectedFoodIds: [1],
				selected: [1008],
			});
		expect(readLoadedSavedDrink()).toEqual({
			id: drink.id,
			name: "High fiber",
			isDirty: false,
		});
	});

	it("overwrites an existing saved drink without creating a duplicate", () => {
		const drink = addSavedDrink({
			name: "Original",
			foods: [food],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 350 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 100 },
			servingUnits: { 1: "g" },
		});

		const updated = updateSavedDrink(drink.id, {
			name: "Updated",
			foods: [food],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 450 },
			servingGrams: { 1: 125 },
			servingQuantities: { 1: 125 },
			servingUnits: { 1: "g" },
		});

		expect(updated).toMatchObject({
			id: drink.id,
			name: "Updated",
			createdAt: drink.createdAt,
			nutrientGoals: { 1008: 450 },
		});
		expect(readSavedDrinks()).toHaveLength(1);
	});

	it("detects saved drink names case-insensitively for the current user cache", () => {
		const drink = addSavedDrink({
			name: "Post-workout",
			foods: [food],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 350 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 100 },
			servingUnits: { 1: "g" },
		});

		expect(hasSavedDrinkName("  POST-WORKOUT ")).toBe(true);
		expect(hasSavedDrinkName("Post-workout", drink.id)).toBe(false);
		expect(hasSavedDrinkName("Low sugar")).toBe(false);
	});

	it("clears the loaded saved drink context", () => {
		const drink = addSavedDrink({
			name: "Draft",
			foods: [food],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 350 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 100 },
			servingUnits: { 1: "g" },
		});

		restoreSavedDrinkToMix(drink);
		clearLoadedSavedDrink();

		expect(readLoadedSavedDrink()).toBeNull();
	});

	it("keeps a saved drink cached when the database delete fails", async () => {
		const drink = addSavedDrink({
			name: "Keep me",
			foods: [food],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 350 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 100 },
			servingUnits: { 1: "g" },
		});
		cloudData.deleteCloudSavedDrink.mockResolvedValue(false);

		expect(await deleteSavedDrink(drink.id)).toBe(false);
		expect(readSavedDrinks()).toHaveLength(1);
	});

	it("removes a saved drink only after the database confirms deletion", async () => {
		const drink = addSavedDrink({
			name: "Delete me",
			foods: [food],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 350 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 100 },
			servingUnits: { 1: "g" },
		});

		expect(await deleteSavedDrink(drink.id)).toBe(true);
		expect(readSavedDrinks()).toEqual([]);
	});

	it("migrates legacy saved Sodium data away from saturated fat", () => {
		localStorage.setItem(
			SAVED_DRINKS_STORAGE_KEY,
			JSON.stringify([
				{
					id: "legacy-drink",
					name: "Legacy",
					createdAt: 1,
					foods: [food],
					selected: [LEGACY_SODIUM_NUTRIENT_ID],
					options: [
						{ id: LEGACY_SODIUM_NUTRIENT_ID, label: "Sodium" },
					],
					nutrientGoals: { [LEGACY_SODIUM_NUTRIENT_ID]: 500 },
					servingGrams: { 1: 100 },
					servingQuantities: { 1: 100 },
					servingUnits: { 1: "g" },
				},
			]),
		);

		expect(readSavedDrinks()[0]).toMatchObject({
			selected: [NUTRIENT_IDS.SODIUM],
			options: [{ id: NUTRIENT_IDS.SODIUM, label: "Sodium" }],
			nutrientGoals: { [NUTRIENT_IDS.SODIUM]: 500 },
		});
	});

	it("restores the nutrient selection belonging to each saved mix", () => {
		const sodiumMix = addSavedDrink({
			name: "Low sodium",
			foods: [food],
			selected: [NUTRIENT_IDS.SODIUM],
			options: [{ id: NUTRIENT_IDS.SODIUM, label: "Sodium" }],
			nutrientGoals: { [NUTRIENT_IDS.SODIUM]: 500 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 100 },
			servingUnits: { 1: "g" },
		});
		const potassiumMix = addSavedDrink({
			name: "Potassium",
			foods: [food],
			selected: [NUTRIENT_IDS.POTASSIUM],
			options: [{ id: NUTRIENT_IDS.POTASSIUM, label: "Potassium" }],
			nutrientGoals: { [NUTRIENT_IDS.POTASSIUM]: 900 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 100 },
			servingUnits: { 1: "g" },
		});

		restoreSavedDrinkToMix(sodiumMix);
		expect(JSON.parse(localStorage.getItem(MIX_STORAGE_KEYS.mixState) ?? "{}"))
			.toMatchObject({ selected: [NUTRIENT_IDS.SODIUM] });

		restoreSavedDrinkToMix(potassiumMix);
		expect(JSON.parse(localStorage.getItem(MIX_STORAGE_KEYS.mixState) ?? "{}"))
			.toMatchObject({ selected: [NUTRIENT_IDS.POTASSIUM] });
	});
});
