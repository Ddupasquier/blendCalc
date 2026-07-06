import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudData = vi.hoisted(() => ({
	removeCloudSmoothieListItem: vi.fn(),
	upsertCloudSmoothieListItem: vi.fn(),
	writeCloudSmoothieList: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudData);

import {
	addFoodToSmoothieList,
	preserveSelectedListItems,
	readSmoothieList,
	removeFoodFromSmoothieList,
	renameFoodInSmoothieList,
	writeSmoothieList,
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
		cloudData.upsertCloudSmoothieListItem.mockResolvedValue(true);
		cloudData.removeCloudSmoothieListItem.mockResolvedValue(true);
	});

	it("stores compact food records with serving metadata", () => {
		expect(writeSmoothieList(MIX_STORAGE_KEYS.fridge, [food])).toBe(true);

		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)[0]).toMatchObject({
			fdcId: 1,
			description: "Olive oil",
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

	it("adds one list item without rewriting the whole cloud list", async () => {
		expect(await addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, food)).toBe("added");

		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)).toHaveLength(1);
		expect(cloudData.upsertCloudSmoothieListItem).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			expect.objectContaining({ fdcId: food.fdcId }),
		);
		expect(cloudData.writeCloudSmoothieList).not.toHaveBeenCalled();
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
		expect(cloudData.upsertCloudSmoothieListItem).toHaveBeenCalledTimes(1);
	});

	it("removes one list item without rewriting the whole cloud list", async () => {
		writeSmoothieList(MIX_STORAGE_KEYS.fridge, [food]);
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
		writeSmoothieList(MIX_STORAGE_KEYS.fridge, [food]);
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
		writeSmoothieList(MIX_STORAGE_KEYS.fridge, [food]);

		expect(
			await renameFoodInSmoothieList(MIX_STORAGE_KEYS.fridge, food.fdcId, "   "),
		).toBe("invalid");
		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)[0].description).toBe(
			"Olive oil",
		);
	});

	it("rejects duplicate display names in the same list", async () => {
		const kale = { ...food, fdcId: 2, description: "Kale, raw" };
		writeSmoothieList(MIX_STORAGE_KEYS.fridge, [food, kale]);

		expect(
			await renameFoodInSmoothieList(
				MIX_STORAGE_KEYS.fridge,
				kale.fdcId,
				" olive oil ",
			),
		).toBe("duplicate");
		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)[1].description).toBe(
			"Kale, raw",
		);
	});

	it("keeps the cached name when database rename fails", async () => {
		writeSmoothieList(MIX_STORAGE_KEYS.fridge, [food]);
		cloudData.upsertCloudSmoothieListItem.mockResolvedValue(false);

		expect(
			await renameFoodInSmoothieList(
				MIX_STORAGE_KEYS.fridge,
				food.fdcId,
				"Cooking oil",
			),
		).toBe("error");
		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)[0].description).toBe(
			"Olive oil",
		);
	});

	it("does not update the cache when adding to the database fails", async () => {
		cloudData.upsertCloudSmoothieListItem.mockResolvedValue(false);

		expect(await addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, food)).toBe("error");
		expect(readSmoothieList(MIX_STORAGE_KEYS.fridge)).toEqual([]);
	});

	it("does not update the cache when removing from the database fails", async () => {
		writeSmoothieList(MIX_STORAGE_KEYS.fridge, [food]);
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
