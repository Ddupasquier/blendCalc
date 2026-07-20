import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SavedIngredientCard from "$lib/components/ingredients/list/SavedIngredientCard.svelte";

const baseProps = {
	food: {
		fdcId: 1,
		description: "Ground Beef",
		foodCategory: "Meat",
		foodNutrients: [],
	},
	moveDirection: "right" as const,
	moveLabel: "Move to Shopping List",
	category: "Meat",
	onToggle: vi.fn(),
	onPreview: vi.fn(),
	onMove: vi.fn(),
	onActions: vi.fn(),
	onRemove: vi.fn(),
};

describe("SavedIngredientCard warning treatment", () => {
	it("uses a card-edge warning bar without a visible warning icon", () => {
		const { container } = render(SavedIngredientCard, {
			props: {
				...baseProps,
				warning: "Peanut may be present",
			},
		});

		expect(container.querySelector("article"))
			.toHaveClass("saved-ingredient-card--warning");
		expect(
			screen.getByRole("button", {
				name: "Preview Ground Beef. Warning: Peanut may be present",
			}),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("img", {
				name: "Peanut may be present. Open ingredient for details.",
			}),
		).not.toBeInTheDocument();
	});

	it("does not change cards without warnings", () => {
		const { container } = render(SavedIngredientCard, {
			props: baseProps,
		});

		expect(container.querySelector("article"))
			.not.toHaveClass("saved-ingredient-card--warning");
		expect(
			screen.getByRole("button", { name: "Preview Ground Beef" }),
		).toBeInTheDocument();
	});
});
