import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import IngredientSearchCard from "$lib/components/ingredients/search/IngredientSearchCard/IngredientSearchCard.svelte";

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
			screen.getByRole("button", { name: "Add Ground Beef to fridge" }),
		);

		expect(onAdd).toHaveBeenCalledOnce();
		expect(onAdd).toHaveBeenCalledWith(food);
		expect(onSelect).not.toHaveBeenCalled();
	});
});
