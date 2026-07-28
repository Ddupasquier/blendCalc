import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { FdcFood } from "$lib/utils/food/types";

const cloudData = vi.hoisted(() => ({
	moveCloudSmoothieListItems: vi.fn(),
	placeCloudSmoothieListItem: vi.fn(),
	readCloudSmoothieListIndex: vi.fn(),
	removeCloudSmoothieListItem: vi.fn(),
	renameCloudSmoothieListItem: vi.fn(),
	writeCloudSmoothieList: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudData);

import {
	addFoodsToSmoothieList,
	addFoodToSmoothieList,
	moveFoodToSmoothieList,
	moveFoodsToSmoothieList,
	preserveSelectedListItems,
	removeFoodFromSmoothieList,
	renameFoodInSmoothieList,
	SMOOTHIE_LISTS_CHANGED_EVENT,
} from "$lib/utils/storage/client/smoothieLists";

const food = {
	fdcId: 1,
	description: "Olive Oil",
	foodNutrients: [],
} satisfies FdcFood;

describe("database-backed smoothie lists", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cloudData.placeCloudSmoothieListItem.mockResolvedValue("added");
		cloudData.moveCloudSmoothieListItems.mockResolvedValue(true);
		cloudData.readCloudSmoothieListIndex.mockResolvedValue({
			[MIX_STORAGE_KEYS.fridge]: {
				foodIds: [food.fdcId],
				foodIdentityKeys: [`fdc:${food.fdcId}`],
			},
			[MIX_STORAGE_KEYS.shoppingList]: {
				foodIds: [],
				foodIdentityKeys: [],
			},
		});
		cloudData.removeCloudSmoothieListItem.mockResolvedValue(true);
		cloudData.renameCloudSmoothieListItem.mockResolvedValue("renamed");
		cloudData.writeCloudSmoothieList.mockResolvedValue(true);
	});

	it("adds through the authoritative database placement function", async () => {
		await expect(addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, food)).resolves
			.toBe("added");
		expect(cloudData.placeCloudSmoothieListItem).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			expect.objectContaining({ fdcId: food.fdcId }),
		);
	});

	it("preserves duplicate and move-required database results", async () => {
		cloudData.placeCloudSmoothieListItem
			.mockResolvedValueOnce("duplicate")
			.mockResolvedValueOnce("move-required:shopping");

		await expect(addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, food)).resolves
			.toBe("duplicate");
		await expect(addFoodToSmoothieList(MIX_STORAGE_KEYS.fridge, food)).resolves
			.toBe("move-required:shopping");
	});

	it("moves through the database with explicit permission", async () => {
		cloudData.placeCloudSmoothieListItem.mockResolvedValue("moved");

		await expect(moveFoodToSmoothieList(MIX_STORAGE_KEYS.shoppingList, food))
			.resolves.toBe("moved");
		expect(cloudData.placeCloudSmoothieListItem).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.shoppingList,
			expect.objectContaining({ fdcId: food.fdcId }),
			true,
		);
	});

	it("moves a checked set with one atomic database request", async () => {
		const tomato = { ...food, fdcId: 2, description: "Tomato, Roma" };

		await expect(
			moveFoodsToSmoothieList(MIX_STORAGE_KEYS.shoppingList, [food, tomato]),
		).resolves.toBe("moved");
		expect(cloudData.moveCloudSmoothieListItems).toHaveBeenCalledOnce();
		expect(cloudData.moveCloudSmoothieListItems).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			MIX_STORAGE_KEYS.shoppingList,
			[food.fdcId, tomato.fdcId],
		);
	});

	it("suppresses refresh events when the caller reconciles moved list state", async () => {
		const listener = vi.fn();
		window.addEventListener(SMOOTHIE_LISTS_CHANGED_EVENT, listener);

		try {
			cloudData.placeCloudSmoothieListItem.mockResolvedValue("moved");
			await moveFoodToSmoothieList(MIX_STORAGE_KEYS.shoppingList, food, {
				notify: false,
			});
			await moveFoodsToSmoothieList(MIX_STORAGE_KEYS.shoppingList, [food], {
				notify: false,
			});

			expect(listener).not.toHaveBeenCalled();
		} finally {
			window.removeEventListener(SMOOTHIE_LISTS_CHANGED_EVENT, listener);
		}
	});

	it("bulk-adds only foods absent from both database lists", async () => {
		const kale = { ...food, fdcId: 2, description: "Kale, Raw" };
		await expect(addFoodsToSmoothieList(MIX_STORAGE_KEYS.fridge, [food, kale]))
			.resolves.toBe("added");
		expect(cloudData.writeCloudSmoothieList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			[expect.objectContaining({ fdcId: kale.fdcId })],
		);
	});

	it("removes only after the database confirms deletion", async () => {
		await expect(removeFoodFromSmoothieList(MIX_STORAGE_KEYS.fridge, food.fdcId))
			.resolves.toBe("removed");
		cloudData.removeCloudSmoothieListItem.mockResolvedValue(false);
		await expect(removeFoodFromSmoothieList(MIX_STORAGE_KEYS.fridge, food.fdcId))
			.resolves.toBe("error");
	});

	it("renames through the authoritative database function", async () => {
		await expect(
			renameFoodInSmoothieList(
				MIX_STORAGE_KEYS.fridge,
				food.fdcId,
				"Cooking oil",
			),
		).resolves.toBe("renamed");
		expect(cloudData.renameCloudSmoothieListItem).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			food.fdcId,
			"Cooking oil",
		);
	});

	it("preserves duplicate-name results from the database", async () => {
		const kale = { ...food, fdcId: 2, description: "Kale, Raw" };
		cloudData.renameCloudSmoothieListItem.mockResolvedValue("duplicate");

		await expect(
			renameFoodInSmoothieList(
				MIX_STORAGE_KEYS.fridge,
				kale.fdcId,
				" olive oil ",
			),
		).resolves.toBe("duplicate");
		expect(cloudData.renameCloudSmoothieListItem).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			kale.fdcId,
			"olive oil",
		);
	});

	it("preserves selected in-memory foods while a database refresh catches up", () => {
		const kale = { ...food, fdcId: 2, description: "Kale, Raw" };
		expect(preserveSelectedListItems([kale], [food], [food.fdcId])).toEqual([
			kale,
			food,
		]);
	});
});
