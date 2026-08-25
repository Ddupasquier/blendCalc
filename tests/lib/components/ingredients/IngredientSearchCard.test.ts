import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import IngredientSearchCard from "$lib/components/ingredients/search/IngredientSearchCard/IngredientSearchCard.svelte";
import { MIX_STORAGE_KEYS } from "$lib/utils/storage/storageKeys";

const food = {
	fdcId: 1,
	description: "Ground Beef",
	foodCategory: "Meat",
	foodNutrients: [],
};

const baseProps = {
	food,
	index: 0,
	onSelect: vi.fn(),
	onAdd: vi.fn(),
	onActivate: vi.fn(),
};

describe("IngredientSearchCard interactions", () => {
	it("uses a card-level nutrition target instead of making its title a control", async () => {
		const onSelect = vi.fn();
		render(IngredientSearchCard, {
			props: {
				...baseProps,
				onSelect,
			},
		});

		const cardTarget = screen.getByRole("button", {
			name: "View nutrition for Ground Beef",
		});
		const title = screen.getByText("Ground Beef");

		expect(title.closest("button")).toBeNull();
		expect(cardTarget).toHaveClass("ingredient-search-card__main");

		await fireEvent.click(cardTarget);

		expect(onSelect).toHaveBeenCalledOnce();
		expect(onSelect).toHaveBeenCalledWith(food);
	});

	it("keeps the add action above the card-level nutrition target", async () => {
		const onSelect = vi.fn();
		const onAdd = vi.fn();
		render(IngredientSearchCard, {
			props: {
				...baseProps,
				onSelect,
				onAdd,
			},
		});

		await fireEvent.click(
			screen.getByRole("button", { name: "Add Ground Beef to Fridge" }),
		);

		expect(onAdd).toHaveBeenCalledOnce();
		expect(onAdd).toHaveBeenCalledWith(food);
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("labels list placement actions for the active destination", async () => {
		const onAdd = vi.fn();
		render(IngredientSearchCard, {
			props: {
				...baseProps,
				destinationListKey: MIX_STORAGE_KEYS.shoppingList,
				alreadyInOtherList: true,
				onAdd,
			},
		});

		const moveButton = screen.getByRole("button", {
			name: "Move Ground Beef to Shopping List",
		});
		await fireEvent.click(moveButton);

		expect(onAdd).toHaveBeenCalledOnce();
		expect(onAdd).toHaveBeenCalledWith(food);
		expect(screen.getByText("Meat · currently in Fridge")).toBeInTheDocument();
	});
});
