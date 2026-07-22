import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProductIngredientsPanel from "$lib/components/ingredients/nutrition/ProductIngredientsPanel/ProductIngredientsPanel.svelte";
import type { FdcFood } from "$lib/utils/food/types";

const createFood = (overrides: Partial<FdcFood> = {}): FdcFood => ({
	fdcId: 1,
	description: "Test food",
	foodNutrients: [],
	...overrides,
});

describe("ProductIngredientsPanel", () => {
	it("shows the complete stored ingredient text", () => {
		const ingredients = "Tomatoes, water, onions, garlic, sea salt, basil";
		render(ProductIngredientsPanel, {
			props: { food: createFood({ ingredients }) },
		});

		expect(screen.getByRole("heading", { name: "Ingredients" }))
			.toBeInTheDocument();
		expect(screen.getByText(ingredients)).toBeInTheDocument();
	});

	it("uses a source-provided ingredient list when raw text is unavailable", () => {
		render(ProductIngredientsPanel, {
			props: {
				food: createFood({ ingredientList: ["Oats", "Honey", "Sea salt"] }),
			},
		});

		expect(screen.getByText("Oats, Honey, Sea salt")).toBeInTheDocument();
	});

	it("renders nothing when the product provides no ingredients", () => {
		render(ProductIngredientsPanel, {
			props: { food: createFood() },
		});

		expect(screen.queryByRole("heading", { name: "Ingredients" }))
			.not.toBeInTheDocument();
	});
});
