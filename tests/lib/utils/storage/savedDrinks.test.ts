import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudData = vi.hoisted(() => ({
	deleteCloudSavedDrink: vi.fn(),
	saveCloudSavedDrinkWithResult: vi.fn(),
	saveCloudMixPreferences: vi.fn(),
	reconcileCloudSmoothieList: vi.fn(),
	writeCloudSmoothieList: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudData);
import { MIX_STORAGE_KEYS } from "../../../../src/defaults/mixDefaults";
import {
	clearLoadedSavedDrink,
	deleteSavedDrink,
	hasSavedDrinkName,
	readLoadedSavedDrink,
	readSavedDrinks,
	restoreSavedDrinkToMix,
	SAVED_DRINKS_STORAGE_KEY,
	saveExistingSavedDrink,
	saveNewSavedDrink,
	type SavedDrinkInput,
} from "$lib/utils/storage/client/savedDrinks";
import { NUTRIENT_IDS, type FdcFood } from "$lib/utils/food/types";
import { LEGACY_SODIUM_NUTRIENT_ID } from "$lib/utils/mix/nutrients/nutrientMappings";
import {
	cacheSmoothieListLocally,
	readSmoothieList,
} from "$lib/utils/storage/client/smoothieLists";

const food = {
	fdcId: 1,
	description: "Bananas, Raw",
	nameProvenance: "source",
	foodNutrients: [],
} satisfies FdcFood;

const saveDrink = async (input: SavedDrinkInput) => {
	const result = await saveNewSavedDrink(input);
	if (!result.ok) throw new Error(`Unable to seed saved drink: ${result.reason}`);
	return result.drink;
};

describe("saved drinks", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		cloudData.deleteCloudSavedDrink.mockResolvedValue(true);
		cloudData.saveCloudSavedDrinkWithResult.mockResolvedValue("saved");
		cloudData.reconcileCloudSmoothieList.mockImplementation(
			async (_key: string, localFoods: FdcFood[]) => localFoods,
		);
		cloudData.writeCloudSmoothieList.mockResolvedValue(true);
	});

	it("saves drink snapshots", async () => {
		await saveDrink({
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
			foods: [{ fdcId: 1, description: "Bananas, Raw" }],
		});
	});

	it("restores a saved drink to mix state", async () => {
		const drink = await saveDrink({
			name: "High fiber",
			foods: [food],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 350 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 1 },
			servingUnits: { 1: "g" },
		});

		await restoreSavedDrinkToMix(drink);

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

	it("adds saved ingredients missing from the fridge to the shopping list", async () => {
		const kale = { ...food, fdcId: 2, description: "Kale, Raw" };
		cacheSmoothieListLocally(MIX_STORAGE_KEYS.fridge, [food]);
		const drink = await saveDrink({
			name: "Green smoothie",
			foods: [food, kale],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 350 },
			servingGrams: { 1: 100, 2: 100 },
			servingQuantities: { 1: 100, 2: 100 },
			servingUnits: { 1: "g", 2: "g" },
		});

		expect(await restoreSavedDrinkToMix(drink)).toBe(true);

		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)).toEqual([
			expect.objectContaining(food),
		]);
		expect(readSmoothieList(MIX_STORAGE_KEYS.shoppingList)).toEqual([
			expect.objectContaining(kale),
		]);
		expect(cloudData.writeCloudSmoothieList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.shoppingList,
			[expect.objectContaining(kale)],
		);
	});

	it("overwrites an existing saved drink without creating a duplicate", async () => {
		const drink = await saveDrink({
			name: "Original",
			foods: [food],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 350 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 100 },
			servingUnits: { 1: "g" },
		});

		const result = await saveExistingSavedDrink(drink.id, {
			name: "Updated",
			foods: [food],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 450 },
			servingGrams: { 1: 125 },
			servingQuantities: { 1: 125 },
			servingUnits: { 1: "g" },
		});

		expect(result).toMatchObject({ ok: true });
		if (!result.ok) throw new Error("Saved drink update failed.");
		expect(result.drink).toMatchObject({
			id: drink.id,
			name: "Updated",
			createdAt: drink.createdAt,
			nutrientGoals: { 1008: 450 },
		});
		expect(readSavedDrinks()).toHaveLength(1);
	});

	it("detects saved drink names case-insensitively for the current user cache", async () => {
		const drink = await saveDrink({
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

	it("clears the loaded saved drink context", async () => {
		const drink = await saveDrink({
			name: "Draft",
			foods: [food],
			selected: [1008],
			options: [{ id: 1008, label: "Calories" }],
			nutrientGoals: { 1008: 350 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 100 },
			servingUnits: { 1: "g" },
		});

		await restoreSavedDrinkToMix(drink);
		clearLoadedSavedDrink();

		expect(readLoadedSavedDrink()).toBeNull();
	});

	it("keeps a saved drink cached when the database delete fails", async () => {
		const drink = await saveDrink({
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
		const drink = await saveDrink({
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

	it("restores the nutrient selection belonging to each saved mix", async () => {
		const sodiumMix = await saveDrink({
			name: "Low sodium",
			foods: [food],
			selected: [NUTRIENT_IDS.SODIUM],
			options: [{ id: NUTRIENT_IDS.SODIUM, label: "Sodium" }],
			nutrientGoals: { [NUTRIENT_IDS.SODIUM]: 500 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 100 },
			servingUnits: { 1: "g" },
		});
		const potassiumMix = await saveDrink({
			name: "Potassium",
			foods: [food],
			selected: [NUTRIENT_IDS.POTASSIUM],
			options: [{ id: NUTRIENT_IDS.POTASSIUM, label: "Potassium" }],
			nutrientGoals: { [NUTRIENT_IDS.POTASSIUM]: 900 },
			servingGrams: { 1: 100 },
			servingQuantities: { 1: 100 },
			servingUnits: { 1: "g" },
		});

		await restoreSavedDrinkToMix(sodiumMix);
		expect(JSON.parse(localStorage.getItem(MIX_STORAGE_KEYS.mixState) ?? "{}"))
			.toMatchObject({ selected: [NUTRIENT_IDS.SODIUM] });

		await restoreSavedDrinkToMix(potassiumMix);
		expect(JSON.parse(localStorage.getItem(MIX_STORAGE_KEYS.mixState) ?? "{}"))
			.toMatchObject({ selected: [NUTRIENT_IDS.POTASSIUM] });
	});
});
