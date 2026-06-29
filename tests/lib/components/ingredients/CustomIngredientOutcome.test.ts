import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import CustomIngredientOutcome from "$lib/components/ingredients/manual-entry/CustomIngredientOutcome.svelte";
import { MIX_STORAGE_KEYS } from "../../../../src/defaults/mixDefaults";
import { createCustomFood } from "$lib/utils/food/customFoods";

const outcomeFood = createCustomFood({
	name: "Moveable snack",
	servingWeightGrams: 34,
	nutrition: {
		calories: 160,
		fat: 6,
		carbs: 20,
		fiber: 2,
		sugar: 8,
		protein: 2,
	},
});

describe("CustomIngredientOutcome", () => {
	it("shows next actions for a fridge add", async () => {
		const onMoveToShopping = vi.fn();
		const onUndo = vi.fn();

		render(CustomIngredientOutcome, {
			props: {
				outcome: {
					food: outcomeFood,
					destination: MIX_STORAGE_KEYS.fridge,
					addedToList: true,
					message: "Moveable snack saved and added to Fridge.",
				},
				action: null,
				onMoveToShopping,
				onMoveToFridge: vi.fn(),
				onUndo,
			},
		});

		expect(screen.getByRole("link", { name: /open mix/i })).toHaveAttribute(
			"href",
			"/mix",
		);

		await fireEvent.click(screen.getByRole("button", { name: /move to shopping/i }));
		await fireEvent.click(screen.getByRole("button", { name: /^undo$/i }));

		expect(onMoveToShopping).toHaveBeenCalledOnce();
		expect(onUndo).toHaveBeenCalledOnce();
	});

	it("shows next actions for a shopping-list add", async () => {
		const onMoveToFridge = vi.fn();

		render(CustomIngredientOutcome, {
			props: {
				outcome: {
					food: outcomeFood,
					destination: MIX_STORAGE_KEYS.shoppingList,
					addedToList: true,
					message: "Moveable snack saved and added to Shopping List.",
				},
				action: null,
				onMoveToShopping: vi.fn(),
				onMoveToFridge,
				onUndo: vi.fn(),
			},
		});

		await fireEvent.click(screen.getByRole("button", { name: /move to fridge/i }));

		expect(onMoveToFridge).toHaveBeenCalledOnce();
	});
});
