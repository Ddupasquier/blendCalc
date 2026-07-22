import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
	rpc: vi.fn(),
}));

vi.mock("$lib/supabase/client", () => ({
	getSupabaseBrowserClient: () => supabase,
}));

import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { FdcFood } from "$lib/utils/food/types";
import {
	removeCloudSmoothieListItem,
	renameCloudSmoothieListItem,
	writeCloudSmoothieList,
} from "$lib/utils/storage/supabase/lists";
import {
	deleteCloudSavedDrink,
	saveCloudSavedDrinkWithResult,
} from "$lib/utils/storage/supabase/savedDrinks";
import { saveCloudMixPreferences } from "$lib/utils/storage/supabase/mixPreferences";

const food = {
	fdcId: 1,
	description: "Tomato, Roma",
	foodNutrients: [],
} satisfies FdcFood;

describe("authoritative Supabase write adapters", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses database functions for bulk list writes, renames, and deletes", async () => {
		supabase.rpc
			.mockResolvedValueOnce({ data: "added", error: null })
			.mockResolvedValueOnce({ data: "renamed", error: null })
			.mockResolvedValueOnce({ data: true, error: null });

		await expect(
			writeCloudSmoothieList(MIX_STORAGE_KEYS.fridge, [food]),
		).resolves.toBe(true);
		await expect(
			renameCloudSmoothieListItem(
				MIX_STORAGE_KEYS.fridge,
				food.fdcId,
				"Roma Tomato",
			),
		).resolves.toBe("renamed");
		await expect(
			removeCloudSmoothieListItem(MIX_STORAGE_KEYS.fridge, food.fdcId),
		).resolves.toBe(true);

		expect(supabase.rpc.mock.calls.map(([name]) => name)).toEqual([
			"place_user_food_list_items",
			"rename_user_food_list_item",
			"remove_user_food_list_item",
		]);
	});

	it("uses database functions for saved-drink writes and deletes", async () => {
		supabase.rpc
			.mockResolvedValueOnce({ data: "saved", error: null })
			.mockResolvedValueOnce({ data: true, error: null });
		const drink = {
			id: "a9c6baf0-350f-44c5-baad-343634db28a0",
			name: "Tomato Test",
			createdAt: 1_700_000_000_000,
			foods: [food],
			selected: [],
			options: [],
			nutrientGoals: {},
			servingGrams: {},
			servingQuantities: {},
			servingUnits: {},
		};

		await expect(saveCloudSavedDrinkWithResult(drink)).resolves.toBe("saved");
		await expect(deleteCloudSavedDrink(drink.id)).resolves.toBe(true);
		expect(supabase.rpc.mock.calls.map(([name]) => name)).toEqual([
			"save_saved_drink",
			"delete_saved_drink",
		]);
	});

	it("updates one Mix preference field without a read-before-write request", async () => {
		supabase.rpc.mockResolvedValue({ data: true, error: null });

		await expect(
			saveCloudMixPreferences({ nutrientGoals: { 1008: 2000 } }),
		).resolves.toBe(true);
		expect(supabase.rpc).toHaveBeenCalledOnce();
		expect(supabase.rpc).toHaveBeenCalledWith("save_mix_preferences", {
			p_nutrient_goals: { 1008: 2000 },
			p_mix_state: undefined,
		});
	});
});
