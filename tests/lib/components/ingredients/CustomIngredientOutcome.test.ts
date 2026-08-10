import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";

import CustomIngredientOutcome from "$lib/components/ingredients/manual-entry/CustomIngredientOutcome/CustomIngredientOutcome.svelte";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";
import { createCustomFood } from "$lib/utils/food/custom/customFoods";

const outcomeFood = createCustomFood({
	name: "Moveable snack",
	servingWeightGrams: 34,
	nutrients: [
		{ nutrientId: 1008, nutrientName: "Energy", nutrientNumber: "208", unitName: "KCAL", value: 160 },
		{ nutrientId: 1004, nutrientName: "Total lipid (fat)", nutrientNumber: "204", unitName: "G", value: 6 },
		{ nutrientId: 1005, nutrientName: "Carbohydrate, by difference", nutrientNumber: "205", unitName: "G", value: 20 },
		{ nutrientId: 1079, nutrientName: "Fiber, total dietary", nutrientNumber: "291", unitName: "G", value: 2 },
		{ nutrientId: 2000, nutrientName: "Total Sugars", nutrientNumber: "269", unitName: "G", value: 8 },
		{ nutrientId: 1003, nutrientName: "Protein", nutrientNumber: "203", unitName: "G", value: 2 },
	],
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
