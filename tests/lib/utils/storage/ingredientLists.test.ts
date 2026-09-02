import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { FoodItem } from "$lib/utils/food/types";

const cloudData = vi.hoisted(() => ({
	moveCloudIngredientListItems: vi.fn(),
	placeCloudIngredientListItem: vi.fn(),
	readCloudIngredientListIndex: vi.fn(),
	removeCloudIngredientListItem: vi.fn(),
	renameCloudIngredientListItem: vi.fn(),
	writeCloudIngredientList: vi.fn(),
}));

vi.mock("$lib/utils/storage/supabase", () => cloudData);

import {
	addFoodsToIngredientList,
	addFoodToIngredientList,
	moveFoodToIngredientList,
	moveIngredientListItemById,
	moveFoodsToIngredientList,
	preserveSelectedListItems,
	removeFoodFromIngredientList,
	renameFoodInIngredientList,
	INGREDIENT_LISTS_CHANGED_EVENT,
} from "$lib/utils/storage/client/ingredientLists";

const food = {
	fdcId: 1,
	description: "Olive Oil",
	foodNutrients: [],
} satisfies FoodItem;

describe("database-backed ingredient lists", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cloudData.placeCloudIngredientListItem.mockResolvedValue("added");
		cloudData.moveCloudIngredientListItems.mockResolvedValue(true);
		cloudData.readCloudIngredientListIndex.mockResolvedValue({
			[MIX_STORAGE_KEYS.fridge]: {
				foodIds: [food.fdcId],
				foodIdentityKeys: [`fdc:${food.fdcId}`],
			},
			[MIX_STORAGE_KEYS.shoppingList]: {
				foodIds: [],
				foodIdentityKeys: [],
			},
		});
		cloudData.removeCloudIngredientListItem.mockResolvedValue(true);
		cloudData.renameCloudIngredientListItem.mockResolvedValue("renamed");
		cloudData.writeCloudIngredientList.mockResolvedValue(true);
	});

	it("adds through the authoritative database placement function", async () => {
		await expect(
			addFoodToIngredientList(MIX_STORAGE_KEYS.fridge, food),
		).resolves.toBe("added");
		expect(cloudData.placeCloudIngredientListItem).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			expect.objectContaining({ fdcId: food.fdcId }),
		);
	});

	it("preserves duplicate and move-required database results", async () => {
		cloudData.placeCloudIngredientListItem
			.mockResolvedValueOnce("duplicate")
			.mockResolvedValueOnce("move-required:shopping");

		await expect(
			addFoodToIngredientList(MIX_STORAGE_KEYS.fridge, food),
		).resolves.toBe("duplicate");
		await expect(
			addFoodToIngredientList(MIX_STORAGE_KEYS.fridge, food),
		).resolves.toBe("move-required:shopping");
	});

	it("moves through the database with explicit permission", async () => {
		cloudData.placeCloudIngredientListItem.mockResolvedValue("moved");

		await expect(
			moveFoodToIngredientList(MIX_STORAGE_KEYS.shoppingList, food),
		).resolves.toBe("moved");
		expect(cloudData.placeCloudIngredientListItem).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.shoppingList,
			expect.objectContaining({ fdcId: food.fdcId }),
			true,
		);
	});

	it("moves a checked set with one atomic database request", async () => {
		const tomato = { ...food, fdcId: 2, description: "Tomato, Roma" };

		await expect(
			moveFoodsToIngredientList(MIX_STORAGE_KEYS.shoppingList, [food, tomato]),
		).resolves.toBe("moved");
		expect(cloudData.moveCloudIngredientListItems).toHaveBeenCalledOnce();
		expect(cloudData.moveCloudIngredientListItems).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			MIX_STORAGE_KEYS.shoppingList,
			[food.fdcId, tomato.fdcId],
		);
	});

	it("moves an existing item by id without replacing its stored food snapshot", async () => {
		await expect(
			moveIngredientListItemById(
				MIX_STORAGE_KEYS.fridge,
				MIX_STORAGE_KEYS.shoppingList,
				food.fdcId,
			),
		).resolves.toBe("moved");
		expect(cloudData.moveCloudIngredientListItems).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			MIX_STORAGE_KEYS.shoppingList,
			[food.fdcId],
		);
		expect(cloudData.placeCloudIngredientListItem).not.toHaveBeenCalled();
	});

	it("suppresses refresh events when the caller reconciles list state", async () => {
		const listener = vi.fn();
		window.addEventListener(INGREDIENT_LISTS_CHANGED_EVENT, listener);

		try {
			await addFoodToIngredientList(MIX_STORAGE_KEYS.fridge, food, {
				notify: false,
			});
			cloudData.placeCloudIngredientListItem.mockResolvedValue("moved");
			await moveFoodToIngredientList(MIX_STORAGE_KEYS.shoppingList, food, {
				notify: false,
			});
			await moveFoodsToIngredientList(MIX_STORAGE_KEYS.shoppingList, [food], {
				notify: false,
			});
			await removeFoodFromIngredientList(MIX_STORAGE_KEYS.fridge, food.fdcId, {
				notify: false,
			});
			await renameFoodInIngredientList(
				MIX_STORAGE_KEYS.fridge,
				food.fdcId,
				"Cooking oil",
				food,
				{ notify: false },
			);

			expect(listener).not.toHaveBeenCalled();
		} finally {
			window.removeEventListener(INGREDIENT_LISTS_CHANGED_EVENT, listener);
		}
	});

	it("bulk-adds only foods absent from both database lists", async () => {
		const kale = { ...food, fdcId: 2, description: "Kale, Raw" };
		await expect(
			addFoodsToIngredientList(MIX_STORAGE_KEYS.fridge, [food, kale]),
		).resolves.toBe("added");
		expect(cloudData.writeCloudIngredientList).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			[expect.objectContaining({ fdcId: kale.fdcId })],
		);
	});

	it("removes only after the database confirms deletion", async () => {
		await expect(
			removeFoodFromIngredientList(MIX_STORAGE_KEYS.fridge, food.fdcId),
		).resolves.toBe("removed");
		cloudData.removeCloudIngredientListItem.mockResolvedValue(false);
		await expect(
			removeFoodFromIngredientList(MIX_STORAGE_KEYS.fridge, food.fdcId),
		).resolves.toBe("error");
	});

	it("renames through the authoritative database function", async () => {
		await expect(
			renameFoodInIngredientList(
				MIX_STORAGE_KEYS.fridge,
				food.fdcId,
				"Cooking oil",
			),
		).resolves.toBe("renamed");
		expect(cloudData.renameCloudIngredientListItem).toHaveBeenCalledWith(
			MIX_STORAGE_KEYS.fridge,
			food.fdcId,
			"Cooking oil",
		);
	});

	it("preserves duplicate-name results from the database", async () => {
		const kale = { ...food, fdcId: 2, description: "Kale, Raw" };
		cloudData.renameCloudIngredientListItem.mockResolvedValue("duplicate");

		await expect(
			renameFoodInIngredientList(
				MIX_STORAGE_KEYS.fridge,
				kale.fdcId,
				" olive oil ",
			),
		).resolves.toBe("duplicate");
		expect(cloudData.renameCloudIngredientListItem).toHaveBeenCalledWith(
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
