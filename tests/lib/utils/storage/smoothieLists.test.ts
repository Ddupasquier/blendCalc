import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudData = vi.hoisted(() => ({
	placeCloudSmoothieListItem: vi.fn(),
	removeCloudSmoothieListItem: vi.fn(),
	upsertCloudSmoothieListItem: vi.fn(),
	writeCloudSmoothieList: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudData);

import {
	addFoodToSmoothieList,
	cacheSmoothieListLocally,
	moveFoodToSmoothieList,
	preserveSelectedListItems,
	readSmoothieList,
	removeFoodFromSmoothieList,
	renameFoodInSmoothieList,
} from "$lib/utils/storage/client/smoothieLists";
import type { FdcFood } from "$lib/utils/food/types";
import { MIX_STORAGE_KEYS } from "../../../../src/defaults/mixDefaults";

const food = {
	fdcId: 1,
	description: "Olive oil",
	brandOwner: "Test Brand",
	foodCategory: "Oil",
	dataType: "Foundation",
	servingSize: 1,
	servingSizeUnit: "tbsp",
	foodNutrients: [
		{
			nutrientId: 1085,
			nutrientName: "Total fat (NLEA)",
			nutrientNumber: "298",
			unitName: "G",
			value: 100,
		},
	],
} satisfies FdcFood;

describe("smoothie lists", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		cloudData.placeCloudSmoothieListItem.mockResolvedValue("added");
		cloudData.upsertCloudSmoothieListItem.mockResolvedValue(true);
		cloudData.removeCloudSmoothieListItem.mockResolvedValue(true);
	});

	it("stores compact food records with serving metadata", () => {
		cacheSmoothieListLocally(MIX_STORAGE_KEYS.fridge, [food]);

		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)[0]).toMatchObject({
			fdcId: 1,
			description: "Olive Oil",
			nameProvenance: "source",
			dataType: "Foundation",
			servingSize: 1,
			servingSizeUnit: "tbsp",
			foodNutrients: [
				{
					nutrientId: 1085,
					nutrientNumber: "298",
					value: 100,
				},
			],
		});
	});

	it("title-cases legacy API names when a saved list is read", () => {
		localStorage.setItem(
			MIX_STORAGE_KEYS.fridge,
			JSON.stringify([{ ...food, description: "mustard greens, raw" }]),
		);

		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)[0]).toMatchObject({
			description: "Mustard Greens, Raw",
			nameProvenance: "source",
		});
	});

	it("preserves user-owned capitalization when a saved list is read", () => {
		localStorage.setItem(
			MIX_STORAGE_KEYS.fridge,
			JSON.stringify([{
				...food,
				description: "MY PERSONAL GREENS",
				nameProvenance: "user",
			}]),
		);

		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)[0].description).toBe(
			"MY PERSONAL GREENS",
		);
	});

	it("adds one list item without rewriting the whole cloud list", async () => {
		expect(await addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, food)).toBe("added");

		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)).toHaveLength(1);
		expect(cloudData.placeCloudSmoothieListItem).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			expect.objectContaining({ fdcId: food.fdcId }),
		);
		expect(cloudData.writeCloudSmoothieList).not.toHaveBeenCalled();
	});

	it("requires confirmation instead of duplicating an item across both lists", async () => {
		await addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, food);
		cloudData.placeCloudSmoothieListItem.mockResolvedValueOnce(
			"move-required:fridge",
		);

		expect(
			await addFoodToSmoothieList(MIX_STORAGE_KEYS.shoppingList, food),
		).toBe("move-required:fridge");
		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)).toHaveLength(1);
		expect(readSmoothieList(MIX_STORAGE_KEYS.shoppingList)).toHaveLength(0);
	});

	it("moves one identity between lists without leaving a duplicate", async () => {
		await addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, food);
		cloudData.placeCloudSmoothieListItem.mockResolvedValueOnce("moved");

		expect(
			await moveFoodToSmoothieList(MIX_STORAGE_KEYS.shoppingList, food),
		).toBe("moved");
		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)).toHaveLength(0);
		expect(readSmoothieList(MIX_STORAGE_KEYS.shoppingList)).toEqual([
			expect.objectContaining({ fdcId: food.fdcId }),
		]);
		expect(cloudData.placeCloudSmoothieListItem).toHaveBeenLastCalledWith(
			MIX_STORAGE_KEYS.shoppingList,
			expect.objectContaining({ fdcId: food.fdcId }),
			true,
		);
	});

	it("treats matching barcodes as duplicate list items across different IDs", async () => {
		const scannedFood = {
			...food,
			fdcId: -100,
			barcode: "00012345678905",
			gtinUpc: "00012345678905",
			description: "Honey greek yogurt",
		} satisfies FdcFood;
		const sharedCatalogFood = {
			...scannedFood,
			fdcId: -200,
			customFood: false,
			dataType: "Shared Product",
		} satisfies FdcFood;

		expect(await addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, scannedFood)).toBe(
			"added",
		);
		expect(
			await addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, sharedCatalogFood),
		).toBe("duplicate");

		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)).toHaveLength(1);
		expect(cloudData.placeCloudSmoothieListItem).toHaveBeenCalledTimes(1);
	});

	it("removes one list item without rewriting the whole cloud list", async () => {
		cacheSmoothieListLocally(MIX_STORAGE_KEYS.fridge, [food]);
		vi.clearAllMocks();

		expect(await removeFoodFromSmoothieList(MIX_STORAGE_KEYS.fridge, food.fdcId)).toBe(
			"removed",
		);

		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)).toHaveLength(0);
		expect(cloudData.removeCloudSmoothieListItem).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			food.fdcId,
		);
		expect(cloudData.writeCloudSmoothieList).not.toHaveBeenCalled();
	});

	it("renames one list item without changing the source food ID", async () => {
		cacheSmoothieListLocally(MIX_STORAGE_KEYS.fridge, [food]);
		vi.clearAllMocks();
		cloudData.upsertCloudSmoothieListItem.mockResolvedValue(true);

		expect(
			await renameFoodInSmoothieList(
				MIX_STORAGE_KEYS.fridge,
				food.fdcId,
				"  Cooking oil  ",
			),
		).toBe("renamed");

		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)[0]).toMatchObject({
			fdcId: food.fdcId,
			description: "Cooking oil",
		});
		expect(cloudData.upsertCloudSmoothieListItem).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			expect.objectContaining({
				fdcId: food.fdcId,
				description: "Cooking oil",
			}),
		);
	});

	it("rejects blank list item names", async () => {
		cacheSmoothieListLocally(MIX_STORAGE_KEYS.fridge, [food]);

		expect(
			await renameFoodInSmoothieList(MIX_STORAGE_KEYS.fridge, food.fdcId, "   "),
		).toBe("invalid");
		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)[0].description).toBe(
			"Olive Oil",
		);
	});

	it("rejects duplicate display names in the same list", async () => {
		const kale = { ...food, fdcId: 2, description: "Kale, raw" };
		cacheSmoothieListLocally(MIX_STORAGE_KEYS.fridge, [food, kale]);

		expect(
			await renameFoodInSmoothieList(
				MIX_STORAGE_KEYS.fridge,
				kale.fdcId,
				" olive oil ",
			),
		).toBe("duplicate");
		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)[1].description).toBe(
			"Kale, Raw",
		);
	});

	it("keeps the cached name when database rename fails", async () => {
		cacheSmoothieListLocally(MIX_STORAGE_KEYS.fridge, [food]);
		cloudData.upsertCloudSmoothieListItem.mockResolvedValue(false);

		expect(
			await renameFoodInSmoothieList(
				MIX_STORAGE_KEYS.fridge,
				food.fdcId,
				"Cooking oil",
			),
		).toBe("error");
		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)[0].description).toBe(
			"Olive Oil",
		);
	});

	it("does not update the cache when adding to the database fails", async () => {
		cloudData.placeCloudSmoothieListItem.mockResolvedValue("error");

		expect(await addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, food)).toBe("error");
		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)).toEqual([]);
	});

	it("does not update the cache when removing from the database fails", async () => {
		cacheSmoothieListLocally(MIX_STORAGE_KEYS.fridge, [food]);
		cloudData.removeCloudSmoothieListItem.mockResolvedValue(false);

		expect(await removeFoodFromSmoothieList(MIX_STORAGE_KEYS.fridge, food.fdcId)).toBe(
			"error",
		);
		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)).toHaveLength(1);
	});

	it("preserves selected cached foods when the cloud list is temporarily stale", () => {
		const syncedFood = { ...food, fdcId: 2, description: "Kale" };

		expect(preserveSelectedListItems([syncedFood], [food], [food.fdcId])).toEqual([
			syncedFood,
			food,
		]);
	});

	it("does not restore unselected cached foods after cloud synchronization", () => {
		const syncedFood = { ...food, fdcId: 2, description: "Kale" };

		expect(preserveSelectedListItems([syncedFood], [food], [])).toEqual([
			syncedFood,
		]);
	});
});
