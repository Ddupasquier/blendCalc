import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ProductIngredientsPanel from "$lib/components/ingredients/nutrition/ProductIngredientsPanel/ProductIngredientsPanel.svelte";
import type { FoodItem } from "$lib/utils/food/types";

const createFood = (overrides: Partial<FoodItem> = {}): FoodItem => ({
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

	it("presents the server-owned structured ingredient analysis", async () => {
		render(ProductIngredientsPanel, {
			props: {
				food: createFood({
					ingredientPresentation: {
						ingredientText: "Sauce (tomatoes, olive oil)",
						rows: [{
							text: "Tomatoes",
							depth: 1,
							path: ["Sauce", "Tomatoes"],
							percentageLabel: "About 65%",
							classifications: [{ label: "Vegan", value: "Yes" }],
						}],
						additives: ["Citric acid"],
						metrics: [{ label: "Source analysis coverage", value: "92%" }],
						tagGroups: [{ label: "Source analysis", values: ["Vegan"] }],
						hasSourceAnalysis: true,
					},
				}),
			},
		});

		await fireEvent.click(
			screen.getByText("Ingredient details").closest("summary") as HTMLElement,
		);
		expect(screen.getByText("Tomatoes")).toBeInTheDocument();
		expect(screen.getByText("About 65%")).toBeInTheDocument();
		expect(screen.getByText(/Vegan — Yes/)).toBeInTheDocument();
		expect(screen.getByText("92%")).toBeInTheDocument();
		expect(screen.getByText("Citric acid")).toBeInTheDocument();
	});
});
