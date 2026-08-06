import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
	rpc: vi.fn(),
}));

vi.mock("$lib/supabase/client", () => ({
	getSupabaseBrowserClient: () => supabase,
}));

import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { FdcFood } from "$lib/utils/food/types";
import {
	moveCloudSmoothieListItems,
	removeCloudSmoothieListItem,
	renameCloudSmoothieListItem,
	writeCloudSmoothieList,
} from "$lib/utils/storage/supabase/lists";
import {
	deleteCloudSavedDrink,
	saveCloudSavedDrinkWithResult,
} from "$lib/utils/storage/supabase/savedDrinks";
import {
  saveCloudMixGoalConfiguration,
	saveCloudMixPreferences,
	saveCloudMixSectionDisclosureState,
	saveCloudMixSectionOrder,
} from "$lib/utils/storage/supabase/mixPreferences";

const food = {
	fdcId: 1,
	description: "Tomato, Roma",
	foodNutrients: [],
} satisfies FdcFood;

describe("authoritative Supabase write adapters", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("uses authenticated server routes for list writes and database functions for remaining mutations", async () => {
    const fetchMock = vi
      .fn()
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ result: "added" }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ removed: true }),
			});
		vi.stubGlobal("fetch", fetchMock);
		supabase.rpc
			.mockResolvedValueOnce({ data: 1, error: null })
			.mockResolvedValueOnce({ data: "renamed", error: null });

		await expect(
			writeCloudSmoothieList(MIX_STORAGE_KEYS.fridge, [food]),
		).resolves.toBe(true);
		await expect(
			moveCloudSmoothieListItems(
				MIX_STORAGE_KEYS.fridge,
				MIX_STORAGE_KEYS.shoppingList,
				[food.fdcId],
			),
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
			"move_user_food_list_items",
			"rename_user_food_list_item",
		]);
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			"/api/user-food-lists/fridge",
			expect.objectContaining({
				method: "POST",
        body: expect.stringContaining('"foods"'),
			}),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"/api/user-food-lists/fridge?foodId=1",
			expect.objectContaining({ method: "DELETE" }),
		);
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
      goalBasis: "per_mix" as const,
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

  it("updates Mix draft state without a read-before-write request", async () => {
		supabase.rpc.mockResolvedValue({ data: true, error: null });

		await expect(
      saveCloudMixPreferences({ mixState: { selectedFoodIds: [1] } }),
		).resolves.toBe(true);
		expect(supabase.rpc).toHaveBeenCalledOnce();
		expect(supabase.rpc).toHaveBeenCalledWith("save_mix_preferences", {
      p_mix_state: { selectedFoodIds: [1] },
		});
	});

  it("serializes normalized Mix goal semantics through the authoritative function", async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        {
          nutrientId: 1003,
          goalType: "minimum",
          targetAmount: 25,
          upperAmount: null,
          toleranceRatio: 0.05,
          importanceWeight: 2,
          sortOrder: 1,
        },
      ],
      error: null,
    });

    await expect(
      saveCloudMixGoalConfiguration({
        goals: {
          1003: {
            nutrientId: 1003,
            goalType: "minimum",
            targetAmount: 25,
            upperAmount: null,
            toleranceRatio: 0.05,
            importanceWeight: 2,
            sortOrder: 1,
          },
        },
        goalBasis: "per_mix",
        sourceTemplateVersionId: "template-version",
        sourceUserTemplateId: null,
        templateCustomized: true,
      }),
    ).resolves.toMatchObject({
      1003: { goalType: "minimum", importanceWeight: 2 },
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "save_mix_goal_configuration",
      expect.objectContaining({
        p_goal_basis: "per_mix",
        p_source_template_version_id: "template-version",
        p_customized: true,
        p_goals: [
          expect.objectContaining({
            nutrient_id: 1003,
            goal_type: "minimum",
            importance_weight: 2,
          }),
        ],
      }),
    );
  });

	it("saves Mix section order through its validated preference function", async () => {
		supabase.rpc.mockResolvedValue({ data: true, error: null });
		const sectionOrder = [
			"goals",
			"nutrient-shape",
			"selected-ingredients",
			"add-ingredients",
			"warnings",
			"suggested-adjustments",
			"nutrient-contributions",
		];

		await expect(saveCloudMixSectionOrder(sectionOrder)).resolves.toBe(true);
		expect(supabase.rpc).toHaveBeenCalledWith("save_mix_section_order", {
			p_section_order: sectionOrder,
		});
	});

	it("saves the complete Mix disclosure state through its validated preference function", async () => {
		supabase.rpc.mockResolvedValue({ data: true, error: null });
		const sectionDisclosureState = {
			"nutrient-shape": true,
			goals: false,
			"selected-ingredients": true,
			"add-ingredients": true,
			warnings: false,
			"suggested-adjustments": false,
			"nutrient-contributions": true,
		};

		await expect(
			saveCloudMixSectionDisclosureState(sectionDisclosureState),
		).resolves.toBe(true);
		expect(supabase.rpc).toHaveBeenCalledWith(
			"save_mix_section_disclosure_state",
			{ p_section_disclosure_state: sectionDisclosureState },
		);
	});
});
