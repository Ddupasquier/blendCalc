import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	addFoodToIngredientList: vi.fn(),
	moveFoodToIngredientList: vi.fn(),
}));

vi.mock("$lib/utils/storage/client/ingredientLists", () => ({
	addFoodToIngredientList: mocks.addFoodToIngredientList,
	moveFoodToIngredientList: mocks.moveFoodToIngredientList,
}));

import NutritionListActions from "$lib/components/ingredients/nutrition/NutritionListActions/NutritionListActions.svelte";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import type { FoodItem } from "$lib/utils/food/types";

const spinach: FoodItem = {
	fdcId: 168462,
	description: "Spinach, raw",
	foodNutrients: [],
};

describe("NutritionListActions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.addFoodToIngredientList.mockResolvedValue("added");
	});

	it("adds an unsaved search result to either destination", async () => {
		render(NutritionListActions, {
			props: {
				food: spinach,
				showListActions: true,
				listMembership: { inFridge: false, inShoppingList: false },
			},
		});

		await fireEvent.click(screen.getByRole("button", { name: "Add to Fridge" }));
		await waitFor(() => {
			expect(mocks.addFoodToIngredientList).toHaveBeenCalledWith(
				MIX_STORAGE_KEYS.fridge,
				spinach,
			);
		});

		await fireEvent.click(screen.getByRole("button", { name: "Shopping List" }));
		await waitFor(() => {
			expect(mocks.addFoodToIngredientList).toHaveBeenLastCalledWith(
				MIX_STORAGE_KEYS.shoppingList,
				spinach,
			);
		});
		expect(mocks.addFoodToIngredientList).toHaveBeenCalledTimes(2);
	});

	it.each([
		["Fridge", { inFridge: true, inShoppingList: false }],
		["Shopping List", { inFridge: false, inShoppingList: true }],
	] as const)(
		"hides all list placement controls for food opened from %s",
		(_listName, listMembership) => {
			render(NutritionListActions, {
				props: {
					food: spinach,
					showListActions: false,
					listMembership,
				},
			});

			expect(screen.queryByRole("button", { name: "Add to Fridge" }))
				.not.toBeInTheDocument();
			expect(screen.queryByRole("button", { name: "Shopping List" }))
				.not.toBeInTheDocument();
			expect(screen.queryByText(/already in/i)).not.toBeInTheDocument();
		},
	);
});
