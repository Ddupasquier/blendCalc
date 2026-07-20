import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIX_STORAGE_KEYS } from "../../../../src/defaults/mixDefaults";
import type { FdcFood } from "$lib/utils/food/types";

const cloudData = vi.hoisted(() => ({
	deleteCloudSavedDrink: vi.fn(),
	readCloudSavedDrinkById: vi.fn(),
	readCloudSmoothieList: vi.fn(),
	saveCloudSavedDrinkWithResult: vi.fn(),
	saveCloudMixPreferences: vi.fn(),
}));
const listData = vi.hoisted(() => ({
	addFoodsToSmoothieList: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudData);
vi.mock("$lib/utils/storage/client/smoothieLists", () => listData);

import {
	clearLoadedSavedDrink,
	deleteSavedDrink,
	readLoadedSavedDrink,
	restoreSavedDrinkToMix,
	saveExistingSavedDrink,
	saveNewSavedDrink,
	type SavedDrink,
	type SavedDrinkInput,
} from "$lib/utils/storage/client/savedDrinks";

const food = {
	fdcId: 1,
	description: "Bananas, Raw",
	nameProvenance: "source",
	foodNutrients: [],
} satisfies FdcFood;

const input = (name = "Post-workout"): SavedDrinkInput => ({
	name,
	foods: [food],
	selected: [1008],
	options: [{ id: 1008, label: "Calories" }],
	nutrientGoals: { 1008: 350 },
	servingGrams: { 1: 100 },
	servingQuantities: { 1: 1 },
	servingUnits: { 1: "g" },
});

describe("database-backed saved drinks", () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		vi.clearAllMocks();
		cloudData.deleteCloudSavedDrink.mockResolvedValue(true);
		cloudData.readCloudSmoothieList.mockImplementation(async (key: string) =>
			key === MIX_STORAGE_KEYS.fridge ? [food] : []
		);
		cloudData.saveCloudSavedDrinkWithResult.mockResolvedValue("saved");
		cloudData.saveCloudMixPreferences.mockResolvedValue(true);
		listData.addFoodsToSmoothieList.mockResolvedValue("added");
	});

	it("saves a new drink directly to the database", async () => {
		const result = await saveNewSavedDrink(input());

		expect(result).toMatchObject({ ok: true });
		expect(cloudData.saveCloudSavedDrinkWithResult).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Post-workout",
				foods: [expect.objectContaining({ fdcId: food.fdcId })],
			}),
		);
	});

	it("uses the database unique-name result", async () => {
		cloudData.saveCloudSavedDrinkWithResult.mockResolvedValue("duplicate");
		await expect(saveNewSavedDrink(input())).resolves.toEqual({
			ok: false,
			reason: "duplicate",
		});
	});

	it("updates the current database record without changing its creation time", async () => {
		const existing = {
			...input("Original"),
			id: "drink-1",
			createdAt: 123,
		} satisfies SavedDrink;
		cloudData.readCloudSavedDrinkById.mockResolvedValue(existing);

		const result = await saveExistingSavedDrink(existing.id, input("Updated"));
		expect(result).toMatchObject({
			ok: true,
			drink: { id: existing.id, name: "Updated", createdAt: 123 },
		});
	});

	it("returns missing when an update target is no longer in the database", async () => {
		cloudData.readCloudSavedDrinkById.mockResolvedValue(null);
		await expect(saveExistingSavedDrink("missing", input())).resolves.toEqual({
			ok: false,
			reason: "missing",
		});
	});

	it("deletes only after database confirmation", async () => {
		await expect(deleteSavedDrink("drink-1")).resolves.toBe(true);
		cloudData.deleteCloudSavedDrink.mockResolvedValue(false);
		await expect(deleteSavedDrink("drink-1")).resolves.toBe(false);
	});

	it("stores loaded-drink context only for the current browser session", async () => {
		const drink = {
			...input("High fiber"),
			id: "drink-1",
			createdAt: 123,
		} satisfies SavedDrink;

		await expect(restoreSavedDrinkToMix(drink)).resolves.toBe(true);
		expect(readLoadedSavedDrink()).toEqual({
			id: drink.id,
			name: drink.name,
			isDirty: false,
		});
		expect(localStorage.getItem("smoothie-loaded-saved-drink")).toBeNull();
		clearLoadedSavedDrink();
		expect(readLoadedSavedDrink()).toBeNull();
	});

	it("adds saved ingredients missing from both database lists", async () => {
		const kale = { ...food, fdcId: 2, description: "Kale, Raw" };
		const drink = {
			...input("Green smoothie"),
			id: "drink-2",
			createdAt: 456,
			foods: [food, kale],
		} satisfies SavedDrink;

		await expect(restoreSavedDrinkToMix(drink)).resolves.toBe(true);
		expect(listData.addFoodsToSmoothieList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.shoppingList,
			[expect.objectContaining({ fdcId: kale.fdcId })],
		);
		expect(JSON.parse(localStorage.getItem(MIX_STORAGE_KEYS.mixState) ?? "{}"))
			.toMatchObject({ selectedFoodIds: [food.fdcId, kale.fdcId] });
	});
});
