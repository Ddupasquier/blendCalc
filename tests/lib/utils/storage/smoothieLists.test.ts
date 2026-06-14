import { beforeEach, describe, expect, it, vi } from "vitest";

const cloudData = vi.hoisted(() => ({
	removeCloudSmoothieListItem: vi.fn(),
	upsertCloudSmoothieListItem: vi.fn(),
	writeCloudSmoothieList: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabaseData", () => cloudData);

import {
	addFoodToSmoothieList,
	preserveSelectedListItems,
	readSmoothieList,
	removeFoodFromSmoothieList,
	writeSmoothieList,
} from "$lib/utils/storage/smoothieLists";
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
